import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'
import { isLeadAssignedToProfile } from '@/lib/server-lead-access'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:LeadsRelease')

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

function normalizeStatus(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function hasHandledAddStatus(value: unknown) {
  const status = normalizeStatus(value)
  return status === 'added' || status === 'not_added'
}

function hasConversionStatus(value: unknown) {
  const status = normalizeStatus(value)
  return Boolean(status) && status !== 'empty' && status !== 'none'
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或权限不足' }, { status: 403 })
    }
    if (profile.role !== 'sales') {
      return NextResponse.json({ error: '仅销售可放回线索池' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body || {}
    if (!id) {
      return NextResponse.json({ error: '缺少线索ID' }, { status: 400 })
    }

    const { data: lead, error: fetchErr } = await supabaseServer
      .from('leads')
      .select('id, grab_user_id, grab_wechat, add_status, conversion_status')
      .eq('id', id)
      .single()
    if (fetchErr || !lead) {
      if (fetchErr) {
        logger.warn('释放线索前查询失败', {
          leadId: id,
          userId: profile.id,
          ...summarizeError(fetchErr),
        })
      }
      return NextResponse.json({ error: '线索不存在' }, { status: 404 })
    }

    // 仅允许释放自己的线索
    const isMine = isLeadAssignedToProfile(lead, profile)
    if (!isMine) {
      return NextResponse.json({ error: '只能释放自己抢到的线索' }, { status: 403 })
    }

    if (hasHandledAddStatus(lead.add_status) || hasConversionStatus(lead.conversion_status)) {
      return NextResponse.json({ error: '线索已处理，不能再丢弃' }, { status: 400 })
    }

    let data: any = null
    let error: any = null
    const releaseResult = await supabaseServer
      .from('leads')
      .update({
        grab_user_id: null,
        grab_wechat: null,
        add_status: null,
        add_feedback: null,
        feedback_time: null,
        conversion_status: null,
        updated_at: new Date().toISOString(),
        updated_by: profile.name,
      })
      .eq('id', id)
      .select(LEAD_SELECT)
      .single()
    data = releaseResult.data
    error = releaseResult.error

    if (error && isMissingLeadColumnError(error)) {
      const fallbackResult = await supabaseServer
        .from('leads')
        .update({
          grab_user_id: null,
          grab_wechat: null,
          add_status: null,
          add_feedback: null,
          feedback_time: null,
          conversion_status: null,
          updated_at: new Date().toISOString(),
          updated_by: profile.name,
        })
        .eq('id', id)
        .select(LEAD_FALLBACK_SELECT)
        .single()

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('释放线索失败', {
        leadId: id,
        userId: profile.id,
        ...summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('释放线索成功', { leadId: id, userId: profile.id })
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('释放线索异常', summarizeError(error))
    return NextResponse.json({ error: '释放线索失败' }, { status: 500 })
  }
}
