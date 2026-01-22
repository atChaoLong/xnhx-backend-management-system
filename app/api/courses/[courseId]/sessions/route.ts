import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Courses:Sessions')

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

    // 1. 获取课程及订单信息
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select(`
        *,
        formal_orders!inner(order_number, total_hours, total_sessions, session_duration)
      `)
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      logger.error('获取课程信息失败', { courseId, message: courseError?.message })
      return NextResponse.json(
        { error: '课程不存在', details: courseError?.message },
        { status: 404 }
      )
    }

    // 2. 获取课节列表
    const { data: sessions, error: sessionsError } = await supabaseServer
      .from('class_sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('session_number', { ascending: true })

    if (sessionsError) {
      logger.error('获取课时列表失败', { courseId, message: sessionsError.message })
      return NextResponse.json(
        { error: sessionsError.message },
        { status: 400 }
      )
    }

    // 3. 统计课节数据
    const totalSessions = sessions?.length || 0
    const completedSessions = sessions?.filter((s: any) => s.status === 'completed').length || 0
    const scheduledSessions = sessions?.filter((s: any) => s.status !== 'cancelled').length || 0

    // 4. 计算时长（基于实际课节的 scheduled_duration_minutes）
    const totalHours = course.formal_orders?.total_hours || 0

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
        order_number: course.formal_orders?.order_number,
        total_hours: course.formal_orders?.total_hours,
        total_sessions: course.formal_orders?.total_sessions,
        session_duration: course.formal_orders?.session_duration,
      }
    })
  } catch (error: any) {
    logger.error('获取课时列表异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取课时列表失败' },
      { status: 500 }
    )
  }
}
