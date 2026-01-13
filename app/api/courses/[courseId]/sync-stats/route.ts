import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger('API:Courses:SyncStats')

// POST: 同步课程统计信息（从 class_classin）
export async function POST(
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

    logger.debug('同步课程统计信息', { courseId })

    // 1. 获取本地课程信息
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id')
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
        { error: '课程未关联 ClassIn，无法同步' },
        { status: 400 }
      )
    }

    // 2. 从 class_classin 获取基本信息
    const { data: classinCourse, error: classinError } = await supabaseServer
      .from('class_classin')
      .select('course_id, course_name')
      .eq('course_id', course.classin_course_id)
      .single()

    if (classinError || !classinCourse) {
      logger.error('ClassIn 课程不存在', { classinCourseId: course.classin_course_id })
      return NextResponse.json(
        { error: 'ClassIn 课程不存在' },
        { status: 404 }
      )
    }

    // 3. 从 classroom_classin 统计课时信息
    const { data: classrooms, error: classroomsError } = await supabaseServer
      .from('classroom_classin')
      .select('class_id')
      .eq('course_id', course.classin_course_id)

    if (classroomsError) {
      logger.error('获取课堂记录失败', { courseId, message: classroomsError.message })
      return NextResponse.json(
        { error: '获取课堂记录失败' },
        { status: 400 }
      )
    }

    // 4. 计算统计数据
    const totalSessions = classrooms?.length || 0
    // 注意：completedSessions 需要根据实际业务逻辑判断，这里暂时假设所有都是已完成的
    const completedSessions = totalSessions
    const progress = totalSessions > 0 ? 100 : 0

    // 5. 构建消耗信息
    const consumptionInfo = {
      totalSessions,
      completedSessions,
      progress,
      lastSyncTime: new Date().toISOString(),
    }

    // 6. 更新本地课程
    const { data: updatedCourse, error: updateError } = await supabaseServer
      .from('courses')
      .update({
        course_name: classinCourse.course_name,
        session_count: totalSessions,
        course_consumption_info: JSON.stringify(consumptionInfo),
      })
      .eq('id', courseId)
      .select(`
        *,
        teacher:teacher_id(id, name),
        formal_orders(id, order_number, student_id)
      `)
      .single()

    if (updateError) {
      logger.error('更新课程失败', { courseId, message: updateError.message })
      const { message, status } = handleDatabaseError(updateError)
      return NextResponse.json({ error: message }, { status })
    }

    // 格式化返回数据
    const formattedData = {
      ...updatedCourse,
      teacher_name: updatedCourse.teacher?.name,
      student_id: updatedCourse.student_id || updatedCourse.formal_orders?.student_id,
      order_number: updatedCourse.formal_orders?.order_number,
    }

    logger.info('同步课程统计信息成功', {
      courseId,
      totalSessions: consumptionInfo.totalSessions,
      completedSessions: consumptionInfo.completedSessions,
      progress: consumptionInfo.progress,
    })

    return NextResponse.json({ data: formattedData })
  } catch (error: any) {
    logger.error('同步课程统计信息异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '同步课程统计信息失败' },
      { status: 500 }
    )
  }
}
