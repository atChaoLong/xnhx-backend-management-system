import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:StudentsStats')

// GET: 获取学生统计数据（支持按班主任过滤）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const headTeacherId = searchParams.get('head_teacher_id')

    logger.debug('获取学生统计数据', { headTeacherId })

    // 构建基础查询
    let studentsQuery = supabaseServer
      .from('students')
      .select('id, status, created_at')

    // 如果指定了班主任ID，添加过滤条件
    if (headTeacherId) {
      studentsQuery = studentsQuery.eq('head_teacher_id', headTeacherId)
    }

    const { data: students, error } = await studentsQuery

    if (error) {
      logger.error('获取学生统计数据失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // 计算统计数据
    const totalStudents = students?.length || 0
    const activeStudents = students?.filter(s => s.status === 'active').length || 0

    // 获取订单统计（需要关联查询）
    let ordersQuery = supabaseServer
      .from('orders')
      .select('id, student_id, total_hours')

    if (headTeacherId) {
      // 如果有班主任ID，需要关联学生表过滤
      const studentIds = students?.map(s => s.id) || []
      if (studentIds.length > 0) {
        ordersQuery = ordersQuery.in('student_id', studentIds)
      } else {
        ordersQuery = ordersQuery.eq('student_id', '00000000-0000-0000-0000-000000000000') // 无结果
      }
    }

    const { data: orders } = await ordersQuery
    const totalOrders = orders?.length || 0
    const totalClassHours = orders?.reduce((sum, o) => sum + (o.total_hours || 0), 0) || 0

    const stats = {
      totalStudents,
      activeStudents,
      totalOrders,
      totalClassHours,
    }

    logger.debug('获取学生统计数据成功', stats)
    return NextResponse.json(stats)
  } catch (error: any) {
    logger.error('获取学生统计数据异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取学生统计数据失败' },
      { status: 500 }
    )
  }
}
