import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'
import { batchCalculateLeadStatus, calculateLeadAddStatusFromFlags, calculateLeadConvertStatusFromFlags, getLeadAddStatusName, getLeadConvertStatusName } from '@/lib/status-calculator'
import { getCurrentProfile } from '@/lib/server-data-scope'
import {
  isLeadAssignedToProfile,
  leadCreatedByEqualsProfileFilter,
  leadGrabWechatEqualsProfileFilter,
} from '@/lib/server-lead-access'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:Leads')
const LEAD_REPORT_RPC_TIMEOUT_MS = 2500
const LEAD_DUPLICATE_CHECK_TIMEOUT_MS = 2500
const LEAD_REPORT_NUMBER_MAX_LENGTH = 20
const LEAD_REPORT_PREFIX_MAX_LENGTH = 10

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

const LEAD_SELECT_NESTED = `${LEAD_SELECT},
  trial_lessons(lead_id),
  formal_orders(lead_id)
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

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingLeadColumnError(error: unknown) {
  const err = isRecord(error) ? error : {}
  const code = String(err.code || '')
  const message = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase()

  return code === '42703' ||
    code === 'PGRST204' ||
    (message.includes('column') && message.includes('does not exist')) ||
    message.includes('could not find') ||
    message.includes('schema cache') ||
    message.includes('relationship')
}

function countScreenshotRefs(value: unknown) {
  if (typeof value !== 'string') return 0
  return value.split(',').filter((item) => item.trim()).length
}

function summarizeLeadPayload(payload: Record<string, any>) {
  return {
    has_channel_platform: Boolean(payload.channel_platform),
    has_customer_social_id: Boolean(payload.customer_social_id),
    has_parent_wechat: Boolean(payload.parent_wechat),
    chat_screenshot_count: countScreenshotRefs(payload.chat_screenshots),
    subject_count: Array.isArray(payload.subject_codes) ? payload.subject_codes.length : 0,
  }
}

let operatorCache: { data: Map<string, string>, expiry: number } | null = null
const OPERATOR_CACHE_TTL = 60000

const countCache = new Map<string, { count: number, expiry: number }>()
const COUNT_CACHE_TTL = 30000

function getCountCacheKey(scope: string | null, profileId: string): string {
  return `${scope || 'default'}:${profileId}`
}

function clearAllCountCache() {
  countCache.clear()
}

async function getOperatorMap(): Promise<Map<string, string>> {
  if (operatorCache && Date.now() < operatorCache.expiry) {
    return operatorCache.data
  }
  const { data, error } = await supabaseServer
    .from('user_profiles')
    .select('id, name')
  if (error) {
    logger.warn('获取运营人员列表失败', summarizeError(error))
    return operatorCache?.data || new Map()
  }
  const map = new Map<string, string>()
  if (data) {
    data.forEach(op => map.set(op.id, op.name))
  }
  operatorCache = { data: map, expiry: Date.now() + OPERATOR_CACHE_TTL }
  return map
}

function stripLeadChannelFields<T extends Record<string, any>>(payload: T) {
  const {
    channel_platform: _channelPlatform,
    customer_social_id: _customerSocialId,
    ...fallbackPayload
  } = payload

  return fallbackPayload
}

async function getHeadTeacherFormalLeadIds(profile: Awaited<ReturnType<typeof getCurrentProfile>>): Promise<string[]> {
  if (!profile || profile.role !== 'head_teacher') return []

  const { data: students, error: studentsError } = await supabaseServer
    .from('students')
    .select('id')
    .eq('head_teacher_id', profile.id)

  if (studentsError) {
    logger.warn('查询班主任负责学生失败，线索列表仅返回直接归属线索', summarizeError(studentsError))
    return []
  }

  const studentIds = (students || []).map((student: any) => student.id).filter(Boolean)
  if (studentIds.length === 0) return []

  const { data: orders, error: ordersError } = await supabaseServer
    .from('formal_orders')
    .select('lead_id')
    .in('student_id', studentIds)

  if (ordersError) {
    logger.warn('查询班主任负责学生关联订单失败，线索列表仅返回直接归属线索', summarizeError(ordersError))
    return []
  }

  return Array.from(new Set(
    (orders || [])
      .map((order: any) => order.lead_id)
      .filter(Boolean)
  ))
}

function applyLeadScope(
  query: any,
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  relatedLeadIds: string[] = []
) {
  if (!profile) return query.eq('id', '00000000-0000-0000-0000-000000000000')
  if (profile.role === 'admin') return query

  const meId = profile.id
  const meName = profile.name || ''

  if (profile.role === 'operator') {
    return query.or([
      `operator_id.eq.${meId}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  }

  if (profile.role === 'sales') {
    return query.or([
      `grab_user_id.eq.${meId}`,
      leadGrabWechatEqualsProfileFilter(profile),
      leadCreatedByEqualsProfileFilter(profile),
    ].filter(Boolean).join(','))
  }

  if (profile.role === 'head_teacher') {
    const filters = [
      `operator_id.eq.${meId}`,
      `grab_user_id.eq.${meId}`,
      meName ? `created_by.eq.${meName}` : '',
      relatedLeadIds.length > 0 ? `id.in.(${relatedLeadIds.join(',')})` : '',
    ].filter(Boolean)

    if (filters.length === 0) return query.eq('id', '00000000-0000-0000-0000-000000000000')
    return query.or(filters.join(','))
  }

  return query.eq('id', '00000000-0000-0000-0000-000000000000')
}

