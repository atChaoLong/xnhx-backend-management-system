import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:LeadsGrab')

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

export async function POST(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或权限不足' }, { status: 403 })
    }
    if (profile.role !== 'sales') {
      return NextResponse.json({ error: '仅销售可抢单' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body || {}
    if (!id) {
      return NextResponse.json({ error: '缺少线索ID' }, { status: 400 })
    }

    const { data: lead, error: fetchErr } = await supabaseServer
      .from('leads')
      .select('id, grab_user_id, grab_wechat')
      .eq('id', id)
      .single()
    if (fetchErr || !lead) {
      if (fetchErr) {
        logger.warn('抢单前查询线索失败', {
          leadId: id,
          userId: profile.id,
          ...summarizeError(fetchErr),
        })
      }
      return NextResponse.json({ error: '线索不存在' }, { status: 404 })
    }

    if (lead.grab_user_id || (lead.grab_wechat && lead.grab_wechat.trim() !== '')) {
      return NextResponse.json({ error: '线索已被抢单' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('leads')
      .update({
        grab_user_id: profile.id,
        grab_wechat: profile.name,
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

    if (error) {
      logger.error('抢单失败', {
        leadId: id,
        userId: profile.id,
        ...summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 记录抢单日志
    const { error: logError } = await supabaseServer
      .from('lead_grab_logs')
      .insert({
        lead_id: id,
        report_number: data?.report_number || null,
        sales_user_id: profile.id,
        sales_user_name: profile.name || '未知用户',
        grab_wechat: profile.name || null,
      })

    if (logError) {
      logger.warn('记录抢单日志失败', {
        leadId: id,
        userId: profile.id,
        ...summarizeError(logError),
      })
    }

    logger.info('抢单成功', { leadId: id, userId: profile.id })
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('抢单异常', summarizeError(error))
    return NextResponse.json({ error: '抢单失败' }, { status: 500 })
  }
}
