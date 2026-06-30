import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import {
  getAccessibleFormalOrderIds,
  getAccessibleStudentIds,
  getAccessibleStudentNames,
  hasScopedIdAccess,
} from "@/lib/server-business-scope"
import { ACTIONS, RESOURCES, Role, hasPermission } from "@/lib/permissions"
import { calculateFormalOrderBalanceSummaries } from "@/lib/server-formal-order-balance"
import { summarizeError } from "@/lib/safe-error"
import { calculateRefundStatus, getRefundStatusName } from "@/lib/status-calculator"

const logger = createLogger('API:Transactions')
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'
const TRANSACTION_RECORD_SELECT = `
  id,
  created_at,
  updated_at,
  student_id,
  order_id,
  creation_date,
  course_name,
  student_name,
  teacher_name,
  schedule_consumption,
  order_type,
  original_consultant,
  class_teacher,
  refund_reason,
  transaction_type,
  remaining_duration,
  refund_amount,
  status,
  academic_verified_at,
  academic_verified_by,
  paid_at,
  paid_by,
  performance_verified_at,
  performance_verified_by,
  unit_price
`

const TRANSACTION_ACCESS_SELECT = `
  id,
  student_id,
  order_id,
  creation_date,
  course_name,
  student_name,
  teacher_name,
  schedule_consumption,
  order_type,
  original_consultant,
  class_teacher,
  refund_reason,
  transaction_type,
  remaining_duration,
  refund_amount,
  status,
  academic_verified_at,
  academic_verified_by,
  paid_at,
  paid_by,
  performance_verified_at,
  performance_verified_by,
  unit_price
`

const TRANSACTION_WORKFLOW_EVENT_SELECT = `
  id,
  transaction_id,
  created_at,
  action,
  from_status,
  to_status,
  actor_id,
  actor_name,
  actor_role,
  note
`

const TRANSACTION_STATS_SELECT = `
  status,
  refund_amount
`

const TRANSACTION_STATUSES = ['pending', 'processing', 'completed', 'rejected'] as const
type TransactionStatus = typeof TRANSACTION_STATUSES[number]
type TransactionWorkflowAction = 'verify_amount' | 'mark_paid' | 'verify_performance' | 'reject'

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && TRANSACTION_STATUSES.includes(value as TransactionStatus)
}

function parseWorkflowAction(value: unknown): TransactionWorkflowAction | null {
  if (
    value === 'verify_amount' ||
    value === 'mark_paid' ||
    value === 'verify_performance' ||
    value === 'reject'
  ) {
    return value
  }
  return null
}

function canTransactionAction(
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>,
  action: typeof ACTIONS.verifyHours | typeof ACTIONS.payment | typeof ACTIONS.verifyPerformance
): boolean {
  return hasPermission(profile?.role as Role | undefined, RESOURCES.transactions, action)
}

function assertStatusTransition(params: {
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>
  currentStatus: unknown
  nextStatus: unknown
}): NextResponse | null {
  const { profile, currentStatus, nextStatus } = params

  if (!isTransactionStatus(currentStatus)) {
    return NextResponse.json({ error: '当前异动状态无效' }, { status: 400 })
  }

  if (!isTransactionStatus(nextStatus)) {
    return NextResponse.json({ error: '目标异动状态无效' }, { status: 400 })
  }

  if (currentStatus === nextStatus) return null

  if (currentStatus === 'pending' && nextStatus === 'processing') {
    if (!canTransactionAction(profile, ACTIONS.verifyHours)) {
      return NextResponse.json({ error: '无权进行教务金额核对' }, { status: 403 })
    }
    return null
  }

  if (currentStatus === 'processing' && nextStatus === 'completed') {
    if (!canTransactionAction(profile, ACTIONS.payment)) {
      return NextResponse.json({ error: '无权进行财务打款确认' }, { status: 403 })
    }
    return null
  }

  if ((currentStatus === 'pending' || currentStatus === 'processing') && nextStatus === 'rejected') {
    if (
      !canTransactionAction(profile, ACTIONS.verifyHours) &&
      !canTransactionAction(profile, ACTIONS.payment)
    ) {
      return NextResponse.json({ error: '无权拒绝该异动记录' }, { status: 403 })
    }
    return null
  }

  return NextResponse.json(
    { error: '不支持的异动状态流转' },
    { status: 400 }
  )
}

