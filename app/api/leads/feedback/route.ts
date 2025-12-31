import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { hasPermission } from '@/lib/permissions'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

const logger = createLogger('API:Leads:Feedback')

// POST: 反馈线索
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, add_status } = body

    if (!id) {
      return NextResponse.json(
        { error: '线索 ID 必填' },
        { status: 400 }
      )
    }

    if (!add_status) {
      return NextResponse.json(
        { error: '添加状态必填' },
        { status: 400 }
      )
    }

    // 获取当前用户
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    // 获取用户档案
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案不存在' },
        { status: 404 }
      )
    }

    // 检查反馈权限
    if (!hasPermission(profile.role, RESOURCES.leads, ACTIONS.feedback)) {
      logger.warn('反馈权限不足', {
        userId: profile.id,
        userRole: profile.role,
        leadId: id,
      })
      return NextResponse.json(
        { error: '权限不足', message: '只有销售可以反馈线索' },
        { status: 403 }
      )
    }

    // 获取线索信息，检查是否派给当前用户
    const { data: lead } = await supabaseServer
      .from('leads')
      .select('id, grab_user_id, grab_wechat')
      .eq('id', id)
      .single()

    if (!lead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    // 检查线索是否派给当前用户
    const isAssignedToMe = lead.grab_user_id === profile.id ||
      (lead.grab_wechat && lead.grab_wechat.includes(profile.name))

    if (!isAssignedToMe) {
      logger.warn('尝试反馈其他用户的线索', {
        userId: profile.id,
        userName: profile.name,
        leadId: id,
        leadGrabUserId: lead.grab_user_id,
        leadGrabWechat: lead.grab_wechat,
      })
      return NextResponse.json(
        { error: '权限不足', message: '只能反馈派给自己的线索' },
        { status: 403 }
      )
    }

    // 更新线索状态
    const { data: updatedLead, error } = await supabaseServer
      .from('leads')
      .update({
        add_status,
        updated_at: new Date().toISOString(),
        updated_by: profile.name,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('反馈线索失败', {
        leadId: id,
        addStatus: add_status,
        message: error.message,
        code: error.code,
      })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('反馈线索成功', {
      leadId: id,
      addStatus: add_status,
      updatedBy: profile.name,
    })

    return NextResponse.json({ data: updatedLead })
  } catch (error: any) {
    logger.error('反馈线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '反馈线索失败' },
      { status: 500 }
    )
  }
}
