import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { createSafeErrorResponse, getErrorMessage, summarizeError } from "@/lib/safe-error"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { batchCalculateTrialLessonStatus } from "@/lib/status-calculator"
import { getAccessibleStudentIds } from "@/lib/server-business-scope"
import { redactFormalOrderSensitiveFields, redactFormalOrdersSensitiveFields } from "@/lib/server-formal-order-redaction"
import { calculateFormalOrderBalanceSummaries } from "@/lib/server-formal-order-balance"
import {
  leadCreatedByEqualsProfileFilter,
  leadGrabWechatEqualsProfileFilter,
} from "@/lib/server-lead-access"

const logger = createLogger('API:FormalOrders')

const FORMAL_ORDER_SELECT = `
  id,
  created_at,
  updated_at,
  student_id,
  lead_id,
  trial_lesson_id,
  previous_order_id,
  order_number,
  order_type,
  consultant_teacher,
  order_notes,
  teacher_names,
  subjects,
  total_sessions,
  session_duration,
  fixed_mode,
  frequency,
  official_start_time,
  first_class_time,
  total_hours,
  payment_channel,
  payment_amount,
  hourly_rate,
  payment_proof,
  payment_time,
  status
`

const TRIAL_LESSON_SOURCE_SELECT_BASE = `
  id,
  lead_id,
  student_id,
  child_name,
  phone,
  grade,
  region,
  assigned_consultant,
  course_status,
  matched_teacher,
  confirmed_teacher,
  trial_time,
  class_link,
  classin_student_uid
`

const FORMAL_ORDER_IMMUTABLE_UPDATE_FIELDS = [
  'student_id',
  'lead_id',
  'trial_lesson_id',
  'previous_order_id',
  'order_number',
  'order_type',
] as const

const FORMAL_ORDER_FINANCIAL_UPDATE_FIELDS = [
  'payment_channel',
  'payment_amount',
  'hourly_rate',
  'payment_proof',
  'payment_time',
  'status',
] as const

const FORMAL_ORDER_FINANCIAL_UPDATE_ROLES = new Set([
  'admin',
  'academic_affairs',
  'finance',
])

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function getTouchedFields(payload: Record<string, any>, fields: readonly string[]): string[] {
  return fields.filter((field) => Object.prototype.hasOwnProperty.call(payload, field))
}

function isMissingColumnError(error: unknown, column: string) {
  const message = getErrorMessage(error).toLowerCase()
  const { code } = summarizeError(error)

  return code === '42703' ||
    code === 'PGRST204' ||
    message.includes(column.toLowerCase())
}

function summarizeFormalOrderPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    order_type: hasNonEmptyString(payload?.order_type) ? String(payload.order_type).trim() : undefined,
    has_trial_lesson_id: hasNonEmptyString(payload?.trial_lesson_id),
    has_previous_order_id: hasNonEmptyString(payload?.previous_order_id),
    has_student_id: hasNonEmptyString(payload?.student_id),
    has_consultant_teacher: hasNonEmptyString(payload?.consultant_teacher),
    teacher_count: Array.isArray(payload?.teacher_names) ? payload.teacher_names.length : undefined,
    subject_count: Array.isArray(payload?.subjects) ? payload.subjects.length : undefined,
    has_total_hours: hasValue(payload?.total_hours),
    has_payment_channel: hasNonEmptyString(payload?.payment_channel),
    has_payment_amount: hasValue(payload?.payment_amount),
    has_hourly_rate: hasValue(payload?.hourly_rate),
    has_payment_proof: hasNonEmptyString(payload?.payment_proof),
    has_payment_time: hasNonEmptyString(payload?.payment_time),
    has_order_notes: hasNonEmptyString(payload?.order_notes),
  }
}

async function addComputedStatusToOrders<T extends { id?: string }>(orders: T[]): Promise<T[]> {
  if (!orders.length) return orders

  const summaries = await calculateFormalOrderBalanceSummaries(orders)
  const summaryByOrderId = new Map(summaries.map((summary) => [summary.order_id, summary]))

  return orders.map((order) => {
    const summary = order.id ? summaryByOrderId.get(order.id) : null
    if (!summary) return order

    return {
      ...order,
      computed_status: summary.computed_status,
      computed_status_label: summary.computed_status_label,
    }
  })
}

