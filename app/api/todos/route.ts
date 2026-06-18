import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getCurrentProfile } from '@/lib/server-data-scope'
import { attachTodoSla, startAndEndOfToday } from '@/lib/todo-sla'

const logger = createLogger('API:Todos')

const TODO_SELECT = `
  id,
  created_at,
  updated_at,
  created_by,
  completed_at,
  assigned_to,
  assigned_by,
  title,
  description,
  priority,
  entity_type,
  entity_id,
  status,
  due_date,
  metadata,
  is_auto_created,
  auto_trigger_type
`

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const VALID_STATUSES = ['pending', 'completed', 'cancelled']
const VALID_ENTITY_TYPES = ['lead', 'student', 'trial_lesson', 'formal_order']
const STANDARD_ASSIGNABLE_TODO_ROLES = ['sales', 'head_teacher']

type TodoProfile = { id: string; role?: string | null }

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function nullableString(value: unknown): string | null {
  return normalizedString(value) || null
}

function parseRange(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function summarizeTodoPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_assigned_to: Boolean(normalizedString(payload?.assigned_to)),
    has_title: Boolean(normalizedString(payload?.title)),
    has_description: Boolean(normalizedString(payload?.description)),
    priority: normalizedString(payload?.priority),
    status: normalizedString(payload?.status),
    entity_type: normalizedString(payload?.entity_type),
    has_entity_id: Boolean(normalizedString(payload?.entity_id)),
    has_due_date: Boolean(normalizedString(payload?.due_date)),
    has_metadata: payload?.metadata !== undefined && payload?.metadata !== null,
  }
}

function todoError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function applyTodoScope(query: any, profile: TodoProfile) {
  if (profile.role !== 'admin') {
    return query.eq('assigned_to', profile.id)
  }

  return query
}

function applyTodoFilters(
  query: any,
  profile: TodoProfile,
  filters: { status?: string; priority?: string }
) {
  let scopedQuery = applyTodoScope(query, profile)

  if (filters.status) {
    scopedQuery = scopedQuery.eq('status', filters.status)
  }
  if (filters.priority) {
    scopedQuery = scopedQuery.eq('priority', filters.priority)
  }

  return scopedQuery
}

async function getTodoStats(profile: TodoProfile, filters: { status?: string; priority?: string }) {
  const now = new Date()
  const { todayStart, todayEnd } = startAndEndOfToday(now)
  const summaryFilters = { priority: filters.priority }

  const { data, error } = await applyTodoFilters(
    supabaseServer
      .from('todos')
      .select('id, status, priority, due_date')
      .range(0, 4999),
    profile,
    summaryFilters
  )

  if (error) {
    throw error
  }

  const stats = (data || []).reduce(
    (acc, todo: { status?: string | null; priority?: string | null; due_date?: string | null }) => {
      const dueDate = todo.due_date ? new Date(todo.due_date) : null
      const hasValidDueDate = dueDate && !Number.isNaN(dueDate.getTime())
      const isPending = todo.status === 'pending'
      const isUrgent = todo.priority === 'urgent'

      acc.total += 1

      if (todo.status === 'pending') {
        acc.pending += 1
      } else if (todo.status === 'completed') {
        acc.completed += 1
      } else if (todo.status === 'cancelled') {
        acc.cancelled += 1
      }

      if (isPending && hasValidDueDate && dueDate >= todayStart && dueDate <= todayEnd) {
        acc.due_today += 1
      }

      if (isPending && hasValidDueDate && dueDate < todayStart) {
        acc.overdue += 1
      }

      if (isPending && isUrgent) {
        acc.urgent_pending += 1

        if (hasValidDueDate && dueDate < todayStart) {
          acc.urgent_overdue += 1
        }
      }

      if (!isPending) {
        return acc
      }

      const { escalation_level } = attachTodoSla(todo, now)
      if (escalation_level === 'watch') {
        acc.escalation_watch += 1
      } else if (escalation_level === 'urgent') {
        acc.escalation_urgent += 1
      } else if (escalation_level === 'critical') {
        acc.escalation_critical += 1
      }

      return acc
    },
    {
      total: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
      due_today: 0,
      overdue: 0,
      urgent_pending: 0,
      urgent_overdue: 0,
      escalation_watch: 0,
      escalation_urgent: 0,
      escalation_critical: 0,
    }
  )

  return {
    ...stats,
    escalated_total:
      stats.escalation_watch +
      stats.escalation_urgent +
      stats.escalation_critical,
  }
}

async function getAssignableTodoTarget(userId: string) {
  const { data, error } = await supabaseServer
    .from('user_profiles')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return { target: null, error }
  }

  return { target: data as { id: string; role: string }, error: null }
}

