import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger('API:Transactions')

// GET: 获取异动记录列表（支持ID查询单个和分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取异动记录数据', { id, from, to })

    // 如果提供了ID，查询单个异动记录
    if (id) {
      const { data, error } = await supabaseServer
        .from('transaction_records')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取异动记录失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取异动记录成功', { id })
      return NextResponse.json({ data })
    }

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('transaction_records')
      .select('*', { count: 'exact', head: true })

    // 分页查询数据，按创建日期降序排序
    const { data, error } = await supabaseServer
      .from('transaction_records')
      .select('*')
      .order('creation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取异动记录列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取异动记录列表成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取异动记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取异动记录失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新异动记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建异动记录 - 接收到的数据', { body })

    // 后端验证：必填字段
    if (!body.creation_date || typeof body.creation_date !== 'string' || !body.creation_date.trim()) {
      logger.error('创建异动记录失败 - 创建日期为空', { body })
      return NextResponse.json(
        { error: '创建日期不能为空' },
        { status: 400 }
      )
    }

    if (!body.student_name || typeof body.student_name !== 'string' || !body.student_name.trim()) {
      logger.error('创建异动记录失败 - 学生姓名为空', { body })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    if (!body.transaction_type || typeof body.transaction_type !== 'string' || !body.transaction_type.trim()) {
      logger.error('创建异动记录失败 - 异动类型为空', { body })
      return NextResponse.json(
        { error: '异动类型不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      creation_date: body.creation_date,
      course_name: body.course_name?.trim() || null,
      student_name: body.student_name.trim(),
      teacher_name: body.teacher_name?.trim() || null,
      schedule_consumption: body.schedule_consumption !== undefined ? parseFloat(body.schedule_consumption) : null,
      order_type: body.order_type?.trim() || null,
      original_consultant: body.original_consultant?.trim() || null,
      class_teacher: body.class_teacher?.trim() || null,
      refund_reason: body.refund_reason?.trim() || null,
      transaction_type: body.transaction_type.trim(),
      remaining_duration: body.remaining_duration !== undefined ? parseFloat(body.remaining_duration) : null,
      refund_amount: body.refund_amount !== undefined ? parseFloat(body.refund_amount) : null,
      bank_card_name: body.bank_card_name?.trim() || null,
      bank_card_number: body.bank_card_number?.trim() || null,
      bank_name: body.bank_name?.trim() || null,
      bank_branch: body.bank_branch?.trim() || null,
      status: body.status || 'pending',
      unit_price: body.unit_price !== undefined ? parseFloat(body.unit_price) : null,
    }

    logger.debug('创建异动记录 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('transaction_records')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建异动记录失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建异动记录成功', { id: data.id, student_name: data.student_name })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建异动记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建异动记录失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新异动记录
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少异动记录ID' },
        { status: 400 }
      )
    }

    logger.debug('更新异动记录 - 接收到的数据', { id, updateData })

    // 后端验证：必填字段
    if (updateData.student_name !== undefined && (!updateData.student_name || !updateData.student_name.trim())) {
      logger.error('更新异动记录失败 - 学生姓名为空', { id, updateData })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    if (updateData.transaction_type !== undefined && (!updateData.transaction_type || !updateData.transaction_type.trim())) {
      logger.error('更新异动记录失败 - 异动类型为空', { id, updateData })
      return NextResponse.json(
        { error: '异动类型不能为空' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'creation_date', 'course_name', 'student_name', 'teacher_name',
      'schedule_consumption', 'order_type', 'original_consultant', 'class_teacher',
      'refund_reason', 'transaction_type', 'remaining_duration', 'refund_amount',
      'bank_card_name', 'bank_card_number', 'bank_name', 'bank_branch',
      'status', 'unit_price'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新异动记录 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('transaction_records')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新异动记录失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新异动记录成功', { id, student_name: data.student_name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新异动记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新异动记录失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除异动记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少异动记录ID' },
        { status: 400 }
      )
    }

    logger.debug('删除异动记录', { id })

    const { error } = await supabaseServer
      .from('transaction_records')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除异动记录失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除异动记录成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除异动记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除异动记录失败' },
      { status: 500 }
    )
  }
}