function buildWorkflowUpdate(params: {
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>
  currentStatus: unknown
  workflowAction: TransactionWorkflowAction
}): { payload: Record<string, any> } | { response: NextResponse } {
  const { profile, currentStatus, workflowAction } = params
  const now = new Date().toISOString()

  if (workflowAction === 'verify_amount') {
    const transitionError = assertStatusTransition({ profile, currentStatus, nextStatus: 'processing' })
    if (transitionError) return { response: transitionError }
    return {
      payload: {
        status: 'processing',
        academic_verified_at: now,
        academic_verified_by: profile?.id,
      },
    }
  }

  if (workflowAction === 'mark_paid') {
    const transitionError = assertStatusTransition({ profile, currentStatus, nextStatus: 'completed' })
    if (transitionError) return { response: transitionError }
    return {
      payload: {
        status: 'completed',
        paid_at: now,
        paid_by: profile?.id,
      },
    }
  }

  if (workflowAction === 'verify_performance') {
    if (currentStatus !== 'completed') {
      return {
        response: NextResponse.json(
          { error: '仅已完成打款的异动可进行人力业绩核对' },
          { status: 400 }
        ),
      }
    }
    if (!canTransactionAction(profile, ACTIONS.verifyPerformance)) {
      return {
        response: NextResponse.json({ error: '无权进行人力业绩核对' }, { status: 403 }),
      }
    }
    return {
      payload: {
        performance_verified_at: now,
        performance_verified_by: profile?.id,
      },
    }
  }

  const transitionError = assertStatusTransition({ profile, currentStatus, nextStatus: 'rejected' })
  if (transitionError) return { response: transitionError }
  return { payload: { status: 'rejected' } }
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

async function getTransactionWorkflowEvents(transactionIds: string[]) {
  if (transactionIds.length === 0) return new Map<string, any[]>()

  const { data, error } = await supabaseServer
    .from('transaction_workflow_events')
    .select(TRANSACTION_WORKFLOW_EVENT_SELECT)
    .in('transaction_id', transactionIds)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('获取异动流程流水失败', { error_summary: summarizeError(error) })
    return new Map<string, any[]>()
  }

  return (data || []).reduce((grouped, event) => {
    const events = grouped.get(event.transaction_id) || []
    events.push(event)
    grouped.set(event.transaction_id, events)
    return grouped
  }, new Map<string, any[]>())
}

async function attachTransactionWorkflowEvents<T extends { id: string }>(records: T[]): Promise<Array<T & { workflow_events: any[] }>> {
  const eventsByTransactionId = await getTransactionWorkflowEvents(records.map((record) => record.id))
  return records.map((record) => ({
    ...record,
    workflow_events: eventsByTransactionId.get(record.id) || [],
  }))
}

function attachRefundStatus<T extends Record<string, any>>(record: T): T & { refund_status: string; refund_status_name: string } {
  const refundStatus = calculateRefundStatus(record)
  return {
    ...record,
    refund_status: refundStatus,
    refund_status_name: getRefundStatusName(refundStatus),
  }
}

function attachRefundStatuses<T extends Record<string, any>>(records: T[]) {
  return records.map((record) => attachRefundStatus(record))
}

function getWorkflowActionNote(action: TransactionWorkflowAction | 'submitted' | 'status_change'): string {
  const noteMap: Record<string, string> = {
    submitted: '提交异动申请',
    verify_amount: '教务核对金额通过',
    mark_paid: '财务确认打款',
    verify_performance: '人力核对业绩',
    reject: '拒绝异动申请',
    status_change: '直接更新异动状态',
  }
  return noteMap[action] || '更新异动流程'
}