async function validateSalesLeadOperatorReminder(
  profile: { id: string; name?: string | null; role?: string | null },
  assignedTo: string,
  entityType: string | null,
  entityId: string | null,
  targetRole: string
) {
  if (profile.role !== 'sales') {
    return '无权创建待办'
  }

  if (targetRole !== 'operator') {
    return '销售只能催促线索负责运营'
  }

  if (entityType !== 'lead' || !entityId) {
    return '销售催促运营必须关联线索'
  }

  const { data: lead, error } = await supabaseServer
    .from('leads')
    .select('id, operator_id, grab_user_id, grab_wechat')
    .eq('id', entityId)
    .single()

  if (error || !lead) {
    logger.warn('销售催促运营时线索不存在', {
      entity_id_present: Boolean(entityId),
      error_summary: summarizeError(error),
    })
    return '线索不存在'
  }

  if (lead.operator_id !== assignedTo) {
    return '只能催促该线索负责运营'
  }

  const profileName = normalizedString(profile.name)
  const grabWechat = normalizedString(lead.grab_wechat)
  const assignedById = lead.grab_user_id === profile.id
  const assignedByName = Boolean(grabWechat && profileName && grabWechat === profileName)

  if (!assignedById && !assignedByName) {
    return '只能催促自己负责线索的运营'
  }

  return null
}

function buildTodoUpdatePayload(body: Record<string, any>, existingStatus: string) {
  const payload: Record<string, any> = {}

  if (body.title !== undefined) {
    const title = normalizedString(body.title)
    if (!title) {
      return { error: '待办标题不能为空', payload: null }
    }
    payload.title = title
  }

  if (body.description !== undefined) {
    payload.description = nullableString(body.description)
  }

  if (body.priority !== undefined) {
    const priority = normalizedString(body.priority)
    if (!priority || !VALID_PRIORITIES.includes(priority)) {
      return { error: '无效的优先级', payload: null }
    }
    payload.priority = priority
  }

  if (body.status !== undefined) {
    const status = normalizedString(body.status)
    if (!status || !VALID_STATUSES.includes(status)) {
      return { error: '无效的待办状态', payload: null }
    }
    payload.status = status

    if (status === 'completed' && existingStatus !== 'completed') {
      payload.completed_at = new Date().toISOString()
    }
  }

  if (body.due_date !== undefined) {
    payload.due_date = nullableString(body.due_date)
  }

  payload.updated_at = new Date().toISOString()
  return { error: null, payload }
}

// GET: 获取待办列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseRange(searchParams.get('from'), 0)
    const requestedTo = parseRange(searchParams.get('to'), 19)
    const to = Math.min(Math.max(requestedTo, from), from + 99)
    const status = normalizedString(searchParams.get('status'))
    const priority = normalizedString(searchParams.get('priority'))

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return todoError('未登录', 401)
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return todoError('无效的待办状态', 400)
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return todoError('无效的优先级', 400)
    }

    if (id) {
      const { data, error } = await supabaseServer
        .from('todos')
        .select(TODO_SELECT)
        .eq('id', id)
        .single()

      if (error || !data) {
        logger.warn('获取待办失败', { id, error_summary: summarizeError(error) })
        return todoError('待办不存在', 404)
      }

      if (profile.role !== 'admin' && data.assigned_to !== profile.id) {
        return todoError('无权访问', 403)
      }

      return NextResponse.json({ data: attachTodoSla(data) })
    }

    const filters = { status, priority }
    const countQuery = applyTodoFilters(
      supabaseServer.from('todos').select('id', { count: 'exact', head: true }),
      profile,
      filters
    )

    const { count, error: countError } = await countQuery
    if (countError) {
      logger.error('获取待办数量失败', { error_summary: summarizeError(countError) })
      return todoError('获取待办列表失败', 500)
    }

    let query = applyTodoFilters(
      supabaseServer.from('todos').select(TODO_SELECT),
      profile,
      filters
    )

    query = query.order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error } = await query

    if (error) {
      logger.error('获取待办列表失败', { error_summary: summarizeError(error) })
      return todoError('获取待办列表失败', 500)
    }

    const stats = await getTodoStats(profile, filters)

    return NextResponse.json({
      data: (data || []).map((todo) => attachTodoSla(todo)),
      count: count || 0,
      stats,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取待办异常', { error_summary: summarizeError(error) })
    return todoError('获取待办失败', 500)
  }
}

