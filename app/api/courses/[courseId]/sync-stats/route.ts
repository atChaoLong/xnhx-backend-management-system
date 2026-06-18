import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"
import { COURSE_RESPONSE_SELECT, formatCourseResponse } from "@/lib/server-course-selects"

const logger = createLogger('API:Courses:SyncStats')

function isCompletedClassroom(classroom: { end_time?: number | null }, nowSeconds: number) {
  return typeof classroom.end_time === 'number' && classroom.end_time > 0 && classroom.end_time < nowSeconds
}

// POST: 同步课程统计信息（从 class_classin）
export async function POST(
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

    logger.debug('同步课程统计信息', { courseId })

    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    if (!hasScopedIdAccess(accessibleCourseIds, courseId)) {
      logger.warn('同步课程统计失败 - 无权访问课程', { courseId, profileId: profile?.id })
      return NextResponse.json(
        { error: '无权同步该课程统计' },
        { status: 403 }
      )
    }

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
      .select('class_id, end_time')
      .eq('course_id', course.classin_course_id)

    if (classroomsError) {
      logger.error('获取课堂记录失败', { courseId, error_summary: summarizeError(classroomsError) })
      return NextResponse.json(
        { error: '获取课堂记录失败' },
        { status: 400 }
      )
    }

    // 4. 计算统计数据
    const nowSeconds = Math.floor(Date.now() / 1000)
    const totalSessions = classrooms?.length || 0
    const completedSessions = classrooms?.filter((classroom: any) =>
      isCompletedClassroom(classroom, nowSeconds)
    ).length || 0
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

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
      .select(COURSE_RESPONSE_SELECT)
      .single()

    if (updateError) {
      logger.error('更新课程失败', { courseId, error_summary: summarizeError(updateError) })
      const { message, status } = handleDatabaseError(updateError)
      return NextResponse.json({ error: message }, { status })
    }

    // 格式化返回数据
    const formattedData = formatCourseResponse(updatedCourse)

    logger.info('同步课程统计信息成功', {
      courseId,
      totalSessions: consumptionInfo.totalSessions,
      completedSessions: consumptionInfo.completedSessions,
      progress: consumptionInfo.progress,
    })

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '同步课程统计信息失败')
    logger.error('同步课程统计信息异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}