function buildTransactionStats(records: Array<{ status: string | null; refund_amount: number | null }>) {
  const byStatus = TRANSACTION_STATUSES.reduce((summary, status) => {
    summary[status] = { status, count: 0, amount: 0 }
    return summary
  }, {} as Record<TransactionStatus, { status: TransactionStatus; count: number; amount: number }>)

  for (const record of records) {
    if (!isTransactionStatus(record.status)) continue
    const amount = typeof record.refund_amount === 'number' ? record.refund_amount : 0
    byStatus[record.status].count += 1
    byStatus[record.status].amount += amount
  }

  return {
    total_count: records.length,
    total_amount: Object.values(byStatus).reduce((total, item) => total + item.amount, 0),
    by_status: byStatus,
  }
}

async function createTransactionWorkflowEvent(params: {
  transactionId: string
  action: TransactionWorkflowAction | 'submitted' | 'status_change'
  fromStatus?: string | null
  toStatus?: string | null
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>
}) {
  const { transactionId, action, fromStatus, toStatus, profile } = params
  const { error } = await supabaseServer
    .from('transaction_workflow_events')
    .insert({
      transaction_id: transactionId,
      action,
      from_status: fromStatus || null,
      to_status: toStatus || null,
      actor_id: profile?.id || null,
      actor_name: profile?.name || null,
      actor_role: profile?.role || null,
      note: getWorkflowActionNote(action),
    })

  if (error) {
    logger.error('写入异动流程流水失败', {
      transactionId,
      action,
      error_summary: summarizeError(error),
    })
  }
}

function summarizeTransactionPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    transaction_type: hasNonEmptyString(payload?.transaction_type) ? String(payload.transaction_type).trim() : undefined,
    has_student_id: hasNonEmptyString(payload?.student_id),
    has_student_name: hasNonEmptyString(payload?.student_name),
    has_order_id: hasNonEmptyString(payload?.order_id),
    has_course_name: hasNonEmptyString(payload?.course_name),
    has_refund_reason: hasNonEmptyString(payload?.refund_reason),
    has_refund_amount: hasValue(payload?.refund_amount),
    has_remaining_duration: hasValue(payload?.remaining_duration),
    has_unit_price: hasValue(payload?.unit_price),
    has_bank_card_name: hasNonEmptyString(payload?.bank_card_name),
    has_bank_card_number: hasNonEmptyString(payload?.bank_card_number),
    has_bank_name: hasNonEmptyString(payload?.bank_name),
  }
}

function parseOptionalNumber(value: any): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isRefundPayload(payload: any): boolean {
  const transactionType = String(payload.transaction_type || '').trim()
  return transactionType.includes('退费') || payload.refund_amount !== undefined
}

function encodePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function applyTransactionScope(query: any, studentIds: string[] | null, studentNames: string[] | null) {
  if (studentIds === null || studentNames === null) return query

  const filters = [
    studentIds.length > 0 ? `student_id.in.(${studentIds.join(',')})` : '',
    studentNames.length > 0 ? `student_name.in.(${studentNames.map(encodePostgrestValue).join(',')})` : '',
  ].filter(Boolean)

  if (filters.length === 0) return query.eq('id', EMPTY_UUID)
  return query.or(filters.join(','))
}

async function resolveStudentForTransaction(
  body: any,
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>
): Promise<{ ok: true; studentId: string | null; studentName: string } | { ok: false; response: NextResponse }> {
  const studentIds = await getAccessibleStudentIds(profile)
  const studentNames = await getAccessibleStudentNames(profile)
  const studentId = typeof body.student_id === 'string' && body.student_id.trim() ? body.student_id.trim() : null
  const studentName = typeof body.student_name === 'string' ? body.student_name.trim() : ''

  if (studentId) {
    if (!hasScopedIdAccess(studentIds, studentId)) {
      return {
        ok: false,
        response: NextResponse.json({ error: '无权为该学生创建异动记录' }, { status: 403 }),
      }
    }

    const { data: student } = await supabaseServer
      .from('students')
      .select('id, student_name')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) {
      return {
        ok: false,
        response: NextResponse.json({ error: '学生不存在' }, { status: 404 }),
      }
    }

    return { ok: true, studentId, studentName: student.student_name || studentName }
  }

  if (studentNames !== null && !studentNames.includes(studentName)) {
    return {
      ok: false,
      response: NextResponse.json({ error: '无权为该学生创建异动记录' }, { status: 403 }),
    }
  }

  return { ok: true, studentId: null, studentName }
}