function applyLeadWriteScope(query: any, profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  if (!profile) return query.eq('id', '00000000-0000-0000-0000-000000000000')
  if (profile.role === 'admin') return query

  const meId = profile.id
  const meName = profile.name || ''

  if (profile.role === 'operator') {
    return query.or([
      `operator_id.eq.${meId}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  }

  if (profile.role === 'sales') {
    return query.or([
      `grab_user_id.eq.${meId}`,
      leadGrabWechatEqualsProfileFilter(profile),
      leadCreatedByEqualsProfileFilter(profile),
    ].filter(Boolean).join(','))
  }

  if (profile.role === 'head_teacher') {
    return query.or([
      `operator_id.eq.${meId}`,
      `grab_user_id.eq.${meId}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  }

  return query.eq('id', '00000000-0000-0000-0000-000000000000')
}

function applyPublicLeadScope(query: any) {
  return query
    .is('grab_user_id', null)
    .or('grab_wechat.is.null,grab_wechat.eq.')
}

function maskLeadForProfile(lead: any, profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  if (!profile || profile.role !== 'sales') return lead

  const isMine = isLeadAssignedToProfile(lead, profile)

  if (isMine) return lead

  return {
    ...lead,
    parent_wechat: null,
    chat_screenshots: null,
    customer_social_id: null,
  }
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function sanitizeReportNumberPrefix(value?: string) {
  const prefix = String(value || 'LEAD')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()

  return (prefix || 'LEAD').slice(0, LEAD_REPORT_PREFIX_MAX_LENGTH)
}

function buildLeadReportNumber(prefixValue: string | undefined, suffixValue: string | number) {
  const prefix = sanitizeReportNumberPrefix(prefixValue)
  const suffix = String(suffixValue)
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '')
    .toUpperCase()
  const maxSuffixLength = LEAD_REPORT_NUMBER_MAX_LENGTH - prefix.length - 1

  return `${prefix}_${suffix.slice(-Math.max(maxSuffixLength, 1))}`
}

function normalizeLeadReportNumber(value: unknown, fallbackPrefix?: string) {
  const reportNumber = String(value || '').trim().toUpperCase()
  if (reportNumber && reportNumber.length <= LEAD_REPORT_NUMBER_MAX_LENGTH) {
    return reportNumber
  }

  const suffixMatch = reportNumber.match(/([A-Z0-9]+)$/)
  return buildLeadReportNumber(fallbackPrefix, suffixMatch?.[1] || Date.now().toString(36))
}

function createTimeoutError(label: string, timeoutMs: number) {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`)
  error.name = 'QueryTimeoutError'
  return error
}

async function withSoftTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function generateLeadReportNumber(channelCode?: string) {
  let data: any = null
  let error: any = null
  const normalizedChannelCode = sanitizeReportNumberPrefix(channelCode)

  try {
    const result = await withSoftTimeout(
      supabaseServer.rpc('generate_lead_report_number', {
        channel_code: normalizedChannelCode || null,
      }),
      LEAD_REPORT_RPC_TIMEOUT_MS,
      'generate_lead_report_number'
    )
    data = result.data
    error = result.error
  } catch (rpcError) {
    error = rpcError
  }

  if (!error && data) {
    const reportNumber = normalizeLeadReportNumber(data, normalizedChannelCode)
    if (String(data).trim().length > LEAD_REPORT_NUMBER_MAX_LENGTH) {
      logger.warn('线索编号超出数据库长度限制，已截断前缀', {
        originalLength: String(data).trim().length,
        normalizedLength: reportNumber.length,
      })
    }
    return reportNumber
  }

  logger.warn('生成线索编号 RPC 失败，使用兜底编号', {
    hasChannelCode: Boolean(channelCode),
    ...summarizeError(error),
  })

  return buildLeadReportNumber(normalizedChannelCode, Date.now().toString(36))
}

async function findDuplicateLead(
  channelPlatform?: string | null,
  customerSocialId?: string | null,
  excludeId?: string
) {
  if (!channelPlatform || !customerSocialId) return null

  let query = supabaseServer
    .from('leads')
    .select('id, report_number, operator_id, created_by')
    .eq('channel_platform', channelPlatform)
    .eq('customer_social_id', customerSocialId)
    .limit(1)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  let data: any = null
  let error: any = null

  try {
    const result = await withSoftTimeout(
      query.maybeSingle(),
      LEAD_DUPLICATE_CHECK_TIMEOUT_MS,
      'find_duplicate_lead'
    )
    data = result.data
    error = result.error
  } catch (queryError) {
    error = queryError
  }

  if (error) {
    logger.warn('查询重复线索失败', {
      hasChannelPlatform: Boolean(channelPlatform),
      hasCustomerSocialId: Boolean(customerSocialId),
      excludeId,
      ...summarizeError(error),
    })
    return null
  }

  return data
}

function formatDuplicateCollision(lead: any) {
  return lead?.created_by || lead?.report_number || lead?.operator_id || '已有线索'
}

function buildLeadQueries(
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  scope: string | null,
  selectFields: string,
  relatedLeadIds: string[] = []
) {
  let baseCountQuery = supabaseServer
    .from('leads')
    .select('id', { count: 'exact', head: true })
  let baseDataQuery = supabaseServer
    .from('leads')
    .select(selectFields)

  if (scope === 'public') {
    if (profile?.role === 'sales' || profile?.role === 'admin') {
      baseCountQuery = applyPublicLeadScope(baseCountQuery)
      baseDataQuery = applyPublicLeadScope(baseDataQuery)
    } else {
      baseCountQuery = baseCountQuery.eq('id', '00000000-0000-0000-0000-000000000000')
      baseDataQuery = baseDataQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  } else if (scope === 'owned') {
    baseCountQuery = applyLeadWriteScope(baseCountQuery, profile)
    baseDataQuery = applyLeadWriteScope(baseDataQuery, profile)
  } else {
    baseCountQuery = applyLeadScope(baseCountQuery, profile, relatedLeadIds)
    baseDataQuery = applyLeadScope(baseDataQuery, profile, relatedLeadIds)
  }

  return { baseCountQuery, baseDataQuery }
}

// GET: 获取所有线索
export async function getLeadsResponse(request: NextRequest, fixedScope?: string) {
  try {
    const t0 = Date.now()
    logger.debug('获取线索列表')

    // 获取分页参数
    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const scope = fixedScope || searchParams.get('scope')

    // 当前用户档案（用于销售角色筛选）
    const profile = await getCurrentProfile(request)
    const relatedLeadIds = await getHeadTeacherFormalLeadIds(profile)
    const t1 = Date.now()

    // 优先使用 nested select（trial_lessons/formal_orders 内联），减少 Supabase 往返次数
    let { baseCountQuery, baseDataQuery } = buildLeadQueries(profile, scope, LEAD_SELECT_NESTED, relatedLeadIds)

    // count 查询有 30s 缓存，缓存命中时只发 data 查询（1 次往返）
    const countKey = getCountCacheKey(scope, profile?.id || 'unknown')
    const cachedCount = countCache.get(countKey)
    const countPromise = cachedCount && Date.now() < cachedCount.expiry
      ? Promise.resolve({ count: cachedCount.count })
      : baseCountQuery.then(res => {
          if (res.count !== null && res.count !== undefined) {
            countCache.set(countKey, { count: res.count, expiry: Date.now() + COUNT_CACHE_TTL })
          }
          return res
        })

    // Round 1: count(可能缓存) + data + operatorMap 全部并行
    const [
      { count: totalCount },
      dataResult,
      operatorMap,
    ] = await Promise.all([
      countPromise,
      baseDataQuery
        .order('created_at', { ascending: false })
        .range(from, to),
      getOperatorMap(),
    ])
    const t2 = Date.now()

    let { data, error } = dataResult
    let usedNestedSelect = !error

    // nested select 失败（FK 不存在等），回退到基础字段 + 独立状态查询
    if (error && isMissingLeadColumnError(error)) {
      logger.warn('nested select 失败，回退到基础字段 + 独立状态查询', summarizeError(error))
      const fallbackQueries = buildLeadQueries(profile, scope, LEAD_FALLBACK_SELECT, relatedLeadIds)
      const fallbackResult = await fallbackQueries.baseDataQuery
        .order('created_at', { ascending: false })
        .range(from, to)
      data = fallbackResult.data
      error = fallbackResult.error
      usedNestedSelect = false
    }

    if (error) {
      logger.error('获取线索失败', summarizeError(error))
      return NextResponse.json(
        { error: '获取线索失败' },
        { status: 400 }
      )
    }

    // 计算线索状态
    const leadsWithStatus = []
    const leadRows = Array.isArray(data) ? data as Record<string, any>[] : []
    if (leadRows.length > 0) {
      let statusResults: { addStatus: any; convertStatus: any; addStatusName: string; convertStatusName: string }[]

      if (usedNestedSelect) {
        // 从 nested select 数据本地计算状态，零额外查询
        statusResults = leadRows.map(lead => {
          const hasTrialLesson = Array.isArray(lead.trial_lessons) && lead.trial_lessons.length > 0
          const hasFormalOrder = Array.isArray(lead.formal_orders) && lead.formal_orders.length > 0
          const addStatus = calculateLeadAddStatusFromFlags(lead, hasTrialLesson)
          const convertStatus = calculateLeadConvertStatusFromFlags(hasTrialLesson, hasFormalOrder)
          return {
            addStatus,
            convertStatus,
            addStatusName: getLeadAddStatusName(addStatus),
            convertStatusName: getLeadConvertStatusName(convertStatus),
          }
        })
      } else {
        // 回退路径：独立查询 trial_lessons + formal_orders
        statusResults = await batchCalculateLeadStatus(leadRows)
      }
      const t3 = Date.now()

      // 合并状态到数据
      for (let i = 0; i < leadRows.length; i++) {
        const lead = leadRows[i]
        const status = statusResults[i]

        const { trial_lessons: _tl, formal_orders: _fo, ...leadFields } = lead

        leadsWithStatus.push(maskLeadForProfile({
          ...leadFields,
          add_status: status.addStatus,
          add_status_name: status.addStatusName,
          convert_status: status.convertStatus,
          convert_status_name: status.convertStatusName,
          operator_name: operatorMap.get(lead.operator_id) || lead.operator_id,
        }, profile))
      }

      logger.info('获取线索成功', {
        count: leadsWithStatus.length || 0,
        nested: usedNestedSelect,
        timing: {
          profile_related: `${t1 - t0}ms`,
          round1: `${t2 - t1}ms`,
          status: `${t3 - t2}ms`,
          total: `${t3 - t0}ms`,
        },
      })
    } else {
      logger.info('获取线索成功', {
        count: 0,
        nested: usedNestedSelect,
        timing: {
          profile_related: `${t1 - t0}ms`,
          round1: `${t2 - t1}ms`,
          total: `${t2 - t0}ms`,
        },
      })
    }

    return NextResponse.json({
      data: leadsWithStatus,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error) {
    logger.error('获取线索异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取线索失败' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return getLeadsResponse(request)
}

// POST: 创建新线索
export async function POST(request: NextRequest) {
  try {
    const rawLeadData = await request.json()
    const leadData: Record<string, any> = isRecord(rawLeadData) ? { ...rawLeadData } : {}

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或用户档案不存在' }, { status: 401 })
    }
    const currentUser = profile.name || '未知用户'

    const scopedLeadData = { ...leadData }
    scopedLeadData.channel_platform = normalizeOptionalText(scopedLeadData.channel_platform)
    scopedLeadData.customer_social_id = normalizeOptionalText(scopedLeadData.customer_social_id)

    const reportNumber = await generateLeadReportNumber(scopedLeadData.channel_platform || scopedLeadData.xhs_source)
    delete scopedLeadData.report_number
    delete scopedLeadData.duplicate_mark
    delete scopedLeadData.collision_operator

    const duplicateLead = await findDuplicateLead(
      scopedLeadData.channel_platform,
      scopedLeadData.customer_social_id
    )

    logger.info('创建新线索', {
      orderSerial: reportNumber,
      userId: profile.id,
      role: profile.role,
      ...summarizeLeadPayload(scopedLeadData),
    })

    if (profile?.role === 'sales' || profile?.role === 'head_teacher') {
      scopedLeadData.operator_id = profile.id
      scopedLeadData.grab_user_id = profile.id
      scopedLeadData.grab_wechat = profile.name || null
    } else if (profile?.role === 'operator') {
      scopedLeadData.operator_id = profile.id
    }

    const insertPayload = {
      ...scopedLeadData,
      report_number: reportNumber,
      duplicate_mark: Boolean(duplicateLead),
      collision_operator: duplicateLead ? formatDuplicateCollision(duplicateLead) : null,
      add_status: null,
      add_feedback: null,
      feedback_time: null,
      conversion_status: null,
      // 确保日期格式正确
      entry_date: scopedLeadData.entry_date || new Date().toISOString().split('T')[0],
      // 记录创建人和更新人信息
      created_by: currentUser,
      updated_by: currentUser,
    }

    const createResult = await supabaseServer
      .from('leads')
      .insert(insertPayload)
      .select(LEAD_SELECT)
      .single()
    let data: any = createResult.data
    let error: any = createResult.error

    if (error && isMissingLeadColumnError(error)) {
      logger.warn('线索创建字段与线上库结构不一致，回退到基础字段写入', summarizeError(error))
      const fallbackResult = await supabaseServer
        .from('leads')
        .insert(stripLeadChannelFields(insertPayload))
        .select(LEAD_FALLBACK_SELECT)
        .single()

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('创建线索失败', {
        userId: profile.id,
        role: profile.role,
        ...summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建线索成功', { leadId: data.id })
    clearAllCountCache()
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('创建线索异常', summarizeError(error))
    return NextResponse.json(
      { error: '创建线索失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新线索
export async function PUT(request: NextRequest) {
  try {
    const rawLeadData = await request.json()
    const leadData: Record<string, any> = isRecord(rawLeadData) ? { ...rawLeadData } : {}

    if (!leadData.id) {
      logger.warn('更新线索缺少 ID')
      return NextResponse.json(
        { error: '线索 ID 必填' },
        { status: 400 }
      )
    }

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或用户档案不存在' }, { status: 401 })
    }
    const currentUser = profile.name || '未知用户'

    let existingLeadQuery = supabaseServer
      .from('leads')
      .select('id, channel_platform, customer_social_id')
      .eq('id', leadData.id)

    existingLeadQuery = applyLeadWriteScope(existingLeadQuery, profile)

    const existingLeadResult = await existingLeadQuery.single()
    let existingLead: any = existingLeadResult.data
    let existingLeadError: any = existingLeadResult.error

    if (existingLeadError && isMissingLeadColumnError(existingLeadError)) {
      logger.warn('线索详情字段与线上库结构不一致，回退到基础字段校验更新权限', summarizeError(existingLeadError))
      let fallbackExistingLeadQuery = supabaseServer
        .from('leads')
        .select('id')
        .eq('id', leadData.id)
      fallbackExistingLeadQuery = applyLeadWriteScope(fallbackExistingLeadQuery, profile)

      const fallbackExistingLeadResult = await fallbackExistingLeadQuery.single()
      existingLead = fallbackExistingLeadResult.data
      existingLeadError = fallbackExistingLeadResult.error
    }

    if (existingLeadError || !existingLead) {
      logger.warn('无权更新线索或线索不存在', {
        leadId: leadData.id,
        ...summarizeError(existingLeadError),
      })
      return NextResponse.json({ error: '无权更新该线索或线索不存在' }, { status: 403 })
    }

    const {
      id,
      report_number: _reportNumber,
      created_at: _createdAt,
      created_by: _createdBy,
      duplicate_mark: _duplicateMark,
      collision_operator: _collisionOperator,
      ...updatableLeadData
    } = leadData

    const channelPlatform = normalizeOptionalText(
      updatableLeadData.channel_platform ?? existingLead.channel_platform
    )
    const customerSocialId = normalizeOptionalText(
      updatableLeadData.customer_social_id ?? existingLead.customer_social_id
    )
    updatableLeadData.channel_platform = channelPlatform
    updatableLeadData.customer_social_id = customerSocialId

    const duplicateLead = await findDuplicateLead(channelPlatform, customerSocialId, id)

    logger.info('更新线索', {
      leadId: leadData.id,
      userId: profile.id,
      role: profile.role,
      ...summarizeLeadPayload(updatableLeadData),
    })

    const updatePayload = {
      ...updatableLeadData,
      duplicate_mark: Boolean(duplicateLead),
      collision_operator: duplicateLead ? formatDuplicateCollision(duplicateLead) : null,
      updated_at: new Date().toISOString(),
      // 记录更新人信息
      updated_by: currentUser,
    }

    const updateResult = await supabaseServer
      .from('leads')
      .update(updatePayload)
      .eq('id', id)
      .select(LEAD_SELECT)
      .single()
    let data: any = updateResult.data
    let error: any = updateResult.error

    if (error && isMissingLeadColumnError(error)) {
      logger.warn('线索更新字段与线上库结构不一致，回退到基础字段写入', summarizeError(error))
      const fallbackResult = await supabaseServer
        .from('leads')
        .update(stripLeadChannelFields(updatePayload))
        .eq('id', id)
        .select(LEAD_FALLBACK_SELECT)
        .single()

      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('更新线索失败', {
        leadId: leadData.id,
        userId: profile.id,
        role: profile.role,
        ...summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新线索成功', { leadId: data.id })
    clearAllCountCache()
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('更新线索异常', summarizeError(error))
    return NextResponse.json(
      { error: '更新线索失败' },
      { status: 500 }
    )
  }
}
