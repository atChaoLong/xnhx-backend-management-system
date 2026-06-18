import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getCurrentProfile, isAdmin, type CurrentProfile } from "@/lib/server-data-scope"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:WechatAccounts')

const WECHAT_ACCOUNT_PUBLIC_SELECT = 'id,created_at,updated_at,priority,wechat_id,wechat_name,responsible_consultant,team,account_type,phone,real_name_person,status'

type AdminAccess =
  | { profile: CurrentProfile; response?: never }
  | { profile?: never; response: NextResponse }

function summarizeWechatAccountPayload(payload: Record<string, unknown>) {
  return {
    fields: Object.keys(payload),
    hasWechatId: typeof payload.wechat_id === 'string' && payload.wechat_id.trim().length > 0,
    hasLoginPassword: typeof payload.login_password === 'string' && payload.login_password.trim().length > 0,
    hasPaymentPassword: typeof payload.payment_password === 'string' && payload.payment_password.trim().length > 0,
  }
}

async function requireAdminProfile(request: NextRequest): Promise<AdminAccess> {
  const profile = await getCurrentProfile(request)

  if (!profile) {
    return {
      response: NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      ),
    }
  }

  if (!isAdmin(profile)) {
    logger.warn('拒绝访问废弃微信号管理接口', {
      userId: profile.id,
      role: profile.role,
    })
    return {
      response: NextResponse.json(
        { error: '无权访问微信号管理' },
        { status: 403 }
      ),
    }
  }

  return { profile }
}