async function validateRefundAmount(params: {
  refundAmount: number | null
  remainingDuration: number | null
  unitPrice: number | null
  orderId: string | null
  studentId: string | null
  excludeTransactionId?: string
}): Promise<NextResponse | null> {
  const { refundAmount, remainingDuration, unitPrice, orderId, studentId, excludeTransactionId } = params
  if (refundAmount === null) return null
  if (refundAmount < 0) {
    return NextResponse.json({ error: '退费金额不能小于 0' }, { status: 400 })
  }

  let maxRefundAmount = Number.POSITIVE_INFINITY

  if (remainingDuration !== null && unitPrice !== null) {
    maxRefundAmount = Math.min(maxRefundAmount, Math.max(0, remainingDuration * unitPrice))
  }

  if (orderId) {
    const { data: order, error } = await supabaseServer
      .from('formal_orders')
      .select('id, student_id, order_number, payment_amount, total_hours, hourly_rate')
      .eq('id', orderId)
      .maybeSingle()

    if (error) {
      logger.error('校验退费金额失败 - 查询订单失败', {
        orderId,
        error_summary: summarizeError(error),
      })
      return NextResponse.json({ error: '校验退费金额失败' }, { status: 400 })
    }

    if (!order) {
      return NextResponse.json({ error: '关联订单不存在' }, { status: 404 })
    }

    if (studentId && order.student_id && order.student_id !== studentId) {
      return NextResponse.json({ error: '关联订单不属于该学生' }, { status: 400 })
    }

    const [orderBalance] = await calculateFormalOrderBalanceSummaries([order], { excludeTransactionId })

    if (orderBalance) {
      maxRefundAmount = Math.min(maxRefundAmount, orderBalance.remaining_amount)

      if (remainingDuration !== null && remainingDuration > orderBalance.remaining_hours + 0.01) {
        return NextResponse.json(
          { error: `剩余课时不能超过当前可退课时 ${orderBalance.remaining_hours.toFixed(1)} 小时` },
          { status: 400 }
        )
      }
    }
  }

  if (Number.isFinite(maxRefundAmount) && refundAmount > maxRefundAmount + 0.01) {
    return NextResponse.json(
      { error: `退费金额不能超过可退金额 ¥${maxRefundAmount.toFixed(2)}` },
      { status: 400 }
    )
  }

  return null
}

async function validateTransactionOrderAccess(params: {
  orderId: string | null
  studentId: string | null
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>
}): Promise<NextResponse | null> {
  const { orderId, studentId, profile } = params
  if (!orderId) return null

  const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)
  if (!hasScopedIdAccess(accessibleOrderIds, orderId)) {
    return NextResponse.json({ error: '无权关联该正式订单' }, { status: 403 })
  }

  const { data: order, error } = await supabaseServer
    .from('formal_orders')
    .select('id, student_id')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    logger.error('校验异动关联订单失败', {
      orderId,
      error_summary: summarizeError(error),
    })
    return NextResponse.json({ error: '校验关联订单失败' }, { status: 400 })
  }

  if (!order) {
    return NextResponse.json({ error: '关联订单不存在' }, { status: 404 })
  }

  if (studentId && order.student_id && order.student_id !== studentId) {
    return NextResponse.json({ error: '关联订单不属于该学生' }, { status: 400 })
  }

  return null
}