// POST: 创建待办
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bodySummary = summarizeTodoPayload(body)

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return todoError('未登录', 401)
    }

    const assignedTo = normalizedString(body.assigned_to)
    const title = normalizedString(body.title)
    const priority = normalizedString(body.priority) || 'medium'
    const entityType = nullableString(body.entity_type)
    const entityId = nullableString(body.entity_id)

    if (!assignedTo || !title) {
      return todoError('缺少必填字段: assigned_to, title', 400)
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return todoError('无效的优先级', 400)
    }

    if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
      return todoError('无效的关联对象类型', 400)
    }

    const { target, error: targetError } = await getAssignableTodoTarget(assignedTo)
    if (targetError || !target) {
      logger.warn('创建待办目标用户不存在', {
        body_summary: bodySummary,
        error_summary: summarizeError(targetError),
      })
      return todoError('待办接收人不存在', 400)
    }

    const isStandardCreator = profile.role === 'admin' || profile.role === 'operator'

    if (isStandardCreator) {
      if (!STANDARD_ASSIGNABLE_TODO_ROLES.includes(target.role)) {
        return todoError('待办只能分配给销售或班主任', 400)
      }
    } else {
      const reminderError = await validateSalesLeadOperatorReminder(
        profile,
        assignedTo,
        entityType,
        entityId,
        target.role
      )

      if (reminderError) {
        return todoError(reminderError, reminderError === '线索不存在' ? 404 : 403)
      }
    }

    if (!isStandardCreator && target.role !== 'operator') {
      return todoError('待办只能分配给销售或班主任', 400)
    }

    const autoTriggerType = nullableString(body.auto_trigger_type)
    const insertData = {
      assigned_to: assignedTo,
      assigned_by: profile.id,
      created_by: profile.id,
      title,
      description: nullableString(body.description),
      priority,
      entity_type: entityType,
      entity_id: entityId,
      due_date: nullableString(body.due_date),
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : null,
      is_auto_created: body.is_auto_created === true || Boolean(autoTriggerType),
      auto_trigger_type: autoTriggerType,
      status: 'pending',
    }

    logger.info('创建待办请求', { body_summary: bodySummary, assignee_role: target.role })

    const { data, error } = await supabaseServer
      .from('todos')
      .insert(insertData)
      .select(TODO_SELECT)
      .single()

    if (error) {
      logger.error('创建待办失败', { error_summary: summarizeError(error), body_summary: bodySummary })
      return todoError('创建待办失败', 500)
    }

    logger.info('创建待办成功', { id: data.id })
    return NextResponse.json({ data: attachTodoSla(data) }, { status: 201 })
  } catch (error: any) {
    logger.error('创建待办异常', { error_summary: summarizeError(error) })
    return todoError('创建待办失败', 500)
  }
}

// PUT: 更新待办
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const id = normalizedString(body.id)

    if (!id) {
      return todoError('缺少待办ID', 400)
    }

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return todoError('未登录', 401)
    }

    const { data: existing, error: existingError } = await supabaseServer
      .from('todos')
      .select(TODO_SELECT)
      .eq('id', id)
      .single()

    if (existingError || !existing) {
      logger.warn('查询待办失败', { id, error_summary: summarizeError(existingError) })
      return todoError('待办不存在', 404)
    }

    if (profile.role !== 'admin' && existing.assigned_to !== profile.id && existing.created_by !== profile.id) {
      return todoError('无权更新此待办', 403)
    }

    const { error: payloadError, payload } = buildTodoUpdatePayload(body, existing.status)
    if (payloadError || !payload) {
      return todoError(payloadError || '待办更新内容无效', 400)
    }

    logger.info('更新待办请求', {
      id,
      body_summary: summarizeTodoPayload(body),
    })

    const { data, error } = await supabaseServer
      .from('todos')
      .update(payload)
      .eq('id', id)
      .select(TODO_SELECT)
      .single()

    if (error) {
      logger.error('更新待办失败', { id, error_summary: summarizeError(error) })
      return todoError('更新待办失败', 500)
    }

    logger.info('更新待办成功', { id })
    return NextResponse.json({ data: attachTodoSla(data) })
  } catch (error: any) {
    logger.error('更新待办异常', { error_summary: summarizeError(error) })
    return todoError('更新待办失败', 500)
  }
}

// DELETE: 删除待办
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = normalizedString(searchParams.get('id'))

    if (!id) {
      return todoError('缺少待办ID', 400)
    }

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return todoError('未登录', 401)
    }

    if (profile.role !== 'admin') {
      return todoError('权限不足，只有超级管理员可以删除待办', 403)
    }

    const { error } = await supabaseServer
      .from('todos')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除待办失败', { id, error_summary: summarizeError(error) })
      return todoError('删除待办失败', 500)
    }

    logger.info('删除待办成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除待办异常', { error_summary: summarizeError(error) })
    return todoError('删除待办失败', 500)
  }
}
