import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { hasPermission } from '@/lib/permissions'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { isLeadAssignedToProfile } from '@/lib/server-lead-access'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'
import { batchCalculateLeadStatus } from '@/lib/status-calculator'

function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return payload?.sub || null
  } catch {
    return null
  }
}

const logger = createLogger('API:Leads:Feedback')
const VALID_ADD_STATUSES = new Set(['added', 'not_added'])

const LEAD_SELECT = `
  id,
  created_at,
  updated_at,
  report_number,
  entry_date,
  xhs_source,
  add_method_code,
  operator_id,
  grade_code,
  channel_platform,
  customer_social_id,
  subject_codes,
  region_ip,
  parent_wechat,
  chat_screenshots,
  duplicate_mark,
  collision_operator,
  grab_wechat,
  grab_user_id,
  add_feedback,
  feedback_time,
  add_status,
  conversion_status,
  created_by,
  updated_by
`

const LEAD_FALLBACK_SELECT = `
  id,
  created_at,
  updated_at,
  report_number,
  entry_date,
  xhs_source,
  add_method_code,
  operator_id,
  grade_code,
  subject_codes,
  region_ip,
  parent_wechat,
  chat_screenshots,
  duplicate_mark,
  collision_operator,
  grab_wechat,
  grab_user_id,
  add_feedback,
  feedback_time,
  add_status,
  conversion_status,
  created_by,
  updated_by
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isMissingLeadColumnError(error: unknown) {
  if (!isRecord(error)) return false
  const code = typeof error.code === 'string' ? error.code : ''
  const message = typeof error.message === 'string' ? error.message : ''

  return code === '42703' &&
    (message.includes('channel_platform') || message.includes('customer_social_id'))
}

function countScreenshotRefs(value: unknown) {
  if (typeof value !== 'string') return 0
  return value.split(',').filter((item) => item.trim()).length
}

async function enrichLeadStatus(lead: any) {
  const [status] = await batchCalculateLeadStatus([lead])
  if (!status) return lead

  return {
    ...lead,
    add_status: status.addStatus,
    add_status_name: status.addStatusName,
    convert_status: status.convertStatus,
    convert_status_name: status.convertStatusName,
  }
}

// POST: 反馈线索
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, add_status, chat_screenshots } = body

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

    if (!VALID_ADD_STATUSES.has(add_status)) {
      return NextResponse.json(
        { error: '添加状态只能为已添加或未添加' },
        { status: 400 }
      )
    }

    // 获取当前用户
    const token = getRequestAccessToken(request)

    const userId = token ? decodeJwtUserId(token) : null

    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const profileResult = await getActiveUserProfile(userId, { accessToken: token || '' })
    if (profileResult.ok === false) {
      logger.warn('反馈线索用户档案校验失败', {
        userId,
        code: profileResult.code,
      })
      return NextResponse.json(
        { error: profileResult.error, code: profileResult.code },
        { status: profileResult.status }
      )
    }
    const profile = profileResult.profile

    // 检查反馈权限
    if (!hasPermission(profile.role as Role | undefined, RESOURCES.leads, ACTIONS.feedback)) {
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
    const { data: lead, error: leadError } = await supabaseServer
      .from('leads')
      .select('id, grab_user_id, grab_wechat')
      .eq('id', id)
      .single()

    if (leadError || !lead) {
      if (leadError) {
        logger.warn('反馈线索前查询失败', {
          leadId: id,
          userId: profile.id,
          role: profile.role,
          ...summarizeError(leadError),
        })
      }

      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    // 检查线索是否派给当前用户
    const isAssignedToMe = isLeadAssignedToProfile(lead, profile)

    if (!isAssignedToMe) {
      logger.warn('尝试反馈其他用户的线索', {
        userId: profile.id,
        userRole: profile.role,
        leadId: id,
        leadHasGrabUserId: Boolean(lead.grab_user_id),
        leadHasGrabWechat: Boolean(lead.grab_wechat),
      })
      return NextResponse.json(
        { error: '权限不足', message: '只能反馈派给自己的线索' },
        { status: 403 }
      )
    }

    // 更新线索状态
    const updateData: any = {
      add_status,
      updated_at: new Date().toISOString(),
      updated_by: profile.name,
    }

    // 如果提供了截图，则更新截图字段
    if (chat_screenshots !== undefined) {
      updateData.chat_screenshots = chat_screenshots
    }

    let updatedLead: any = null
    let error: any = null
    const updateResult = await supabaseServer
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select(LEAD_SELECT)
      .single()
    updatedLead = updateResult.data
    error = updateResult.error

    if (error && isMissingLeadColumnError(error)) {
      const fallbackResult = await supabaseServer
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .select(LEAD_FALLBACK_SELECT)
        .single()

      updatedLead = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('反馈线索失败', {
        leadId: id,
        addStatus: add_status,
        hasChatScreenshots: chat_screenshots !== undefined,
        chatScreenshotCount: countScreenshotRefs(chat_screenshots),
        userId: profile.id,
        role: profile.role,
        ...summarizeError(error),
      })
      return NextResponse.json(
        { error: '反馈线索失败' },
        { status: 400 }
      )
    }

    logger.info('反馈线索成功', {
      leadId: id,
      addStatus: add_status,
      hasChatScreenshots: chat_screenshots !== undefined,
      chatScreenshotCount: countScreenshotRefs(chat_screenshots),
      userId: profile.id,
      role: profile.role,
    })

    return NextResponse.json({ data: await enrichLeadStatus(updatedLead) })
  } catch (error) {
    logger.error('反馈线索异常', summarizeError(error))
    return NextResponse.json(
      { error: '反馈线索失败' },
      { status: 500 }
    )
  }
}
