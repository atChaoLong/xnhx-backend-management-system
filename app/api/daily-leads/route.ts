import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:DailyLeads')
const DAILY_LEAD_SELECT = 'id,created_at,updated_at,name,wechat_number,assigned_person,received_date,is_added,resume_attachment,notes'

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function summarizeDailyLeadPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_name: hasNonEmptyString(payload?.name),
    has_wechat_number: hasNonEmptyString(payload?.wechat_number),
    has_assigned_person: hasNonEmptyString(payload?.assigned_person),
    has_received_date: Boolean(payload?.received_date),
    has_resume_attachment: hasNonEmptyString(payload?.resume_attachment),
    has_notes: hasNonEmptyString(payload?.notes),
    is_added_present: payload?.is_added !== undefined,
  }
}

// GET: 获取每日线索列表（支持ID查询单个和分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取每日线索数据', { id, from, to })

    // 如果提供了ID，查询单个线索
    if (id) {
      const { data, error } = await supabaseServer
        .from('daily_leads')
        .select(DAILY_LEAD_SELECT)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取每日线索失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取每日线索失败' },
          { status: 400 }
        )
      }

      logger.debug('获取每日线索成功', { id })
      return NextResponse.json({ data })
    }

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('daily_leads')
      .select('id', { count: 'exact', head: true })

    // 分页查询数据，按领取日期降序排序
    const { data, error } = await supabaseServer
      .from('daily_leads')
      .select(DAILY_LEAD_SELECT)
      .order('received_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取每日线索列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取每日线索列表失败' },
        { status: 400 }
      )
    }

    logger.debug('获取每日线索列表成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取每日线索异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取每日线索失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新每日线索
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bodySummary = summarizeDailyLeadPayload(body)

    logger.debug('创建每日线索 - 接收到的数据', { body_summary: bodySummary })

    // 后端验证：必填字段
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      logger.error('创建每日线索失败 - 姓名为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    if (!body.wechat_number || typeof body.wechat_number !== 'string' || !body.wechat_number.trim()) {
      logger.error('创建每日线索失败 - 微信号为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    if (!body.assigned_person || typeof body.assigned_person !== 'string' || !body.assigned_person.trim()) {
      logger.error('创建每日线索失败 - 归属人员为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '归属人员不能为空' },
        { status: 400 }
      )
    }

    if (!body.received_date) {
      logger.error('创建每日线索失败 - 领取日期为空', { body_summary: bodySummary })
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

    logger.debug('创建每日线索 - 准备插入的数据', {
      insert_summary: summarizeDailyLeadPayload(insertData),
    })

    const { data, error } = await supabaseServer
      .from('daily_leads')
      .insert(insertData)
      .select(DAILY_LEAD_SELECT)
      .single()

    if (error) {
      logger.error('创建每日线索失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建每日线索成功', { id: data.id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建每日线索异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建每日线索失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新每日线索
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body
    const updateSummary = summarizeDailyLeadPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少每日线索ID' },
        { status: 400 }
      )
    }

    logger.debug('更新每日线索 - 接收到的数据', { id, update_summary: updateSummary })

    // 后端验证：必填字段
    if (updateData.name !== undefined && (!updateData.name || !updateData.name.trim())) {
      logger.error('更新每日线索失败 - 姓名为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    if (updateData.wechat_number !== undefined && (!updateData.wechat_number || !updateData.wechat_number.trim())) {
      logger.error('更新每日线索失败 - 微信号为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    if (updateData.assigned_person !== undefined && (!updateData.assigned_person || !updateData.assigned_person.trim())) {
      logger.error('更新每日线索失败 - 归属人员为空', { id, update_summary: updateSummary })
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

    logger.debug('更新每日线索 - 准备更新的数据', {
      id,
      update_summary: summarizeDailyLeadPayload(updatePayload),
    })

    const { data, error } = await supabaseServer
      .from('daily_leads')
      .update(updatePayload)
      .eq('id', id)
      .select(DAILY_LEAD_SELECT)
      .single()

    if (error) {
      logger.error('更新每日线索失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新每日线索成功', { id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新每日线索异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新每日线索失败' },
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
      logger.error('删除每日线索失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除每日线索成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除每日线索异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除每日线索失败' },
      { status: 500 }
    )
  }
}
