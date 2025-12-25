import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger('API:DailyLeads')

// GET: 获取每日线索列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    logger.debug('获取每日线索数据', { id })

    // 如果提供了ID，查询单个线索
    if (id) {
      const { data, error } = await supabaseServer
        .from('daily_leads')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取每日线索失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取每日线索成功', { id })
      return NextResponse.json({ data })
    }

    // 否则获取所有线索，按领取日期降序排序
    const { data, error } = await supabaseServer
      .from('daily_leads')
      .select('*')
      .order('received_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('获取每日线索列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取每日线索列表成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取每日线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取每日线索失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新每日线索
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建每日线索 - 接收到的数据', { body })

    // 后端验证：必填字段
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      logger.error('创建每日线索失败 - 姓名为空', { body })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    if (!body.wechat_number || typeof body.wechat_number !== 'string' || !body.wechat_number.trim()) {
      logger.error('创建每日线索失败 - 微信号为空', { body })
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    if (!body.assigned_person || typeof body.assigned_person !== 'string' || !body.assigned_person.trim()) {
      logger.error('创建每日线索失败 - 归属人员为空', { body })
      return NextResponse.json(
        { error: '归属人员不能为空' },
        { status: 400 }
      )
    }

    if (!body.received_date) {
      logger.error('创建每日线索失败 - 领取日期为空', { body })
      return NextResponse.json(
        { error: '领取日期不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      name: body.name.trim(),
      wechat_number: body.wechat_number.trim(),
      assigned_person: body.assigned_person.trim(),
      received_date: body.received_date,
      is_added: body.is_added || false,
      resume_attachment: body.resume_attachment || null,
      notes: body.notes?.trim() || null,
    }

    logger.debug('创建每日线索 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('daily_leads')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建每日线索失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建每日线索成功', { id: data.id, name: data.name })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建每日线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建每日线索失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新每日线索
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少每日线索ID' },
        { status: 400 }
      )
    }

    logger.debug('更新每日线索 - 接收到的数据', { id, updateData })

    // 后端验证：必填字段
    if (updateData.name !== undefined && (!updateData.name || !updateData.name.trim())) {
      logger.error('更新每日线索失败 - 姓名为空', { id, updateData })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    if (updateData.wechat_number !== undefined && (!updateData.wechat_number || !updateData.wechat_number.trim())) {
      logger.error('更新每日线索失败 - 微信号为空', { id, updateData })
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    if (updateData.assigned_person !== undefined && (!updateData.assigned_person || !updateData.assigned_person.trim())) {
      logger.error('更新每日线索失败 - 归属人员为空', { id, updateData })
      return NextResponse.json(
        { error: '归属人员不能为空' },
        { status: 400 }
      )
    }

    const updatePayload = {
      name: updateData.name?.trim() || undefined,
      wechat_number: updateData.wechat_number?.trim() || undefined,
      assigned_person: updateData.assigned_person?.trim() || undefined,
      received_date: updateData.received_date || undefined,
      is_added: updateData.is_added !== undefined ? updateData.is_added : undefined,
      resume_attachment: updateData.resume_attachment || undefined,
      notes: updateData.notes?.trim() || undefined,
    }

    logger.debug('更新每日线索 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('daily_leads')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新每日线索失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新每日线索成功', { id, name: data.name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新每日线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新每日线索失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除每日线索
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少每日线索ID' },
        { status: 400 }
      )
    }

    logger.debug('删除每日线索', { id })

    const { error } = await supabaseServer
      .from('daily_leads')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除每日线索失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除每日线索成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除每日线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除每日线索失败' },
      { status: 500 }
    )
  }
}
