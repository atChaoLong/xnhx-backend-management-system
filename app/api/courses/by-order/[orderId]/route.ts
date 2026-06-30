import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getAccessibleFormalOrderIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"
import { COURSE_RESPONSE_SELECT, formatCourseResponse } from "@/lib/server-course-selects"

const logger = createLogger('API:Courses:ByOrder')

// GET: 根据订单ID获取课程（一对一关系）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      )
    }

    logger.debug('根据订单ID获取课程', { orderId })

    const profile = await getProfileFromHeaders(request)
    const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)

    if (!hasScopedIdAccess(accessibleOrderIds, orderId)) {
      logger.warn('获取课程失败 - 无权访问订单', { orderId, profileId: profile?.id })
      return NextResponse.json(
        { error: '无权访问该订单课程' },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseServer
      .from('courses')
      .select(COURSE_RESPONSE_SELECT)
      .eq('order_id', orderId)
      .maybeSingle()

    if (error) {
      logger.error('获取课程失败', { orderId, error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取课程失败' },
        { status: 400 }
      )
    }

    if (!data) {
      logger.debug('订单未关联课程', { orderId })
      return NextResponse.json(
        { error: '未找到课程' },
        { status: 404 }
      )
    }

    logger.debug('获取课程成功', { orderId, courseId: data.id })
    return NextResponse.json({ data: formatCourseResponse(data) })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '获取课程失败')
    logger.error('获取课程异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}
