import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, hasScopedIdAccess } from "@/lib/server-business-scope"

const logger = createLogger('API:Courses:OpenClass')

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

/**
 * 正式生开课：为课程创建 ClassIn 课程（如果尚未关联）
 * 不创建学生 ClassIn 账号（正式生已有账号）
 * Body: { courseId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courseId } = body

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: '课程ID不能为空' }, { status: 400 })
    }

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '用户档案未配置，请联系管理员' }, { status: 403 })
    }

    const accessibleCourseIds = await getAccessibleCourseIds(profile)
    if (!hasScopedIdAccess(accessibleCourseIds, courseId)) {
      return NextResponse.json({ error: '无权为该课程开课' }, { status: 403 })
    }

    // 1. 获取课程信息
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select(`
        id,
        classin_course_id,
        course_name,
        subject,
        teacher_name,
        student_id,
        order_id,
        formal_orders ( student_id )
      `)
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: '课程不存在' }, { status: 404 })
    }

    // 如果已有 classin_course_id，直接返回成功
    if (course.classin_course_id) {
      return NextResponse.json({
        success: true,
        data: {
          classinCourseId: course.classin_course_id,
          courseName: course.course_name,
          alreadyExists: true,
        }
      })
    }

    // 2. 获取学生信息
    let studentName = ''
    let studentClassinUid: number | undefined

    const studentId = course.student_id || course.formal_orders?.[0]?.student_id
    if (studentId) {
      const { data: student } = await supabaseServer
        .from('students')
        .select('student_name, classin_uid')
        .eq('id', studentId)
        .single()
      studentName = student?.student_name || ''
      studentClassinUid = student?.classin_uid ? Number(student.classin_uid) : undefined
    }

    // 3. 获取教师 ClassIn 信息
    if (!course.teacher_name) {
      return NextResponse.json({ error: '课程缺少授课老师' }, { status: 400 })
    }

    const { data: teacherClassin, error: teacherError } = await supabaseServer
      .from('teacher_classin')
      .select('uid, name')
      .eq('name', course.teacher_name)
      .eq('is_del', 0)
      .single()

    if (teacherError || !teacherClassin?.uid) {
      return NextResponse.json({ error: `教师未绑定 ClassIn：${course.teacher_name}` }, { status: 400 })
    }

    // 4. 创建 ClassIn 课程
    const sdk = getClassInSDKService()
    const subjectLabel = SUBJECT_LABELS[(course.subject || '').toLowerCase()] || course.subject || ''
    const courseName = course.course_name || `${studentName} ${subjectLabel}课`
    const classinCourseId = await sdk.createCourse({ courseName })

    // 写入 class_classin 表
    try {
      await supabaseServer
        .from('class_classin')
        .upsert({
          course_id: classinCourseId,
          course_name: courseName,
          creator_uid: teacherClassin.uid,
          creater_name: course.teacher_name || '',
          add_time: Math.floor(Date.now() / 1000),
          course_state: 1,
          teacher_num: 1,
          student_num: 0,
          sync_time: new Date().toISOString(),
        }, { onConflict: 'course_id' })
    } catch (error) {
      logger.warn('写入 class_classin 失败', {
        courseId,
        classinCourseId,
        error_summary: summarizeError(error),
      })
    }

    // 5. 将学生加入课程（跳过账号创建，正式生已有账号）
    if (studentClassinUid) {
      try {
        await sdk.addCourseStudent({
          courseId: classinCourseId,
          studentUid: studentClassinUid,
          identity: 1,
          studentName: studentName || undefined,
        })
      } catch (error) {
        logger.warn('添加课程学生失败（非致命）', {
          courseId,
          classinCourseId,
          studentClassinUid,
          error_summary: summarizeError(error),
        })
      }
    }

    // 6. 更新本地课程的 classin_course_id
    const { error: updateError } = await supabaseServer
      .from('courses')
      .update({
        classin_course_id: classinCourseId,
        course_name: courseName,
      })
      .eq('id', courseId)

    if (updateError) {
      logger.error('更新课程 ClassIn ID 失败', {
        courseId,
        classinCourseId,
        error_summary: summarizeError(updateError),
      })
      return NextResponse.json({ error: '创建成功但更新课程记录失败' }, { status: 500 })
    }

    logger.info('正式生开课成功', {
      courseId,
      classinCourseId,
      courseName,
      teacherName: course.teacher_name,
      studentName,
    })

    return NextResponse.json({
      success: true,
      data: {
        classinCourseId,
        courseName,
        alreadyExists: false,
      }
    })
  } catch (error) {
    logger.error('正式生开课异常', { error_summary: summarizeError(error) })
    return NextResponse.json({ error: '开课失败' }, { status: 500 })
  }
}