// GET: 获取异动记录列表（支持ID查询单个和分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const stats = searchParams.get('stats') === 'true'
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const studentId = searchParams.get('student_id')
    const profile = await getProfileFromHeaders(request)

    logger.debug('获取异动记录数据', { id, from, to, studentId })

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    const accessibleStudentNames = await getAccessibleStudentNames(profile)

    // 如果提供了ID，查询单个异动记录
    if (id) {
      const { data, error } = await supabaseServer
        .from('transaction_records')
        .select(TRANSACTION_RECORD_SELECT)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取异动记录失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取异动记录失败' },
          { status: 400 }
        )
      }

      const canAccessById = hasScopedIdAccess(accessibleStudentIds, data.student_id)
      const canAccessByName = accessibleStudentNames === null || accessibleStudentNames.includes(data.student_name)
      if (!canAccessById && !canAccessByName) {
        return NextResponse.json(
          { error: '无权查看该异动记录' },
          { status: 403 }
        )
      }

      const [recordWithEvents] = attachRefundStatuses(await attachTransactionWorkflowEvents([data]))

      logger.debug('获取异动记录成功', { id })
      return NextResponse.json({ data: recordWithEvents })
    }

    if (studentId && !hasScopedIdAccess(accessibleStudentIds, studentId)) {
      return NextResponse.json(
        { error: '无权查看该学生的异动记录' },
        { status: 403 }
      )
    }

    // 先获取总数
    let countQuery = supabaseServer
      .from('transaction_records')
      .select('id', { count: 'exact', head: true })
    let listQuery = supabaseServer
      .from('transaction_records')
      .select(TRANSACTION_RECORD_SELECT)
    let statsQuery = supabaseServer
      .from('transaction_records')
      .select(TRANSACTION_STATS_SELECT)

    if (studentId) {
      const { data: student } = await supabaseServer
        .from('students')
        .select('student_name')
        .eq('id', studentId)
        .maybeSingle()
      const studentNameFilter = student?.student_name ? `,student_name.eq.${encodePostgrestValue(student.student_name)}` : ''
      countQuery = countQuery.or(`student_id.eq.${studentId}${studentNameFilter}`)
      listQuery = listQuery.or(`student_id.eq.${studentId}${studentNameFilter}`)
      statsQuery = statsQuery.or(`student_id.eq.${studentId}${studentNameFilter}`)
    } else {
      countQuery = applyTransactionScope(countQuery, accessibleStudentIds, accessibleStudentNames)
      listQuery = applyTransactionScope(listQuery, accessibleStudentIds, accessibleStudentNames)
      statsQuery = applyTransactionScope(statsQuery, accessibleStudentIds, accessibleStudentNames)
    }

    if (stats) {
      const { data, error } = await statsQuery

      if (error) {
        logger.error('获取异动统计失败', { error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取异动统计失败' },
          { status: 400 }
        )
      }

      return NextResponse.json({ data: buildTransactionStats(data || []) })
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      logger.error('获取异动记录数量失败', { error_summary: summarizeError(countError) })
      return NextResponse.json(
        { error: '获取异动记录列表失败' },
        { status: 400 }
      )
    }

    // 分页查询数据，按创建日期降序排序
    const { data, error } = await listQuery
      .order('creation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取异动记录列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取异动记录列表失败' },
        { status: 400 }
      )
    }

    const recordsWithEvents = attachRefundStatuses(await attachTransactionWorkflowEvents(data || []))

    logger.debug('获取异动记录列表成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: recordsWithEvents,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error) {
    logger.error('获取异动记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取异动记录失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新异动记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getProfileFromHeaders(request)
    const bodySummary = summarizeTransactionPayload(body)

    logger.debug('创建异动记录 - 接收到的数据', { body_summary: bodySummary })

    // 后端验证：必填字段
    if (!body.creation_date || typeof body.creation_date !== 'string' || !body.creation_date.trim()) {
      logger.error('创建异动记录失败 - 创建日期为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '创建日期不能为空' },
        { status: 400 }
      )
    }

    if (!body.student_name || typeof body.student_name !== 'string' || !body.student_name.trim()) {
      logger.error('创建异动记录失败 - 学生姓名为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    if (!body.transaction_type || typeof body.transaction_type !== 'string' || !body.transaction_type.trim()) {
      logger.error('创建异动记录失败 - 异动类型为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '异动类型不能为空' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const resolvedStudent = await resolveStudentForTransaction(body, profile)
    if ('response' in resolvedStudent) {
      return resolvedStudent.response
    }

    const orderId = typeof body.order_id === 'string' && body.order_id.trim() ? body.order_id.trim() : null
    const refundAmount = parseOptionalNumber(body.refund_amount)
    const remainingDuration = parseOptionalNumber(body.remaining_duration)
    const unitPrice = parseOptionalNumber(body.unit_price)
    const orderAccessValidation = await validateTransactionOrderAccess({
      orderId,
      studentId: resolvedStudent.studentId,
      profile,
    })
    if (orderAccessValidation) return orderAccessValidation

    if (isRefundPayload(body)) {
      const refundValidation = await validateRefundAmount({
        refundAmount,
        remainingDuration,
        unitPrice,
        orderId,
        studentId: resolvedStudent.studentId,
      })
      if (refundValidation) return refundValidation
    }

    const insertData = {
      creation_date: body.creation_date,
      course_name: body.course_name?.trim() || null,
      student_id: resolvedStudent.studentId,
      order_id: orderId,
      student_name: resolvedStudent.studentName,
      teacher_name: body.teacher_name?.trim() || null,
      schedule_consumption: parseOptionalNumber(body.schedule_consumption),
      order_type: body.order_type?.trim() || null,
      original_consultant: body.original_consultant?.trim() || null,
      class_teacher: body.class_teacher?.trim() || null,
      refund_reason: body.refund_reason?.trim() || null,
      transaction_type: body.transaction_type.trim(),
      remaining_duration: remainingDuration,
      refund_amount: refundAmount,
      bank_card_name: body.bank_card_name?.trim() || null,
      bank_card_number: body.bank_card_number?.trim() || null,
      bank_name: body.bank_name?.trim() || null,
    bank_branch: body.bank_branch?.trim() || null,
      status: 'pending',
      unit_price: unitPrice,
    }

    logger.debug('创建异动记录 - 准备插入的数据', {
      insert_summary: summarizeTransactionPayload(insertData),
    })

    const { data, error } = await supabaseServer
      .from('transaction_records')
      .insert(insertData)
      .select(TRANSACTION_RECORD_SELECT)
      .single()

    if (error) {
      logger.error('创建异动记录失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    await createTransactionWorkflowEvent({
      transactionId: data.id,
      action: 'submitted',
      fromStatus: null,
      toStatus: data.status,
      profile,
    })

    const [recordWithEvents] = attachRefundStatuses(await attachTransactionWorkflowEvents([data]))

    logger.info('创建异动记录成功', { id: data.id })
    return NextResponse.json({ data: recordWithEvents }, { status: 201 })
  } catch (error) {
    logger.error('创建异动记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建异动记录失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新异动记录
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getProfileFromHeaders(request)

    const { id, workflow_action: workflowActionInput, ...updateData } = body
    const workflowAction = parseWorkflowAction(workflowActionInput)
    const updateSummary = summarizeTransactionPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少异动记录ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    const accessibleStudentNames = await getAccessibleStudentNames(profile)
    const { data: existingRecord, error: existingError } = await supabaseServer
      .from('transaction_records')
      .select(TRANSACTION_ACCESS_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('查询异动记录失败', { id, error_summary: summarizeError(existingError) })
      return NextResponse.json(
        { error: '查询异动记录失败' },
        { status: 400 }
      )
    }

    const canAccessById = hasScopedIdAccess(accessibleStudentIds, existingRecord?.student_id)
    const canAccessByName = accessibleStudentNames === null || (existingRecord?.student_name && accessibleStudentNames.includes(existingRecord.student_name))
    if (!existingRecord || (!canAccessById && !canAccessByName)) {
      return NextResponse.json(
        { error: '无权更新该异动记录' },
        { status: 403 }
      )
    }

    logger.debug('更新异动记录 - 接收到的数据', { id, update_summary: updateSummary })

    if (workflowActionInput !== undefined && !workflowAction) {
      return NextResponse.json(
        { error: '无效的异动流程动作' },
        { status: 400 }
      )
    }

    if (workflowAction && updateData.status !== undefined) {
      return NextResponse.json(
        { error: '流程动作与直接状态更新不能同时提交' },
        { status: 400 }
      )
    }

    const ordinaryEditFields = Object.keys(updateData).filter((field) => (
      field !== 'status' && updateData[field] !== undefined
    ))
    if (
      ordinaryEditFields.length > 0 &&
      !hasPermission(profile.role as Role | undefined, RESOURCES.transactions, ACTIONS.edit)
    ) {
      return NextResponse.json(
        { error: '无权编辑异动记录内容' },
        { status: 403 }
      )
    }

    // 后端验证：必填字段
    if (updateData.student_name !== undefined && (!updateData.student_name || !updateData.student_name.trim())) {
      logger.error('更新异动记录失败 - 学生姓名为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    if (updateData.transaction_type !== undefined && (!updateData.transaction_type || !updateData.transaction_type.trim())) {
      logger.error('更新异动记录失败 - 异动类型为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '异动类型不能为空' },
        { status: 400 }
      )
    }

    let scopedStudentUpdate: { studentId: string | null; studentName: string } | null = null
    if (updateData.student_id !== undefined || updateData.student_name !== undefined) {
      const nextStudentId = updateData.student_id === null
        ? ''
        : updateData.student_id !== undefined
          ? updateData.student_id
          : existingRecord.student_id
      const nextStudentName = updateData.student_name !== undefined
        ? updateData.student_name
        : existingRecord.student_name

      const resolvedStudent = await resolveStudentForTransaction({
        student_id: nextStudentId,
        student_name: nextStudentName,
      }, profile)

      if ('response' in resolvedStudent) {
        return resolvedStudent.response
      }

      scopedStudentUpdate = {
        studentId: resolvedStudent.studentId,
        studentName: resolvedStudent.studentName,
      }
    }

    const workflowUpdate = workflowAction
      ? buildWorkflowUpdate({
          profile,
          currentStatus: existingRecord.status,
          workflowAction,
        })
      : null

    if (workflowUpdate && 'response' in workflowUpdate) {
      return workflowUpdate.response
    }

    if (updateData.status !== undefined) {
      const transitionError = assertStatusTransition({
        profile,
        currentStatus: existingRecord.status,
        nextStatus: updateData.status,
      })
      if (transitionError) return transitionError
    }

    const mergedRecord = { ...existingRecord, ...updateData }
    if (scopedStudentUpdate) {
      mergedRecord.student_id = scopedStudentUpdate.studentId
      mergedRecord.student_name = scopedStudentUpdate.studentName
    }

    const mergedOrderId = typeof mergedRecord.order_id === 'string' && mergedRecord.order_id.trim()
      ? mergedRecord.order_id.trim()
      : null
    const orderAccessValidation = await validateTransactionOrderAccess({
      orderId: mergedOrderId,
      studentId: typeof mergedRecord.student_id === 'string' && mergedRecord.student_id.trim()
        ? mergedRecord.student_id.trim()
        : null,
      profile,
    })
    if (orderAccessValidation) return orderAccessValidation

    if (isRefundPayload(mergedRecord)) {
      const refundValidation = await validateRefundAmount({
        refundAmount: parseOptionalNumber(mergedRecord.refund_amount),
        remainingDuration: parseOptionalNumber(mergedRecord.remaining_duration),
        unitPrice: parseOptionalNumber(mergedRecord.unit_price),
        orderId: typeof mergedRecord.order_id === 'string' && mergedRecord.order_id.trim() ? mergedRecord.order_id.trim() : null,
        studentId: typeof mergedRecord.student_id === 'string' && mergedRecord.student_id.trim() ? mergedRecord.student_id.trim() : null,
        excludeTransactionId: id,
      })
      if (refundValidation) return refundValidation
    }

    const updatePayload: any = {}
    const optionalFields = [
      'creation_date', 'course_name', 'student_id', 'order_id', 'student_name', 'teacher_name',
      'schedule_consumption', 'order_type', 'original_consultant', 'class_teacher',
      'refund_reason', 'transaction_type', 'remaining_duration', 'refund_amount',
      'bank_card_name', 'bank_card_number', 'bank_name', 'bank_branch',
      'status', 'unit_price'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    if (
      updateData.status !== undefined &&
      isTransactionStatus(existingRecord.status) &&
      isTransactionStatus(updateData.status) &&
      existingRecord.status !== updateData.status
    ) {
      const now = new Date().toISOString()
      if (existingRecord.status === 'pending' && updateData.status === 'processing') {
        updatePayload.academic_verified_at = now
        updatePayload.academic_verified_by = profile.id
      }
      if (existingRecord.status === 'processing' && updateData.status === 'completed') {
        updatePayload.paid_at = now
        updatePayload.paid_by = profile.id
      }
    }

    if (scopedStudentUpdate) {
      updatePayload.student_id = scopedStudentUpdate.studentId
      updatePayload.student_name = scopedStudentUpdate.studentName
    }

    if (workflowUpdate && 'payload' in workflowUpdate) {
      Object.assign(updatePayload, workflowUpdate.payload)
    }

    logger.debug('更新异动记录 - 准备更新的数据', {
      id,
      update_summary: summarizeTransactionPayload(updatePayload),
    })

    const { data, error } = await supabaseServer
      .from('transaction_records')
      .update(updatePayload)
      .eq('id', id)
      .select(TRANSACTION_RECORD_SELECT)
      .single()

    if (error) {
      logger.error('更新异动记录失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    if (workflowAction) {
      await createTransactionWorkflowEvent({
        transactionId: data.id,
        action: workflowAction,
        fromStatus: existingRecord.status,
        toStatus: data.status,
        profile,
      })
    } else if (
      updateData.status !== undefined &&
      isTransactionStatus(existingRecord.status) &&
      isTransactionStatus(data.status) &&
      existingRecord.status !== data.status
    ) {
      await createTransactionWorkflowEvent({
        transactionId: data.id,
        action: 'status_change',
        fromStatus: existingRecord.status,
        toStatus: data.status,
        profile,
      })
    }

    const [recordWithEvents] = attachRefundStatuses(await attachTransactionWorkflowEvents([data]))

    logger.info('更新异动记录成功', { id })
    return NextResponse.json({ data: recordWithEvents })
  } catch (error) {
    logger.error('更新异动记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新异动记录失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除异动记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const profile = await getProfileFromHeaders(request)

    if (!id) {
      return NextResponse.json(
        { error: '缺少异动记录ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    const accessibleStudentNames = await getAccessibleStudentNames(profile)
    const { data: existingRecord, error: existingError } = await supabaseServer
      .from('transaction_records')
      .select('id, student_id, student_name')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('查询异动记录失败', { id, error_summary: summarizeError(existingError) })
      return NextResponse.json(
        { error: '查询异动记录失败' },
        { status: 400 }
      )
    }

    const canAccessById = hasScopedIdAccess(accessibleStudentIds, existingRecord?.student_id)
    const canAccessByName = accessibleStudentNames === null || (existingRecord?.student_name && accessibleStudentNames.includes(existingRecord.student_name))
    if (!existingRecord || (!canAccessById && !canAccessByName)) {
      return NextResponse.json(
        { error: '无权删除该异动记录' },
        { status: 403 }
      )
    }

    logger.debug('删除异动记录', { id })

    const { error } = await supabaseServer
      .from('transaction_records')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除异动记录失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除异动记录成功', { id })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('删除异动记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除异动记录失败' },
      { status: 500 }
    )
  }
}
