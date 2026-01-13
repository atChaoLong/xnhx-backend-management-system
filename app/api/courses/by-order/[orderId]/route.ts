import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Courses:ByOrder')

// GET: 根据订单ID获取课程（一对一关系）
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params

    if (!orderId) {
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      )
    }

    logger.debug('根据订单ID获取课程', { orderId })

    const { data, error } = await supabaseServer
      .from('courses')
      .select(`
        *,
        teacher:teacher_id(id, name),
        orders(id, order_number, student_id)
      `)
      .eq('order_id', orderId)
      .maybeSingle()

    if (error) {
      logger.error('获取课程失败', { orderId, message: error.message })
      return NextResponse.json(
        { error: error.message },
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
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取课程失败' },
      { status: 500 }
    )
  }
}
