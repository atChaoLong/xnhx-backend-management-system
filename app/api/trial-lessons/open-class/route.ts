import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { ensureClassInStudentAccount } from "@/lib/server-classin-students"
import { summarizeError } from "@/lib/safe-error"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleTrialLessonIds, hasScopedIdAccess } from "@/lib/server-business-scope"

const logger = createLogger('API:TrialLessonsOpenClass')
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

/**
 * 试听开课：若无课程则创建课程+单元+课堂；若已有课程则仅创建课堂
 * Body: { trialLessonId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const trialLessonId = String(body.trialLessonId || '').trim()

    if (!trialLessonId) {
      return NextResponse.json({ error: '试听课程ID不能为空' }, { status: 400 })
    }

    const profile = await getCurrentProfile(request)

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleTrialLessonIds = await getAccessibleTrialLessonIds(profile)

    if (!hasScopedIdAccess(accessibleTrialLessonIds, trialLessonId)) {
      logger.warn('试听开课失败 - 无权访问试听课程', {
        trialLessonId,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '无权为该试听课程开课' },
        { status: 403 }
      )
    }

    const { data: lesson, error: lessonError } = await supabaseServer
      .from('trial_lessons')
      .select(TRIAL_CLASSIN_LESSON_SELECT)
      .eq('id', trialLessonId)
      .single()

    if (lessonError || !lesson) {
      logger.warn('获取试听课程失败', {
        trialLessonId,
        error_summary: lessonError ? summarizeError(lessonError) : undefined,
      })
      return NextResponse.json({ error: '试听课程不存在' }, { status: 404 })
    }

    if (!lesson.confirmed_teacher) {
      return NextResponse.json({ error: '请先确认教师后再开课' }, { status: 400 })
    }
    if (!lesson.trial_time || !lesson.trial_duration) {
      return NextResponse.json({ error: '缺少试听时间或时长' }, { status: 400 })
    }

    if (!lesson.phone) {
      return NextResponse.json({ error: '缺少学生手机号（用于注册 ClassIn 学生账号）' }, { status: 400 })
    }

    const { data: teacherData, error: teacherError } = await supabaseServer
      .from('teacher_classin')
      .select(CLASSIN_TEACHER_SELECT)
      .eq('name', lesson.confirmed_teacher)
      .eq('is_del', 0)
      .single()

    if (teacherError || !teacherData?.uid) {
      logger.warn('获取教师ClassIn信息失败', {
        trialLessonId,
        error_summary: teacherError ? summarizeError(teacherError) : undefined,
      })
      return NextResponse.json({ error: '教师未在ClassIn系统中找到或未绑定UID' }, { status: 400 })
    }

    const sdk = getClassInSDKService()

    let studentUid: number | undefined = lesson.classin_student_uid
      ? Number(lesson.classin_student_uid)
      : undefined

    if (!studentUid) {
      const classinStudent = await ensureClassInStudentAccount({
        telephone: lesson.phone,
        nickname: lesson.child_name || '学生',
      })

      studentUid = classinStudent.uid

      const { error: classinStudentUpdateError } = await supabaseServer
        .from('trial_lessons')
        .update({
          classin_student_uid: classinStudent.uid || null,
          classin_student_registered_at: classinStudent.uid ? new Date().toISOString() : null,
          classin_student_error: classinStudent.uid
            ? null
            : CLASSIN_STUDENT_ERROR_MESSAGE,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trialLessonId)

      if (classinStudentUpdateError) {
        logger.warn('保存试听学生 ClassIn 绑定结果失败', {
          trialLessonId,
          error_summary: summarizeError(classinStudentUpdateError),
        })
      }

      if (!studentUid) {
        logger.warn('未能获得试听学生 ClassIn UID，后续将跳过添加课程学生', {
          trialLessonId,
          error_summary: summarizeError(classinStudent.error),
        })
      }
    }

    const trialTime = new Date(lesson.trial_time)
    const durationMs = (lesson.trial_duration as number) * 60 * 1000
    const endTime = new Date(trialTime.getTime() + durationMs)

    let courseId: number = lesson.classin_course_id || 0
    let unitId: number | undefined = lesson.classin_unit_id || undefined
    let classId: number
    let activityId: number

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
    if (!courseId) {
      const courseName = `【试听】${lesson.child_name} ${subjectLabel}课`
      courseId = await sdk.createCourse({ courseName })
      // 不创建单元，不传 unitId（创建在无主题单元下）
      unitId = undefined

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
          }, { onConflict: 'course_id' })
      } catch (error: unknown) {
        logger.warn('写入 class_classin 失败', {
          courseId,
          error_summary: summarizeError(error),
        })
      }
    }

    const subjectLabel2 = SUBJECT_LABELS[subjectCode] || subjectCode
    const baseClassName = `【试听】${lesson.child_name} ${subjectLabel2}课`
    let seq = 1
    try {
      const { count: classCount } = await supabaseServer
        .from('classroom_classin')
        .select('class_id', { count: 'exact', head: true })
        .eq('course_id', courseId)
      seq = (classCount || 0) + 1
    } catch (error: unknown) {
      logger.warn('统计课程课节数量失败，默认序号为1', {
        courseId,
        error_summary: summarizeError(error),
      })
    }
    const classNameWithSeq = `${baseClassName} - ${seq}`
    const classroomResult = await sdk.createClassroom({
      courseId,
      name: classNameWithSeq,
      teacherUid: teacherData.uid,
      startTime: trialTime,
      endTime: endTime,
      liveState: 1,
      openState: 1,
      recordState: 1,
      recordType: 0,
      seatNum: 2, // 一对一（1v1）
    })

    classId = classroomResult.classId
    activityId = classroomResult.activityId

    try {
      await supabaseServer
        .from('classroom_classin')
        .upsert(
          {
            class_id: classId,
            name: classNameWithSeq,
            start_time: Math.floor(trialTime.getTime() / 1000),
            end_time: Math.floor(endTime.getTime() / 1000),
            course_id: courseId,
            course_name: `【试听】${lesson.child_name} ${subjectLabel}课`,
            activity_id: activityId,
            created_at_timestamp: Math.floor(Date.now() / 1000),
            sync_time: new Date().toISOString(),
          },
          { onConflict: 'class_id' }
        )
    } catch (error: unknown) {
      logger.warn('写入 classroom_classin 失败', {
        courseId,
        classId,
        error_summary: summarizeError(error),
      })
    }

    // 将学生加入课程（课程下所有课节均可上）
    if (studentUid) {
      try {
        await sdk.addCourseStudent({
          courseId,
          studentUid,
          identity: 1,
          studentName: lesson.child_name || undefined,
        })
      } catch (error: unknown) {
        logger.warn('添加课程学生失败（非致命）', {
          courseId,
          has_student_uid: true,
          error_summary: summarizeError(error),
        })
      }
    }

    const shareUrl = `https://share.eeo.cn/s/a/?cid=${courseId}`
    const { error: updateError } = await supabaseServer
      .from('trial_lessons')
      .update({
        classin_course_id: courseId,
        classin_unit_id: unitId || null,
        classin_class_id: classId,
        classin_activity_id: activityId,
        class_link: shareUrl,
        course_status: '已排课',
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trialLessonId)

    if (updateError) {
      logger.error('更新试听课程 ClassIn 信息失败', {
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
        activityId,
        hasStudentUid: Boolean(studentUid),
        shareUrl,
      }
    })
  } catch (error: unknown) {
    logger.error('试听开课异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '试听开课失败' },
      { status: 500 }
    )
  }
}
