import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:Courses:Sessions')

const COURSE_SESSION_FIELDS = 'id, course_id, classroom_id, session_number, session_name, scheduled_date, scheduled_time_start, scheduled_time_end, scheduled_duration_minutes, actual_start_time, actual_end_time, actual_duration_minutes, status, teacher_id, teacher_name, student_attendance_status, notes, created_at, updated_at'

// GET: 获取课程的所有课时并计算时长统计
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

    logger.debug('获取课程课时列表', { courseId })

    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    if (!hasScopedIdAccess(accessibleCourseIds, courseId)) {
      logger.warn('获取课程课时列表失败 - 无权访问课程', { courseId, profileId: profile?.id })
      return NextResponse.json(
        { error: '无权查看该课程课时' },
        { status: 403 }
      )
    }

    // 1. 获取课程及订单信息
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select(`
        id,
        course_name,
        total_hours,
        session_count,
        formal_orders!inner(order_number, total_hours, total_sessions, session_duration)
      `)
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      logger.error('获取课程信息失败', { courseId, error_summary: summarizeError(courseError) })
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      )
    }

    const orderInfo = Array.isArray(course.formal_orders)
      ? course.formal_orders[0]
      : course.formal_orders

    // 2. 获取课节列表
    const { data: sessions, error: sessionsError } = await supabaseServer
      .from('class_sessions')
      .select(COURSE_SESSION_FIELDS)
      .eq('course_id', courseId)
      .order('session_number', { ascending: true })

    if (sessionsError) {
      logger.error('获取课时列表失败', { courseId, error_summary: summarizeError(sessionsError) })
      return NextResponse.json(
        { error: '获取课时列表失败' },
        { status: 400 }
      )
    }

    // 3. 统计课节数据
    const totalSessions = sessions?.length || 0
    const completedSessions = sessions?.filter((s: any) => s.status === 'completed').length || 0
    const scheduledSessions = sessions?.filter((s: any) => s.status !== 'cancelled').length || 0

    // 4. 计算时长（基于实际课节的 scheduled_duration_minutes）
    const totalHours = orderInfo?.total_hours || 0

    // 已排课时长（实际）：累加每个已排课节的实际时长
    const scheduledHours = sessions
      ?.filter((s: any) => s.status !== 'cancelled')
      .reduce((sum: number, s: any) => sum + (s.scheduled_duration_minutes || 0), 0) / 60 || 0

    // 已完成时长（实际）：累加每个已完成课节的实际时长
    const completedHours = sessions
      ?.filter((s: any) => s.status === 'completed')
      .reduce((sum: number, s: any) => sum + (s.scheduled_duration_minutes || 0), 0) / 60 || 0

    // 未排课时长
    const unscheduledHours = Math.max(0, totalHours - scheduledHours)

    // 5. 返回增强数据（向后兼容：同时返回 data 和 sessions）
    logger.debug('获取课时列表成功', {
      courseId,
      count: totalSessions,
      scheduledHours,
      completedHours,
      unscheduledHours
    })

    return NextResponse.json({
      // 向后兼容：旧字段
      data: sessions || [],

      // 新字段：增强数据
      sessions: sessions || [],
      statistics: {
        totalSessions,
        completedSessions,
        scheduledSessions,
        durations: {
          totalHours,
          scheduledHours,
          completedHours,
          unscheduledHours,
        }
      },
      course: {
        id: course.id,
        course_name: course.course_name,
        total_hours: course.total_hours,
        session_count: course.session_count,
      },
      order: {
        order_number: orderInfo?.order_number,
        total_hours: orderInfo?.total_hours,
        total_sessions: orderInfo?.total_sessions,
        session_duration: orderInfo?.session_duration,
      }
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '获取课时列表失败')
    logger.error('获取课时列表异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}
