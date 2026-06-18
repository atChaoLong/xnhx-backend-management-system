import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { requireClassInOpsProfile } from "@/lib/server-classin-ops"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"
import { COURSE_RESPONSE_SELECT, formatCourseResponse } from "@/lib/server-course-selects"

const logger = createLogger('API:Courses:LinkClassIn')

// POST: 关联 ClassIn 课程到本地订单
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()

    const { orderId, classinCourseId } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      )
    }

    if (!classinCourseId || typeof classinCourseId !== 'number') {
      return NextResponse.json(
        { error: 'ClassIn 课程ID不能为空' },
        { status: 400 }
      )
    }

    logger.debug('关联 ClassIn 课程', { orderId, classinCourseId })

    // 1. 验证订单存在
    const { data: order, error: orderError } = await supabaseServer
      .from('formal_orders')
      .select('id, student_id, total_hours, subjects, teacher_names')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      logger.error('订单不存在', { orderId })
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    // 2. 验证 ClassIn 课程存在并统计课时
    const { data: classinCourse, error: classinError } = await supabaseServer
      .from('class_classin')
      .select('course_id, course_name')
      .eq('course_id', classinCourseId)
      .single()

    if (classinError || !classinCourse) {
      logger.error('ClassIn 课程不存在', { classinCourseId })
      return NextResponse.json(
        { error: 'ClassIn 课程不存在' },
        { status: 404 }
      )
    }

    // 2b. 从 classroom_classin 统计课时数
    const { data: classrooms, error: classroomsError } = await supabaseServer
      .from('classroom_classin')
      .select('class_id')
      .eq('course_id', classinCourseId)

    const sessionCount = classrooms?.length || 0

    // 3. 检查该订单是否已有课程
    const { data: existingCourse } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id')
      .eq('order_id', orderId)
      .maybeSingle()

    let courseData: any

    if (existingCourse) {
      // 3a. 如果已存在课程，更新 classin_course_id
      logger.debug('更新现有课程的 ClassIn 关联', {
        courseId: existingCourse.id,
        oldClassinId: existingCourse.classin_course_id,
        newClassinId: classinCourseId
      })

      const { data, error } = await supabaseServer
        .from('courses')
        .update({
          classin_course_id: classinCourseId,
          course_name: classinCourse.course_name,
          session_count: sessionCount,
          course_consumption_info: JSON.stringify({
            totalSessions: sessionCount,
            completedSessions: sessionCount,
            progress: sessionCount > 0 ? 100 : 0,
            lastSyncTime: new Date().toISOString(),
          }),
        })
        .eq('id', existingCourse.id)
        .select(COURSE_RESPONSE_SELECT)
        .single()

      if (error) {
        logger.error('更新课程失败', { error_summary: summarizeError(error) })
        const { message, status } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }

      courseData = data
    } else {
      // 3b. 如果不存在课程，创建新课程
      logger.debug('创建新课程并关联 ClassIn', { orderId, classinCourseId })

      // 从订单中提取学科（取第一个）
      const subject = order.subjects && order.subjects.length > 0 ? order.subjects[0] : null

      const newCourseData = {
        order_id: orderId,
        student_id: order.student_id,
        classin_course_id: classinCourseId,
        course_name: classinCourse.course_name,
        subject: subject,
        session_count: sessionCount,
        total_hours: order.total_hours || 0,
        course_status: 'active' as const,
        course_consumption_info: JSON.stringify({
          totalSessions: sessionCount,
          completedSessions: sessionCount,
          progress: sessionCount > 0 ? 100 : 0,
          lastSyncTime: new Date().toISOString(),
        }),
      }

      const { data, error } = await supabaseServer
        .from('courses')
        .insert(newCourseData)
        .select(COURSE_RESPONSE_SELECT)
        .single()

      if (error) {
        logger.error('创建课程失败', { error_summary: summarizeError(error) })
        const { message, status } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }

      courseData = data
    }

    // 格式化返回数据
    const formattedData = formatCourseResponse(courseData)

    logger.info('关联 ClassIn 课程成功', {
      orderId,
      classinCourseId,
      courseId: formattedData.id
    })

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '关联 ClassIn 课程失败')
    logger.error('关联 ClassIn 课程异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}
