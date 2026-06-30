import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { ensureChinaTimezone } from "@/lib/utils/timezone"
import { ensureClassInStudentAccount } from "@/lib/server-classin-students"
import { summarizeError } from "@/lib/safe-error"
import { createLogger } from "@/lib/logger"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getAccessibleTrialLessonIds, hasScopedIdAccess } from "@/lib/server-business-scope"

const logger = createLogger('API:TrialLessonscreateClassIn')
const CLASSIN_STUDENT_ERROR_MESSAGE = '创建 ClassIn 学生账号失败'

const TRIAL_CLASSIN_LESSON_SELECT = `
  id,
  child_name,
  phone,
  trial_subject,
  trial_time,
  trial_duration,
  confirmed_teacher,
  classin_course_id,
  classin_unit_id,
  classin_class_id,
  classin_activity_id,
  classin_student_uid
`

const CLASSIN_TEACHER_SELECT = `
  uid,
  name
`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const trialLessonId = String(body.trialLessonId || '').trim()

    if (!trialLessonId) {
      return NextResponse.json({ error: '试听课程ID不能为空' }, { status: 400 })
    }

    const profile = await getProfileFromHeaders(request)

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleTrialLessonIds = await getAccessibleTrialLessonIds(profile)

    if (!hasScopedIdAccess(accessibleTrialLessonIds, trialLessonId)) {
      logger.warn('创建 ClassIn 课程失败 - 无权访问试听课程', {
        trialLessonId,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '无权为该试听课程创建 ClassIn 课程' },
        { status: 403 }
      )
    }

    // 1. 获取试听课程信息
    const { data: lesson, error: lessonError } = await supabaseServer
      .from('trial_lessons')
      .select(TRIAL_CLASSIN_LESSON_SELECT)
      .eq('id', trialLessonId)
      .single()

    if (lessonError || !lesson) {
      logger.error('获取试听课程失败', {
        trialLessonId,
        error_summary: lessonError ? summarizeError(lessonError) : undefined,
      })
      return NextResponse.json({ error: '试听课程不存在' }, { status: 404 })
    }

    // 2. 检查是否已经有 ClassIn 课程ID
    if (lesson.classin_course_id) {
      return NextResponse.json({ error: '该试听课程已创建ClassIn课程' }, { status: 400 })
    }

    // 3. 检查是否已分配教师
    if (!lesson.confirmed_teacher) {
      return NextResponse.json({ error: '请先确认教师后再创建课程' }, { status: 400 })
    }

    if (!lesson.phone) {
      return NextResponse.json({ error: '缺少学生手机号（用于注册 ClassIn 学生账号）' }, { status: 400 })
    }

    // 4. 从 teacher_classin 表获取教师信息
    const { data: teacherData, error: teacherError } = await supabaseServer
      .from('teacher_classin')
      .select(CLASSIN_TEACHER_SELECT)
      .eq('name', lesson.confirmed_teacher)
      .eq('is_del', 0)
      .single()

    if (teacherError || !teacherData) {
      logger.error('获取教师ClassIn信息失败', {
        trialLessonId,
        error_summary: teacherError ? summarizeError(teacherError) : undefined,
      })
      return NextResponse.json({ error: '教师未在ClassIn系统中找到，请检查教师姓名是否正确' }, { status: 400 })
    }

    // 5. 学科中文映射（服务端兜底）
    const subjectCode = (lesson.trial_subject || '').toLowerCase()
    const SUBJECT_LABELS: Record<string, string> = {
      chinese: '语文',
      math: '数学',
      english: '英语',
      physics: '物理',
      chemistry: '化学',
      biology: '生物',
      history: '历史',
      geography: '地理',
      politics: '政治'
    }
    const subjectLabel = SUBJECT_LABELS[subjectCode] || subjectCode

    // 6. 使用 SDK 创建课程和课堂
    const sdk = getClassInSDKService()

    let studentUid: number | undefined = lesson.classin_student_uid
      ? Number(lesson.classin_student_uid)
      : undefined
    let classinStudentUpdate: Record<string, any> = {}

    if (!studentUid) {
      const classinStudent = await ensureClassInStudentAccount({
        telephone: lesson.phone,
        nickname: lesson.child_name || '学生',
      })

      studentUid = classinStudent.uid
      classinStudentUpdate = {
        classin_student_uid: classinStudent.uid || null,
        classin_student_registered_at: classinStudent.uid ? new Date().toISOString() : null,
        classin_student_error: classinStudent.uid
          ? null
          : CLASSIN_STUDENT_ERROR_MESSAGE,
      }

      if (!studentUid) {
        logger.warn('未能获得试听学生 ClassIn UID，后续将跳过添加课程学生', {
          trialLessonId,
          error_summary: summarizeError(classinStudent.error),
        })
      }
    }

    // 课程名称和课堂名称
    const courseName = `【试听】${lesson.child_name} ${subjectLabel}课`
    const classroomName = `【试听】${lesson.child_name} ${subjectLabel}课`

    // 计算开始和结束时间（确保使用中国时区）
    const trialTimeISO = ensureChinaTimezone(lesson.trial_time)
    const trialTime = new Date(trialTimeISO)
    const durationInHours = lesson.trial_duration / 60
    const durationMs = durationInHours * 60 * 60 * 1000
    const endTime = new Date(trialTime.getTime() + durationMs)

    logger.info('开始创建完整的ClassIn课程', {
      trialLessonId,
      teacherUid: teacherData.uid,
      trial_duration_minutes: lesson.trial_duration,
      durationInHours,
      durationMs,
      durationMinutes: (endTime.getTime() - trialTime.getTime()) / 60000
    })

    // 7. 执行创建流程
    let courseId: number
    let unitId: number | undefined
    let classId: number
    let activityId: number

    try {
      // 7.1 创建课程
      courseId = await sdk.createCourse({
        courseName
      })

      logger.info('创建课程成功', { courseId })

      // 7.2 跳过显式创建单元，不传 unitId（创建在无主题单元下）
      unitId = undefined

      logger.info('创建单元成功', { unitId })

      // 7.3 创建课堂活动
      const classroomResult = await sdk.createClassroom({
        courseId,
        name: classroomName,
        teacherUid: teacherData.uid,
        startTime: trialTime,
        endTime: endTime,
        liveState: 0,
        openState: 0,
        recordState: 1, // 开启录课
        recordType: 0,
        seatNum: 2, // 一对一（1v1）
      })

      classId = classroomResult.classId
      activityId = classroomResult.activityId

      logger.info('创建课堂成功', { classId, activityId })

    } catch (error: unknown) {
      logger.error('创建ClassIn课程失败', {
        trialLessonId,
        error_summary: summarizeError(error),
      })
      throw error
    }

    try {
      await supabaseServer
        .from('class_classin')
        .upsert({
          course_id: courseId,
          course_name: courseName,
          creator_uid: teacherData.uid,
          creater_name: lesson.confirmed_teacher || '',
          add_time: Math.floor(Date.now() / 1000),
          course_state: 1,
          teacher_num: 1,
          student_num: 0,
          sync_time: new Date().toISOString(),
        }, {
          onConflict: 'course_id'
        })
      logger.info('写入 class_classin 成功', { courseId })
    } catch (error: unknown) {
      logger.warn('写入 class_classin 失败（非致命）', {
        courseId,
        error_summary: summarizeError(error),
      })
    }

    if (studentUid) {
      try {
        await sdk.addCourseStudent({
          courseId,
          studentUid,
          identity: 1,
          studentName: lesson.child_name || undefined,
        })
        logger.info('添加试听学生到 ClassIn 课程成功', {
          courseId,
          has_student_uid: true,
        })
      } catch (error: unknown) {
        logger.warn('添加试听学生到 ClassIn 课程失败（非致命）', {
          courseId,
          has_student_uid: true,
          error_summary: summarizeError(error),
        })
      }
    }

    // 8. 更新试听课程记录
    const { error: updateError } = await supabaseServer
      .from('trial_lessons')
      .update({
        classin_course_id: courseId,
        classin_class_id: classId,
        classin_activity_id: activityId,
        classin_unit_id: unitId || null,
        course_status: '已排课',
        status: 'confirmed',
        ...classinStudentUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trialLessonId)

    if (updateError) {
      logger.error('更新试听课程失败', {
        trialLessonId,
        error_summary: summarizeError(updateError),
      })
      return NextResponse.json({ error: '创建成功但更新记录失败' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        courseId,
        unitId,
        classId,
        activityId
      }
    })
  } catch (error: unknown) {
    logger.error('创建ClassIn课程异常', { error_summary: summarizeError(error) })
    return NextResponse.json({ error: '创建课程失败' }, { status: 500 })
  }
}