async function getAccessibleLeadIds(profile: Awaited<ReturnType<typeof getProfileFromHeaders>>): Promise<string[]> {
  if (!profile || profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return []
  const meName = profile.name || ''
  let query = supabaseServer.from('leads').select('id')

  if (profile.role === 'sales') {
    query = query.or([
      `grab_user_id.eq.${profile.id}`,
      leadGrabWechatEqualsProfileFilter(profile),
      leadCreatedByEqualsProfileFilter(profile),
    ].filter(Boolean).join(','))
  } else if (profile.role === 'operator') {
    query = query.or([
      `operator_id.eq.${profile.id}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  } else if (profile.role === 'head_teacher') {
    query = query.or([
      `operator_id.eq.${profile.id}`,
      `grab_user_id.eq.${profile.id}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  } else {
    return []
  }

  const { data } = await query
  return (data || []).map((lead: any) => lead.id).filter(Boolean)
}

async function getHeadTeacherStudentIds(profile: Awaited<ReturnType<typeof getProfileFromHeaders>>): Promise<string[]> {
  if (!profile || profile.role !== 'head_teacher') return []

  const { data } = await supabaseServer
    .from('students')
    .select('id')
    .eq('head_teacher_id', profile.id)

  return (data || []).map((student: any) => student.id).filter(Boolean)
}

async function getScopedStudentIds(profile: Awaited<ReturnType<typeof getProfileFromHeaders>>): Promise<string[]> {
  if (!profile) return []
  if (profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return []

  const [headTeacherIds, businessScopeIds] = await Promise.all([
    getHeadTeacherStudentIds(profile),
    getAccessibleStudentIds(profile),
  ])

  return Array.from(new Set([...headTeacherIds, ...(businessScopeIds || [])]))
}

function applyOrderScope(
  query: any,
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>,
  leadIds: string[],
  accessibleStudentIds: string[]
) {
  if (!profile) return query.eq('id', '00000000-0000-0000-0000-000000000000')
  if (profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return query

  const meName = profile.name || ''

  if (profile.role === 'sales' || profile.role === 'operator') {
    const filters = [
      meName ? `consultant_teacher.ilike.%${meName}%` : '',
      leadIds.length > 0 ? `lead_id.in.(${leadIds.join(',')})` : '',
      accessibleStudentIds.length > 0 ? `student_id.in.(${accessibleStudentIds.join(',')})` : '',
    ].filter(Boolean)

    if (filters.length === 0) return query.eq('id', '00000000-0000-0000-0000-000000000000')
    return query.or(filters.join(','))
  }

  if (profile.role === 'head_teacher') {
    const filters = [
      meName ? `consultant_teacher.ilike.%${meName}%` : '',
      leadIds.length > 0 ? `lead_id.in.(${leadIds.join(',')})` : '',
      accessibleStudentIds.length > 0 ? `student_id.in.(${accessibleStudentIds.join(',')})` : '',
    ].filter(Boolean)

    if (filters.length === 0) return query.eq('id', '00000000-0000-0000-0000-000000000000')
    return query.or(filters.join(','))
  }

  return query.eq('id', '00000000-0000-0000-0000-000000000000')
}

function applyTrialLessonSourceScope(
  query: any,
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>,
  leadIds: string[],
  studentIds: string[] | null,
) {
  if (!profile) return query.eq('id', '00000000-0000-0000-0000-000000000000')
  if (profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return query

  const meName = profile.name || ''

  if (profile.role === 'sales' || profile.role === 'head_teacher' || profile.role === 'operator') {
    const filters = [
      meName ? `assigned_consultant.ilike.%${meName}%` : '',
      leadIds.length > 0 ? `lead_id.in.(${leadIds.join(',')})` : '',
      studentIds && studentIds.length > 0 ? `student_id.in.(${studentIds.join(',')})` : '',
    ].filter(Boolean)

    if (filters.length === 0) return query.eq('id', '00000000-0000-0000-0000-000000000000')
    return query.or(filters.join(','))
  }

  return query.eq('id', '00000000-0000-0000-0000-000000000000')
}

async function getScopedTrialLessonSource(
  trialLessonId: string,
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>,
  accessibleLeadIds: string[],
  accessibleStudentIds: string[] | null,
) {
  const buildQuery = (selectFields: string) => {
    const query = supabaseServer
      .from('trial_lessons')
      .select(selectFields)
      .eq('id', trialLessonId)

    return applyTrialLessonSourceScope(query, profile, accessibleLeadIds, accessibleStudentIds)
  }

  let result: any = await buildQuery(TRIAL_LESSON_SOURCE_SELECT_BASE).maybeSingle()

  return result
}

function generateStudentCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  return `S${year}${month}${day}${hour}${minute}${random}`
}

function generateOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  return `L${year}${month}${day}${hour}${minute}${second}${random}`
}

function trimOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function resolveStudentIdFromTrialLesson(
  trialLesson: any,
  requestedStudentId: string | null,
  accessibleStudentIds: string[] | null,
): Promise<string> {
  if (trialLesson.student_id) {
    if (requestedStudentId && requestedStudentId !== trialLesson.student_id) {
      throw new Error('订单学生必须与来源试听正式生一致')
    }

    return trialLesson.student_id
  }

  const trialStudentName = trimOrNull(trialLesson.child_name)
  const trialPhone = trimOrNull(trialLesson.phone)

  if (!trialStudentName) {
    throw new Error('来源试听缺少学生称呼，不能自动创建正式生')
  }

  if (!trialPhone) {
    throw new Error('来源试听缺少手机号，不能自动创建正式生')
  }

  if (requestedStudentId) {
    if (accessibleStudentIds !== null && !accessibleStudentIds.includes(requestedStudentId)) {
      throw new Error('无权使用指定学生创建正式订单')
    }

    const { data: requestedStudent, error } = await supabaseServer
      .from('students')
      .select('id, student_name, parent_phone')
      .eq('id', requestedStudentId)
      .maybeSingle()

    if (error) {
      logger.error('校验来源试听学生失败', { requestedStudentId, error_summary: summarizeError(error) })
      throw new Error('校验来源试听学生失败')
    }

    if (!requestedStudent) {
      throw new Error('指定学生不存在，不能从该试听转正式订单')
    }

    const requestedPhone = trimOrNull(requestedStudent.parent_phone)
    if (requestedPhone !== trialPhone) {
      throw new Error('订单学生手机号必须与来源试听手机号一致')
    }

    await supabaseServer
      .from('trial_lessons')
      .update({
        student_id: requestedStudent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trialLesson.id)

    return requestedStudent.id
  }

  const { data: existingStudents, error: existingError } = await supabaseServer
    .from('students')
    .select('id')
    .eq('parent_phone', trialPhone)
    .eq('student_name', trialStudentName)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingError) {
    logger.error('查找来源试听学生失败', { trial_lesson_id: trialLesson.id, error_summary: summarizeError(existingError) })
    throw new Error('查找来源试听学生失败')
  }

  const existingStudentId = existingStudents?.[0]?.id
  if (existingStudentId) {
    await supabaseServer
      .from('trial_lessons')
      .update({
        student_id: existingStudentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trialLesson.id)

    return existingStudentId
  }

  const { data: createdStudent, error: createError } = await supabaseServer
    .from('students')
    .insert({
      student_code: generateStudentCode(),
      student_name: trialStudentName,
      grade_code: trimOrNull(trialLesson.grade),
      region: trimOrNull(trialLesson.region),
      parent_phone: trialPhone,
      classin_uid: trialLesson.classin_student_uid || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (createError || !createdStudent?.id) {
    logger.error('从来源试听自动创建学生失败', {
      trial_lesson_id: trialLesson.id,
      error_summary: summarizeError(createError),
    })
    throw new Error('从来源试听自动创建学生失败')
  }

  await supabaseServer
    .from('trial_lessons')
    .update({
      student_id: createdStudent.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trialLesson.id)

  return createdStudent.id
}

// GET: 获取正式订单列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const profile = await getProfileFromHeaders(request)
    const [accessibleLeadIds, scopedStudentIds] = await Promise.all([
      getAccessibleLeadIds(profile),
      getScopedStudentIds(profile),
    ])

    logger.debug('获取正式订单数据', { id, from, to })

    // 如果提供了ID，查询单个正式订单
    if (id) {
      let detailQuery = supabaseServer
        .from('formal_orders')
        .select(FORMAL_ORDER_SELECT)
        .eq('id', id)

      detailQuery = applyOrderScope(detailQuery, profile, accessibleLeadIds, scopedStudentIds)

      const { data: order, error } = await detailQuery
        .single()

      if (error) {
        logger.error('获取正式订单失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取正式订单失败' },
          { status: 400 }
        )
      }

      // 查询学生信息
      let data: any = order
      if (order.student_id) {
        const { data: student } = await supabaseServer
          .from('students')
          .select('student_name')
          .eq('id', order.student_id)
          .single()

        if (student) {
          data = { ...order, students: student }
        }
      }

      const [orderWithComputedStatus] = await addComputedStatusToOrders([data])

      logger.debug('获取正式订单成功', { id })
      return NextResponse.json({ data: redactFormalOrderSensitiveFields(orderWithComputedStatus, profile) })
    }

    // 先获取总数
    let countQuery = supabaseServer
      .from('formal_orders')
      .select('id', { count: 'exact', head: true })
    countQuery = applyOrderScope(countQuery, profile, accessibleLeadIds, scopedStudentIds)
    const { count: totalCount } = await countQuery

    // 分页查询数据，按首次课时间降序排序
    let listQuery = supabaseServer
      .from('formal_orders')
      .select(FORMAL_ORDER_SELECT)

    listQuery = applyOrderScope(listQuery, profile, accessibleLeadIds, scopedStudentIds)

    const { data: orders, error } = await listQuery
      .order('first_class_time', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取正式订单列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取正式订单列表失败' },
        { status: 400 }
      )
    }

    // 批量查询学生信息
    let data = orders || []
    if (data.length > 0) {
      const studentIds = data
        .map(order => order.student_id)
        .filter(id => id) // 过滤掉空值

      if (studentIds.length > 0) {
        const { data: students } = await supabaseServer
          .from('students')
          .select('id, student_name')
          .in('id', studentIds)

        // 创建学生ID到学生信息的映射
        const studentMap = new Map(
          (students || []).map(s => [s.id, s])
        )

        // 合并学生信息到订单数据
        data = data.map(order => ({
          ...order,
          students: order.student_id ? studentMap.get(order.student_id) : null
        }))
      }
    }

    const ordersWithComputedStatus = await addComputedStatusToOrders(data || [])
    const responseOrders = redactFormalOrdersSensitiveFields(ordersWithComputedStatus, profile)

    logger.debug('获取正式订单列表成功', { count: responseOrders.length })
    return NextResponse.json({
      data: responseOrders,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: unknown) {
    const safeError = createSafeErrorResponse(error, '获取正式订单失败')
    logger.error('获取正式订单异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}

// POST: 创建新正式订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getProfileFromHeaders(request)
    const bodySummary = summarizeFormalOrderPayload(body)

    logger.debug('创建正式订单 - 接收到的数据', { body_summary: bodySummary })

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!body.order_type || typeof body.order_type !== 'string' || !body.order_type.trim()) {
      logger.error('创建正式订单失败 - 订单类型为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '订单类型不能为空' },
        { status: 400 }
      )
    }

    const orderType = String(body.order_type).trim()
    const isRenew = orderType === 'renew' || orderType.toLowerCase().includes('renew') || orderType.includes('续')
    const isExtend = orderType === 'extend' || orderType.toLowerCase().includes('extend') || orderType.includes('扩')
    const isContinuation = isRenew || isExtend
    let sourceTrialLesson: any = null
    let previousOrder: any = null
    let resolvedStudentId: string | null = null
    const requestedStudentId = trimOrNull(body.student_id)

    if (isContinuation && (!body.previous_order_id || typeof body.previous_order_id !== 'string')) {
      logger.error('创建正式订单失败 - 续费/扩科需要关联之前订单', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '续费/扩科必须选择关联之前的订单' },
        { status: 400 }
      )
    }

    if (isContinuation) {
      const [accessibleLeadIds, scopedStudentIds] = await Promise.all([
        getAccessibleLeadIds(profile),
        getScopedStudentIds(profile),
      ])
      let previousOrderQuery = supabaseServer
        .from('formal_orders')
        .select(FORMAL_ORDER_SELECT)
        .eq('id', body.previous_order_id.trim())

      previousOrderQuery = applyOrderScope(previousOrderQuery, profile, accessibleLeadIds, scopedStudentIds)

      const { data, error } = await previousOrderQuery.maybeSingle()

      if (error) {
        logger.error('校验续费/扩科来源订单失败', { previous_order_id: body.previous_order_id, error_summary: summarizeError(error) })
        const { message, status } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }

      if (!data) {
        logger.warn('创建正式订单失败 - 无权访问续费/扩科来源订单', {
          previous_order_id: body.previous_order_id,
          user_id: profile.id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '无权使用该历史订单续费/扩科' },
          { status: 403 }
        )
      }

      if (data.student_id && requestedStudentId && data.student_id !== requestedStudentId) {
        return NextResponse.json(
          { error: '续费/扩科学生必须与历史订单学生一致' },
          { status: 400 }
        )
      }

      previousOrder = data
      resolvedStudentId = data.student_id || requestedStudentId
    } else {
      if (!body.trial_lesson_id || typeof body.trial_lesson_id !== 'string' || !body.trial_lesson_id.trim()) {
        logger.error('创建正式订单失败 - 来源试听为空', { body_summary: bodySummary })
        return NextResponse.json(
          { error: '正式订单必须从试听课程转化创建' },
          { status: 400 }
        )
      }

      const [accessibleLeadIds, accessibleStudentIds] = await Promise.all([
        getAccessibleLeadIds(profile),
        getAccessibleStudentIds(profile),
      ])
      const { data: trialLesson, error: trialError } = await getScopedTrialLessonSource(
        body.trial_lesson_id.trim(),
        profile,
        accessibleLeadIds,
        accessibleStudentIds
      )

      if (trialError) {
        logger.error('校验来源试听失败', { trial_lesson_id: body.trial_lesson_id, error_summary: summarizeError(trialError) })
        const { message, status } = handleDatabaseError(trialError)
        return NextResponse.json({ error: message }, { status })
      }

      if (!trialLesson) {
        logger.warn('创建正式订单失败 - 无权访问来源试听', {
          trial_lesson_id: body.trial_lesson_id,
          user_id: profile.id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '无权使用该试听课程创建正式订单' },
          { status: 403 }
        )
      }

      if (!trialLesson.lead_id && !trialLesson.student_id) {
        logger.error('创建正式订单失败 - 来源试听缺少线索和正式生', { trial_lesson_id: trialLesson.id })
        return NextResponse.json(
          { error: '来源试听缺少关联线索或正式生，不能转正式订单' },
          { status: 400 }
        )
      }

      if (body.lead_id && body.lead_id !== trialLesson.lead_id) {
        logger.error('创建正式订单失败 - 订单线索与来源试听不一致', {
          trial_lesson_id: trialLesson.id,
          body_lead_id: body.lead_id,
          lesson_lead_id: trialLesson.lead_id,
        })
        return NextResponse.json(
          { error: '关联线索必须与来源试听一致' },
          { status: 400 }
        )
      }

      const [statusResult] = await batchCalculateTrialLessonStatus([trialLesson])
      if (statusResult.isConverted) {
        logger.error('创建正式订单失败 - 来源试听已转化', { trial_lesson_id: trialLesson.id })
        return NextResponse.json(
          { error: '该试听课程已转正式订单，不能重复转化' },
          { status: 400 }
        )
      }

      if (!['waiting_feedback', 'completed'].includes(statusResult.status)) {
        logger.error('创建正式订单失败 - 来源试听状态不可转正', {
          trial_lesson_id: trialLesson.id,
          lesson_status: statusResult.status,
        })
        return NextResponse.json(
          { error: '只有试听完成或待反馈的试听课程可以转正式订单' },
          { status: 400 }
        )
      }

      sourceTrialLesson = trialLesson
      try {
        resolvedStudentId = await resolveStudentIdFromTrialLesson(trialLesson, requestedStudentId, accessibleStudentIds)
      } catch (studentError: unknown) {
        logger.error('创建正式订单失败 - 解析来源试听学生失败', {
          trial_lesson_id: trialLesson.id,
          error_summary: summarizeError(studentError),
        })
        const studentErrorMessage = studentError instanceof Error
          ? studentError.message
          : '无法从来源试听解析学生'
        return NextResponse.json(
          { error: studentErrorMessage },
          { status: 400 }
        )
      }
    }

    if (!resolvedStudentId) {
      logger.error('创建正式订单失败 - 无法确定订单学生', {
        body_summary: bodySummary,
        sourceTrialLessonId: sourceTrialLesson?.id,
        previousOrderId: previousOrder?.id,
      })
      return NextResponse.json(
        { error: '无法确定订单学生' },
        { status: 400 }
      )
    }

    if (!body.consultant_teacher || typeof body.consultant_teacher !== 'string' || !body.consultant_teacher.trim()) {
      logger.error('创建正式订单失败 - 签约顾问为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '签约顾问不能为空' },
        { status: 400 }
      )
    }

    if (!body.teacher_names || !Array.isArray(body.teacher_names) || body.teacher_names.length === 0) {
      logger.error('创建正式订单失败 - 老师姓名为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '至少选择一位老师' },
        { status: 400 }
      )
    }

    if (!body.subjects || !Array.isArray(body.subjects) || body.subjects.length === 0) {
      logger.error('创建正式订单失败 - 学科为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '至少选择一个学科' },
        { status: 400 }
      )
    }

    if (!body.total_hours || isNaN(body.total_hours)) {
      logger.error('创建正式订单失败 - 总课时(小时)无效', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '总课时(小时)不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_channel || typeof body.payment_channel !== 'string' || !body.payment_channel.trim()) {
      logger.error('创建正式订单失败 - 付款渠道为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '付款渠道不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_amount || isNaN(body.payment_amount)) {
      logger.error('创建正式订单失败 - 付款金额无效', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '付款金额不能为空' },
        { status: 400 }
      )
    }

    if (!body.hourly_rate || isNaN(body.hourly_rate)) {
      logger.error('创建正式订单失败 - 小时单价无效', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '小时单价不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_proof || typeof body.payment_proof !== 'string' || !body.payment_proof.trim()) {
      logger.error('创建正式订单失败 - 付款凭证为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '付款凭证不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_time || typeof body.payment_time !== 'string' || !body.payment_time.trim()) {
      logger.error('创建正式订单失败 - 付费时间为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '付费时间不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      student_id: resolvedStudentId,
      order_number: body.order_number?.trim() || generateOrderNumber(),
      order_type: body.order_type.trim(),
      consultant_teacher: body.consultant_teacher.trim(),
      order_notes: body.order_notes?.trim() || null,
      lead_id: sourceTrialLesson?.lead_id || previousOrder?.lead_id || null,
      trial_lesson_id: sourceTrialLesson?.id || null,
      previous_order_id: previousOrder?.id || body.previous_order_id || null,
      teacher_names: body.teacher_names,
      subjects: body.subjects,
      // 设置默认值以保持数据库兼容性
      total_sessions: 0, // 默认值，后续通过排课更新
      session_duration: 1, // 默认1小时
      fixed_mode: '未设置', // 默认值
      frequency: '1_per_week', // 默认每周一次
      official_start_time: new Date().toISOString(), // 默认当前时间
      first_class_time: new Date().toISOString(), // 默认当前时间
      total_hours: parseFloat(body.total_hours),
      payment_channel: body.payment_channel.trim(),
      payment_amount: parseFloat(body.payment_amount),
      hourly_rate: parseFloat(body.hourly_rate),
      payment_proof: body.payment_proof.trim(),
      payment_time: body.payment_time,
      status: body.status || 'active',
    }

    logger.debug('创建正式订单 - 准备插入的数据', {
      insert_summary: summarizeFormalOrderPayload(insertData),
    })

    const { data, error } = await supabaseServer
      .from('formal_orders')
      .insert(insertData)
      .select(FORMAL_ORDER_SELECT)
      .single()

    if (error) {
      logger.error('创建正式订单失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建正式订单成功', { id: data.id, order_number: data.order_number })
    return NextResponse.json({ data: redactFormalOrderSensitiveFields(data, profile) }, { status: 201 })
  } catch (error: unknown) {
    const safeError = createSafeErrorResponse(error, '创建正式订单失败')
    logger.error('创建正式订单异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}

// PUT: 更新正式订单
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getProfileFromHeaders(request)

    const { id, ...updateData } = body
    const updateSummary = summarizeFormalOrderPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少正式订单ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    logger.debug('更新正式订单 - 接收到的数据', { id, update_summary: updateSummary })

    const [accessibleLeadIds, scopedStudentIds] = await Promise.all([
      getAccessibleLeadIds(profile),
      getScopedStudentIds(profile),
    ])
    let accessQuery = supabaseServer
      .from('formal_orders')
      .select('id')
      .eq('id', id)

    accessQuery = applyOrderScope(accessQuery, profile, accessibleLeadIds, scopedStudentIds)

    const { data: accessibleOrder, error: accessError } = await accessQuery.maybeSingle()

    if (accessError) {
      logger.error('校验正式订单访问权限失败', { id, error_summary: summarizeError(accessError) })
      const { message, status } = handleDatabaseError(accessError)
      return NextResponse.json({ error: message }, { status })
    }

    if (!accessibleOrder) {
      logger.warn('更新正式订单失败 - 无权访问正式订单', {
        id,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '无权更新该正式订单' },
        { status: 403 }
      )
    }

    const immutableFields = getTouchedFields(updateData, FORMAL_ORDER_IMMUTABLE_UPDATE_FIELDS)
    if (immutableFields.length > 0) {
      logger.warn('更新正式订单失败 - 尝试修改不可变来源字段', {
        id,
        user_id: profile.id,
        role: profile.role,
        fields: immutableFields,
      })
      return NextResponse.json(
        { error: '正式订单来源、编号和类型不可通过编辑接口修改' },
        { status: 400 }
      )
    }

    const financialFields = getTouchedFields(updateData, FORMAL_ORDER_FINANCIAL_UPDATE_FIELDS)
    if (financialFields.length > 0 && !FORMAL_ORDER_FINANCIAL_UPDATE_ROLES.has(profile.role)) {
      logger.warn('更新正式订单失败 - 无权修改财务或状态字段', {
        id,
        user_id: profile.id,
        role: profile.role,
        fields: financialFields,
      })
      return NextResponse.json(
        { error: '无权修改正式订单财务或状态字段' },
        { status: 403 }
      )
    }

    // 数组字段验证
    if (updateData.teacher_names !== undefined && (!Array.isArray(updateData.teacher_names) || updateData.teacher_names.length === 0)) {
      logger.error('更新正式订单失败 - 老师姓名无效', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '至少选择一位老师' },
        { status: 400 }
      )
    }

    if (updateData.subjects !== undefined && (!Array.isArray(updateData.subjects) || updateData.subjects.length === 0)) {
      logger.error('更新正式订单失败 - 学科无效', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '至少选择一个学科' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'consultant_teacher', 'order_notes',
      'teacher_names', 'subjects', 'total_sessions', 'session_duration',
      'fixed_mode', 'frequency', 'official_start_time', 'first_class_time',
      'total_hours', 'payment_channel', 'payment_amount', 'hourly_rate',
      'payment_proof', 'payment_time', 'status'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: '没有可更新的正式订单字段' },
        { status: 400 }
      )
    }

    logger.debug('更新正式订单 - 准备更新的数据', {
      id,
      update_summary: summarizeFormalOrderPayload(updatePayload),
    })

    const { data, error } = await supabaseServer
      .from('formal_orders')
      .update(updatePayload)
      .eq('id', id)
      .select(FORMAL_ORDER_SELECT)
      .single()

    if (error) {
      logger.error('更新正式订单失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新正式订单成功', { id, order_number: data.order_number })
    return NextResponse.json({ data: redactFormalOrderSensitiveFields(data, profile) })
  } catch (error: unknown) {
    const safeError = createSafeErrorResponse(error, '更新正式订单失败')
    logger.error('更新正式订单异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}

// DELETE: 删除正式订单
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const profile = await getProfileFromHeaders(request)

    if (!id) {
      return NextResponse.json(
        { error: '缺少正式订单ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    logger.debug('删除正式订单', { id })

    const [accessibleLeadIds, scopedStudentIds] = await Promise.all([
      getAccessibleLeadIds(profile),
      getScopedStudentIds(profile),
    ])
    let accessQuery = supabaseServer
      .from('formal_orders')
      .select('id')
      .eq('id', id)

    accessQuery = applyOrderScope(accessQuery, profile, accessibleLeadIds, scopedStudentIds)

    const { data: accessibleOrder, error: accessError } = await accessQuery.maybeSingle()

    if (accessError) {
      logger.error('校验正式订单删除权限失败', { id, error_summary: summarizeError(accessError) })
      const { message, status } = handleDatabaseError(accessError)
      return NextResponse.json({ error: message }, { status })
    }

    if (!accessibleOrder) {
      logger.warn('删除正式订单失败 - 无权访问正式订单', {
        id,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '无权删除该正式订单' },
        { status: 403 }
      )
    }

    const { error } = await supabaseServer
      .from('formal_orders')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除正式订单失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除正式订单成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const safeError = createSafeErrorResponse(error, '删除正式订单失败')
    logger.error('删除正式订单异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}
