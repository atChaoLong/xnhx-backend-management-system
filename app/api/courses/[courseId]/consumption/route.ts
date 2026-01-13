import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Courses:Consumption')

/**
 * 计算课程实际消耗（基于 classroom_classin）
 * 这是更精确的计算方式，基于实际上课时间
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params

    if (!courseId) {
      return NextResponse.json(
        { error: '课程ID不能为空' },
        { status: 400 }
      )
    }

    logger.debug('计算课程实际消耗', { courseId })

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
      logger.error('获取课堂记录失败', { courseId, message: classroomsError.message })
      return NextResponse.json(
        { error: '获取课堂记录失败' },
        { status: 400 }
      )
    }

    // 3. 计算实际上课小时数
    let actualSeconds = 0
    const sessionCount = classrooms?.length || 0

    classrooms?.forEach((classroom: any) => {
      if (classroom.start_time && classroom.end_time) {
        const duration = classroom.end_time - classroom.start_time
        actualSeconds += duration
      }
    })

    // 转换为小时（保留2位小数）
    const actualHours = Math.round((actualSeconds / 3600) * 100) / 100

    // 4. 统计课时数（从 classroom_classin 计算）
    const totalSessions = sessionCount
    const completedSessions = sessionCount  // 假设所有课时都已完成
    const progress = totalSessions > 0 ? 100 : 0

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
  } catch (error: any) {
    logger.error('计算课程实际消耗异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '计算课程实际消耗失败' },
      { status: 500 }
    )
  }
}