// GET: 获取微信号列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminProfile(request)
    if (access.response) return access.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    logger.debug('获取微信号数据', { id })

    // 如果提供了ID，查询单个微信号
    if (id) {
      const { data, error } = await supabaseServer
        .from('wechat_accounts')
        .select(WECHAT_ACCOUNT_PUBLIC_SELECT)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取微信号失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取微信号失败' },
          { status: 400 }
        )
      }

      logger.debug('获取微信号成功', { id })
      return NextResponse.json({ data })
    }

    // 否则获取所有微信号，按优先级降序排序
    const { data, error } = await supabaseServer
      .from('wechat_accounts')
      .select(WECHAT_ACCOUNT_PUBLIC_SELECT)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('获取微信号列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取微信号列表失败' },
        { status: 400 }
      )
    }

    logger.debug('获取微信号列表成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取微信号异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取微信号失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新微信号
export async function POST(request: NextRequest) {
  try {
    const access = await requireAdminProfile(request)
    if (access.response) return access.response

    const body = await request.json()

    const bodySummary = summarizeWechatAccountPayload(body)

    logger.debug('创建微信号 - 接收到的数据', bodySummary)

    // 后端验证：必填字段
    if (!body.wechat_id || typeof body.wechat_id !== 'string' || !body.wechat_id.trim()) {
      logger.error('创建微信号失败 - 微信号为空', bodySummary)
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    if (!body.wechat_name || typeof body.wechat_name !== 'string' || !body.wechat_name.trim()) {
      logger.error('创建微信号失败 - 微信昵称为空', bodySummary)
      return NextResponse.json(
        { error: '微信昵称不能为空' },
        { status: 400 }
      )
    }

    if (!body.account_type || typeof body.account_type !== 'string' || !body.account_type.trim()) {
      logger.error('创建微信号失败 - 账号类型为空', bodySummary)
      return NextResponse.json(
        { error: '账号类型不能为空' },
        { status: 400 }
      )
    }

    if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
      logger.error('创建微信号失败 - 手机号为空', bodySummary)
      return NextResponse.json(
        { error: '手机号不能为空' },
        { status: 400 }
      )
    }

    if (!body.login_password || typeof body.login_password !== 'string' || !body.login_password.trim()) {
      logger.error('创建微信号失败 - 登录密码为空', bodySummary)
      return NextResponse.json(
        { error: '登录密码不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_password || typeof body.payment_password !== 'string' || !body.payment_password.trim()) {
      logger.error('创建微信号失败 - 支付密码为空', bodySummary)
      return NextResponse.json(
        { error: '支付密码不能为空' },
        { status: 400 }
      )
    }

    if (!body.real_name_person || typeof body.real_name_person !== 'string' || !body.real_name_person.trim()) {
      logger.error('创建微信号失败 - 实人名为空', bodySummary)
      return NextResponse.json(
        { error: '实名人不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      priority: body.priority !== undefined ? body.priority : 0,
      wechat_id: body.wechat_id.trim(),
      wechat_name: body.wechat_name.trim(),
      responsible_consultant: body.responsible_consultant?.trim() || null,
      team: body.team?.trim() || null,
      account_type: body.account_type.trim(),
      phone: body.phone.trim(),
      login_password: body.login_password.trim(),
      payment_password: body.payment_password.trim(),
      real_name_person: body.real_name_person.trim(),
      status: body.status || 'active',
    }

    logger.debug('创建微信号 - 准备插入的数据', {
      fields: Object.keys(insertData),
      hasLoginPassword: true,
      hasPaymentPassword: true,
    })

    const { data, error } = await supabaseServer
      .from('wechat_accounts')
      .insert(insertData)
      .select(WECHAT_ACCOUNT_PUBLIC_SELECT)
      .single()

    if (error) {
      logger.error('创建微信号失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建微信号成功', { id: data.id, wechat_id: data.wechat_id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建微信号异常', summarizeError(error))
    return NextResponse.json(
      { error: '创建微信号失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新微信号
export async function PUT(request: NextRequest) {
  try {
    const access = await requireAdminProfile(request)
    if (access.response) return access.response

    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少微信号ID' },
        { status: 400 }
      )
    }

    const updateSummary = {
      id,
      fields: Object.keys(updateData),
      hasLoginPassword: updateData.login_password !== undefined,
      hasPaymentPassword: updateData.payment_password !== undefined,
    }

    logger.debug('更新微信号 - 接收到的数据', updateSummary)

    // 后端验证：必填字段
    if (updateData.wechat_id !== undefined && (!updateData.wechat_id || !updateData.wechat_id.trim())) {
      logger.error('更新微信号失败 - 微信号为空', updateSummary)
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'priority', 'wechat_id', 'wechat_name', 'responsible_consultant',
      'team', 'account_type', 'phone', 'real_name_person', 'status'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = typeof updateData[field] === 'string'
          ? updateData[field].trim()
          : updateData[field]
      }
    })

    ;(['login_password', 'payment_password'] as const).forEach(field => {
      const value = updateData[field]
      if (typeof value === 'string' && value.trim()) {
        updatePayload[field] = value.trim()
      }
    })

    logger.debug('更新微信号 - 准备更新的数据', {
      id,
      fields: Object.keys(updatePayload),
      hasLoginPassword: updatePayload.login_password !== undefined,
      hasPaymentPassword: updatePayload.payment_password !== undefined,
    })

    const { data, error } = await supabaseServer
      .from('wechat_accounts')
      .update(updatePayload)
      .eq('id', id)
      .select(WECHAT_ACCOUNT_PUBLIC_SELECT)
      .single()

    if (error) {
      logger.error('更新微信号失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新微信号成功', { id, wechat_id: data.wechat_id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新微信号异常', summarizeError(error))
    return NextResponse.json(
      { error: '更新微信号失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除微信号
export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAdminProfile(request)
    if (access.response) return access.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少微信号ID' },
        { status: 400 }
      )
    }

    logger.debug('删除微信号', { id })

    const { error } = await supabaseServer
      .from('wechat_accounts')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除微信号失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除微信号成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除微信号异常', summarizeError(error))
    return NextResponse.json(
      { error: '删除微信号失败' },
      { status: 500 }
    )
  }
}
