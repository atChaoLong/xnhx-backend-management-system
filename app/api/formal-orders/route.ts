import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger('API:FormalOrders')

// GET: 获取正式订单列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取正式订单数据', { id, from, to })

    // 如果提供了ID，查询单个正式订单
    if (id) {
      const { data, error } = await supabaseServer
        .from('formal_orders')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取正式订单失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取正式订单成功', { id })
      return NextResponse.json({ data })
    }

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('formal_orders')
      .select('*', { count: 'exact', head: true })

    // 分页查询数据，按首次课时间降序排序
    const { data, error } = await supabaseServer
      .from('formal_orders')
      .select('*')
      .order('first_class_time', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取正式订单列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取正式订单列表成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取正式订单异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取正式订单失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新正式订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建正式订单 - 接收到的数据', { body })

    // 后端验证：必填字段
    if (!body.student_id || typeof body.student_id !== 'string' || !body.student_id.trim()) {
      logger.error('创建正式订单失败 - 学生ID为空', { body })
      return NextResponse.json(
        { error: '学生ID不能为空' },
        { status: 400 }
      )
    }

    if (!body.order_type || typeof body.order_type !== 'string' || !body.order_type.trim()) {
      logger.error('创建正式订单失败 - 订单类型为空', { body })
      return NextResponse.json(
        { error: '订单类型不能为空' },
        { status: 400 }
      )
    }

    const orderType = String(body.order_type).trim()
    const isRenew = orderType === 'renew' || orderType.includes('续')

    if (isRenew && (!body.previous_order_id || typeof body.previous_order_id !== 'string')) {
      logger.error('创建正式订单失败 - 续费需要关联之前订单', { body })
      return NextResponse.json(
        { error: '续费必须选择关联之前的订单' },
        { status: 400 }
      )
    }

    if (!body.consultant_teacher || typeof body.consultant_teacher !== 'string' || !body.consultant_teacher.trim()) {
      logger.error('创建正式订单失败 - 签约顾问为空', { body })
      return NextResponse.json(
        { error: '签约顾问不能为空' },
        { status: 400 }
      )
    }

    if (!body.teacher_names || !Array.isArray(body.teacher_names) || body.teacher_names.length === 0) {
      logger.error('创建正式订单失败 - 老师姓名为空', { body })
      return NextResponse.json(
        { error: '至少选择一位老师' },
        { status: 400 }
      )
    }

    if (!body.subjects || !Array.isArray(body.subjects) || body.subjects.length === 0) {
      logger.error('创建正式订单失败 - 学科为空', { body })
      return NextResponse.json(
        { error: '至少选择一个学科' },
        { status: 400 }
      )
    }

    if (!body.total_hours || isNaN(body.total_hours)) {
      logger.error('创建正式订单失败 - 总课时(小时)无效', { body })
      return NextResponse.json(
        { error: '总课时(小时)不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_channel || typeof body.payment_channel !== 'string' || !body.payment_channel.trim()) {
      logger.error('创建正式订单失败 - 付款渠道为空', { body })
      return NextResponse.json(
        { error: '付款渠道不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_amount || isNaN(body.payment_amount)) {
      logger.error('创建正式订单失败 - 付款金额无效', { body })
      return NextResponse.json(
        { error: '付款金额不能为空' },
        { status: 400 }
      )
    }

    if (!body.hourly_rate || isNaN(body.hourly_rate)) {
      logger.error('创建正式订单失败 - 小时单价无效', { body })
      return NextResponse.json(
        { error: '小时单价不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_proof || typeof body.payment_proof !== 'string' || !body.payment_proof.trim()) {
      logger.error('创建正式订单失败 - 付款凭证为空', { body })
      return NextResponse.json(
        { error: '付款凭证不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_time || typeof body.payment_time !== 'string' || !body.payment_time.trim()) {
      logger.error('创建正式订单失败 - 付费时间为空', { body })
      return NextResponse.json(
        { error: '付费时间不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      student_id: body.student_id.trim(),
      order_number: body.order_number?.trim() || null,
      order_type: body.order_type.trim(),
      consultant_teacher: body.consultant_teacher.trim(),
      order_notes: body.order_notes?.trim() || null,
      lead_id: body.lead_id || null,
      previous_order_id: body.previous_order_id || null,
      teacher_names: body.teacher_names,
      subjects: body.subjects,
      // 设置默认值以保持数据库兼容性
      total_sessions: 0, // 默认值，后续通过排课更新
      session_duration: 1, // 默认1小时
      fixed_mode: '未设置', // 默认值
      frequency: '1_per_week', // 默认每周一次
      official_start_time: new Date().toISOString(), // 默认当前时间
      first_class_time: new Date().toISOString(), // 默认当前时间
      total_hours: parseFloat(body.total_hours),
      payment_channel: body.payment_channel.trim(),
      payment_amount: parseFloat(body.payment_amount),
      hourly_rate: parseFloat(body.hourly_rate),
      payment_proof: body.payment_proof.trim(),
      payment_time: body.payment_time,
      status: body.status || 'active',
    }

    logger.debug('创建正式订单 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('formal_orders')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建正式订单失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建正式订单成功', { id: data.id, order_number: data.order_number })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建正式订单异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建正式订单失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新正式订单
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少正式订单ID' },
        { status: 400 }
      )
    }

    logger.debug('更新正式订单 - 接收到的数据', { id, updateData })

    // 数组字段验证
    if (updateData.teacher_names !== undefined && (!Array.isArray(updateData.teacher_names) || updateData.teacher_names.length === 0)) {
      logger.error('更新正式订单失败 - 老师姓名无效', { id, updateData })
      return NextResponse.json(
        { error: '至少选择一位老师' },
        { status: 400 }
      )
    }

    if (updateData.subjects !== undefined && (!Array.isArray(updateData.subjects) || updateData.subjects.length === 0)) {
      logger.error('更新正式订单失败 - 学科无效', { id, updateData })
      return NextResponse.json(
        { error: '至少选择一个学科' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'student_id', 'order_number', 'order_type', 'consultant_teacher', 'order_notes',
      'teacher_names', 'subjects', 'total_sessions', 'session_duration',
      'fixed_mode', 'frequency', 'official_start_time', 'first_class_time',
      'total_hours', 'payment_channel', 'payment_amount', 'hourly_rate',
      'payment_proof', 'payment_time', 'status'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新正式订单 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('formal_orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新正式订单失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新正式订单成功', { id, order_number: data.order_number })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新正式订单异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新正式订单失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除正式订单
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少正式订单ID' },
        { status: 400 }
      )
    }

    logger.debug('删除正式订单', { id })

    const { error } = await supabaseServer
      .from('formal_orders')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除正式订单失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除正式订单成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除正式订单异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除正式订单失败' },
      { status: 500 }
    )
  }
}
