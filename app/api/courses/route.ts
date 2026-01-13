import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger('API:Courses')

// GET: 获取课程列表（支持ID查询单个、按学生筛选、分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const studentId = searchParams.get('student_id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取课程数据', { id, studentId, from, to })

    // 如果提供了ID，查询单个课程
    if (id) {
      const { data, error } = await supabaseServer
        .from('courses')
        .select(`
          *,
          teacher:teacher_id(id, name),
          formal_orders(id, order_number, student_id)
        `)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取课程失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取课程成功', { id })
      return NextResponse.json({ data })
    }

    // 基础查询
    let query = supabaseServer
      .from('courses')
      .select(`
        *,
        teacher:teacher_id(id, name),
        formal_orders(id, order_number, student_id)
      `, { count: 'exact' })

    // 按学生筛选
    if (studentId) {
      query = query.eq('formal_orders.student_id', studentId)
    }

    // 分页查询数据，按创建时间降序排序
    query = query
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      logger.error('获取课程列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // 格式化数据（展平嵌套对象）
    const formattedData = (data || []).map((course: any) => ({
      ...course,
      teacher_name: course.teacher?.name,
      student_id: course.student_id || course.formal_orders?.student_id,
      order_number: course.formal_orders?.order_number,
    }))

    logger.debug('获取课程列表成功', { count: formattedData.length || 0 })
    return NextResponse.json({
      data: formattedData,
      count: count || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取课程失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新课程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建课程 - 接收到的数据', { body })

    // 验证：订单ID必填
    if (!body.order_id || typeof body.order_id !== 'string') {
      logger.error('创建课程失败 - 订单ID为空', { body })
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      )
    }

    // 验证：订单是否存在
    const { data: order, error: orderError } = await supabaseServer
      .from('formal_orders')
      .select('id, student_id')
      .eq('id', body.order_id)
      .single()

    if (orderError || !order) {
      logger.error('创建课程失败 - 订单不存在', { order_id: body.order_id })
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    // 验证：该订单是否已有课程（一对一关系）
    const { data: existingCourse } = await supabaseServer
      .from('courses')
      .select('id')
      .eq('order_id', body.order_id)
      .single()

    if (existingCourse) {
      logger.error('创建课程失败 - 订单已关联课程', { order_id: body.order_id })
      return NextResponse.json(
        { error: '该订单已关联课程，请勿重复创建' },
        { status: 400 }
      )
    }

    const insertData = {
      order_id: body.order_id,
      student_id: order.student_id,
      classin_course_id: body.classin_course_id || null,
      course_name: body.course_name || null,
      subject: body.subject || null,
      grade: body.grade || null,
      teacher_id: body.teacher_id || null,
      teacher_name: body.teacher_name || null,
      session_count: body.session_count || 0,
      total_hours: body.total_hours || 0,
      course_status: body.course_status || 'active',
      course_consumption_info: body.course_consumption_info || null,
      notes: body.notes || null,
    }

    logger.debug('创建课程 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('courses')
      .insert(insertData)
      .select(`
        *,
        teacher:teacher_id(id, name),
        formal_orders(id, order_number, student_id)
      `)
      .single()

    if (error) {
      logger.error('创建课程失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 格式化返回数据
    const formattedData = {
      ...data,
      teacher_name: data.teacher?.name,
      student_id: data.student_id || data.formal_orders?.student_id,
      order_number: data.formal_orders?.order_number,
    }

    logger.info('创建课程成功', { id: data.id })
    return NextResponse.json({ data: formattedData }, { status: 201 })
  } catch (error: any) {
    logger.error('创建课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建课程失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新课程
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少课程ID' },
        { status: 400 }
      )
    }

    logger.debug('更新课程 - 接收到的数据', { id, updateData })

    const updatePayload: any = {}
    const optionalFields = [
      'classin_course_id', 'course_name', 'subject', 'grade',
      'teacher_id', 'teacher_name', 'session_count', 'total_hours',
      'course_status', 'course_consumption_info', 'notes'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新课程 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('courses')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        teacher:teacher_id(id, name),
        formal_orders(id, order_number, student_id)
      `)
      .single()

    if (error) {
      logger.error('更新课程失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 格式化返回数据
    const formattedData = {
      ...data,
      teacher_name: data.teacher?.name,
      student_id: data.student_id || data.formal_orders?.student_id,
      order_number: data.formal_orders?.order_number,
    }

    logger.info('更新课程成功', { id })
    return NextResponse.json({ data: formattedData })
  } catch (error: any) {
    logger.error('更新课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新课程失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除课程
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少课程ID' },
        { status: 400 }
      )
    }

    logger.debug('删除课程', { id })

    const { error } = await supabaseServer
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除课程失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除课程成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除课程失败' },
      { status: 500 }
    )
  }
}
