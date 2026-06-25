import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'
import { getCurrentProfile } from '@/lib/server-data-scope'
import {
  isLeadAssignedToProfile,
  isLeadCreatedByProfile,
  isUnassignedLead,
} from '@/lib/server-lead-access'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:Leads:Detail')

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

function canAccessLead(
  lead: any,
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  relatedLeadIds: string[] = []
) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  const meName = profile.name || ''

  if (profile.role === 'operator') {
    return lead.operator_id === profile.id || lead.created_by === meName
  }

  if (profile.role === 'sales') {
    return isUnassignedLead(lead) ||
      isLeadAssignedToProfile(lead, profile) ||
      isLeadCreatedByProfile(lead, profile)
  }

  if (profile.role === 'head_teacher') {
    if (isLeadCreatedByProfile(lead, profile)) return true
    return relatedLeadIds.includes(lead.id)
  }

  return false
}

function maskLeadForProfile(lead: any, profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  if (!profile || profile.role !== 'sales') return lead
  const isMine = isLeadAssignedToProfile(lead, profile) || isLeadCreatedByProfile(lead, profile)

  if (isMine) return lead
  return { ...lead, parent_wechat: null, chat_screenshots: null, customer_social_id: null }
}

// GET: 获取单个线索详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    logger.debug('获取线索详情', { leadId: id })
    const profile = await getCurrentProfile(request)

    let relatedLeadIds: string[] = []
    if (profile?.role === 'head_teacher') {
      const { data: students } = await supabaseServer
        .from('students')
        .select('id')
        .eq('head_teacher_id', profile.id)
      const studentIds = (students || []).map((s: any) => s.id).filter(Boolean)
      if (studentIds.length > 0) {
        const { data: orders } = await supabaseServer
          .from('formal_orders')
          .select('lead_id')
          .in('student_id', studentIds)
        relatedLeadIds = Array.from(new Set((orders || []).map((o: any) => o.lead_id).filter(Boolean)))
      }
    }

    let data: any = null
    let error: any = null
    const leadResult = await supabaseServer
      .from('leads')
      .select(LEAD_SELECT)
      .eq('id', id)
      .single()
    data = leadResult.data
    error = leadResult.error

    if (error && isMissingLeadColumnError(error)) {
      const fallbackResult = await supabaseServer
        .from('leads')
        .select(LEAD_FALLBACK_SELECT)
        .eq('id', id)
        .single()

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('获取线索详情失败', {
        leadId: id,
        ...summarizeError(error),
      })
      return NextResponse.json(
        { error: '获取线索详情失败' },
        { status: 400 }
      )
    }

    if (!data) {
      logger.warn('线索不存在', { leadId: id })
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    if (!canAccessLead(data, profile, relatedLeadIds)) {
      return NextResponse.json({ error: '无权访问该线索' }, { status: 403 })
    }

    logger.debug('获取线索详情成功', { leadId: id })
    return NextResponse.json({ data: maskLeadForProfile(data, profile) })
  } catch (error) {
    logger.error('获取线索详情异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取线索详情失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除线索
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    logger.info('删除线索', { leadId: id })

    const profile = await getCurrentProfile(request)

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin') {
      logger.warn('删除线索失败 - 非管理员尝试删除', {
        leadId: id,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '只有管理员可以删除线索' },
        { status: 403 }
      )
    }

    const { data: existingLead, error: existingLeadError } = await supabaseServer
      .from('leads')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (existingLeadError) {
      logger.error('删除线索前查询失败', {
        leadId: id,
        ...summarizeError(existingLeadError),
      })
      const { message, status } = handleDatabaseError(existingLeadError)
      return NextResponse.json({ error: message }, { status })
    }

    if (!existingLead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    const { error } = await supabaseServer
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除线索失败', {
        leadId: id,
        ...summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除线索成功', { leadId: id })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('删除线索异常', summarizeError(error))
    return NextResponse.json(
      { error: '删除线索失败' },
      { status: 500 }
    )
  }
}
