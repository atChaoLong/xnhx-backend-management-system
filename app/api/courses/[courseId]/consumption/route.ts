import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getAccessibleCourseIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:Courses:Consumption')

function isCompletedClassroom(classroom: { end_time?: number | null }, nowSeconds: number) {
  return typeof classroom.end_time === 'number' && classroom.end_time > 0 && classroom.end_time < nowSeconds
}

/**
 * 计算课程实际消耗（基于 classroom_classin）
 * 这是更精确的计算方式，基于实际上课时间
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    if (!courseId) {
      return NextResponse.json(
        { error: '课程ID不能为空' },
        { status: 400 }
      )
    }

    logger.debug('计算课程实际消耗', { courseId })

    const profile = await getProfileFromHeaders(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    if (!hasScopedIdAccess(accessibleCourseIds, courseId)) {
      logger.warn('计算课程实际消耗失败 - 无权访问课程', { courseId, profileId: profile?.id })
      return NextResponse.json(
        { error: '无权查看该课程消耗' },
        { status: 403 }
      )
    }

    // 1. 获取课程信息
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id, total_hours')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      logger.error('课程不存在', { courseId })
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      )
    }

    if (!course.classin_course_id) {
      logger.error('课程未关联 ClassIn', { courseId })
      return NextResponse.json(
        { error: '课程未关联 ClassIn，无法计算消耗' },
        { status: 400 }
      )
    }

    // 2. 从 classroom_classin 获取该课程的所有课堂记录
    const { data: classrooms, error: classroomsError } = await supabaseServer
      .from('classroom_classin')
      .select('class_id, start_time, end_time')
      .eq('course_id', course.classin_course_id)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)
      .order('start_time', { ascending: true })

    if (classroomsError) {
      logger.error('获取课堂记录失败', { courseId, error_summary: summarizeError(classroomsError) })
      return NextResponse.json(
        { error: '获取课堂记录失败' },
        { status: 400 }
      )
    }

    // 3. 计算已完成课节的实际上课小时数
    let actualSeconds = 0
    const nowSeconds = Math.floor(Date.now() / 1000)
    const sessionCount = classrooms?.length || 0
    const completedClassrooms = classrooms?.filter((classroom: any) =>
      isCompletedClassroom(classroom, nowSeconds)
    ) || []

    completedClassrooms.forEach((classroom: any) => {
      if (classroom.start_time && classroom.end_time) {
        const duration = classroom.end_time - classroom.start_time
        if (duration > 0) actualSeconds += duration
      }
    })

    // 转换为小时（保留2位小数）
    const actualHours = Math.round((actualSeconds / 3600) * 100) / 100

    // 4. 统计课时数（从 classroom_classin 计算）
    const totalSessions = sessionCount
    const completedSessions = completedClassrooms.length
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

    // 5. 构建返回数据
    const consumptionInfo = {
      totalSessions,           // 总课时数
      completedSessions,       // 已完成课时数
      progress,                // 进度百分比
      totalHours: course.total_hours || 0,  // 订单总小时数
      actualHours,             // 实际上课小时数（从 classroom_classin 计算）
      lastCalcTime: new Date().toISOString(),
    }

    logger.debug('计算课程实际消耗成功', {
      courseId,
      totalSessions,
      completedSessions,
      actualHours,
      progress,
    })

    return NextResponse.json({ data: consumptionInfo })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '计算课程实际消耗失败')
    logger.error('计算课程实际消耗异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}
