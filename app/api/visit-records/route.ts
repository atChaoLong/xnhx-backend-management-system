import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleStudentIds, hasScopedIdAccess, restrictByIds } from "@/lib/server-business-scope"
import { summarizeError } from "@/lib/safe-error"
import { ACTIONS, RESOURCES, hasPermission, type Role } from "@/lib/permissions"

const logger = createLogger('API:VisitRecords')
const VISIT_RECORD_SELECT = 'id,student_id,visit_date,visit_method,parent_attitude,visit_notes,visit_personnel,next_visit_date,created_at,updated_at'
const VISIT_FOLLOW_UP_TRIGGER = 'visit_next_follow_up'
const VISIT_FOLLOW_UP_TODO_SELECT = 'id,status'
const VISIT_FOLLOW_UP_ASSIGNEE_ROLES = new Set(['sales', 'head_teacher'])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type VisitRecordFilter = {
  studentId?: string | null
  visitDateFrom?: string | null
  visitDateTo?: string | null
  nextVisitDateFrom?: string | null
  nextVisitDateTo?: string | null
  hasNextVisitDate?: boolean
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function summarizeVisitRecordPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_student_id: hasNonEmptyString(payload?.student_id),
    has_visit_date: Boolean(payload?.visit_date),
    has_visit_method: hasNonEmptyString(payload?.visit_method),
    has_parent_attitude: hasNonEmptyString(payload?.parent_attitude),
    has_visit_notes: hasNonEmptyString(payload?.visit_notes),
    has_next_visit_date: Boolean(payload?.next_visit_date),
  }
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function denyMissingStudentPermission(action: string) {
  return NextResponse.json(
    { error: '权限不足', message: `您需要 students 资源的 ${action} 权限` },
    { status: 403 }
  )
}

function canVisitStudents(profile: { role?: string | null }) {
  return hasPermission(profile.role as Role, RESOURCES.students, ACTIONS.visit)
}

function canDeleteStudents(profile: { role?: string | null }) {
  return hasPermission(profile.role as Role, RESOURCES.students, ACTIONS.delete)
}

function buildFollowUpDueDate(value: unknown): string | null {
  const date = normalizeOptionalString(value)
  if (!date) return null

  return DATE_PATTERN.test(date)
    ? `${date}T10:00:00+08:00`
    : date
}

function getChinaDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00+08:00`)
  date.setDate(date.getDate() + days)
  return getChinaDateString(date)
}

function getMonthRangeFromParam(monthParam: string | null) {
  const today = getChinaDateString()
  const fallbackMonth = today.slice(0, 7)
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : fallbackMonth
  const [year, monthNumber] = month.split('-').map(Number)
  const start = `${month}-01`
  const endDate = new Date(year, monthNumber, 0)
  return {
    month,
    start,
    end: getChinaDateString(endDate),
  }
}

function applyVisitRecordFilters(query: any, accessibleStudentIds: string[] | null, filters: VisitRecordFilter = {}) {
  let scopedQuery = query

  if (filters.studentId) {
    scopedQuery = scopedQuery.eq('student_id', filters.studentId)
  } else {
    scopedQuery = restrictByIds(scopedQuery, 'student_id', accessibleStudentIds)
  }

  if (filters.visitDateFrom) scopedQuery = scopedQuery.gte('visit_date', filters.visitDateFrom)
  if (filters.visitDateTo) scopedQuery = scopedQuery.lte('visit_date', filters.visitDateTo)
  if (filters.nextVisitDateFrom) scopedQuery = scopedQuery.gte('next_visit_date', filters.nextVisitDateFrom)
  if (filters.nextVisitDateTo) scopedQuery = scopedQuery.lte('next_visit_date', filters.nextVisitDateTo)
  if (filters.hasNextVisitDate) scopedQuery = scopedQuery.not('next_visit_date', 'is', null)

  return scopedQuery
}

async function countVisitRecords(accessibleStudentIds: string[] | null, filters: VisitRecordFilter = {}) {
  const query = applyVisitRecordFilters(
    supabaseServer
      .from('visit_records')
      .select('id', { count: 'exact', head: true }),
    accessibleStudentIds,
    filters
  )
  const { count, error } = await query

  if (error) {
    logger.warn('统计回访记录失败', { error_summary: summarizeError(error) })
    return 0
  }

  return count || 0
}

async function buildVisitStats(accessibleStudentIds: string[] | null, studentId: string | null, monthParam: string | null) {
  const today = getChinaDateString()
  const tomorrow = addDays(today, 1)
  const nextWeek = addDays(today, 7)
  const monthRange = getMonthRangeFromParam(monthParam)
  const baseFilter = { studentId }
  const [total, monthVisits, scheduledFollowUps, dueToday, overdue, upcoming7Days] = await Promise.all([
    countVisitRecords(accessibleStudentIds, baseFilter),
    countVisitRecords(accessibleStudentIds, {
      ...baseFilter,
      visitDateFrom: monthRange.start,
      visitDateTo: monthRange.end,
    }),
    countVisitRecords(accessibleStudentIds, {
      ...baseFilter,
      hasNextVisitDate: true,
    }),
    countVisitRecords(accessibleStudentIds, {
      ...baseFilter,
      nextVisitDateFrom: today,
      nextVisitDateTo: today,
    }),
    countVisitRecords(accessibleStudentIds, {
      ...baseFilter,
      nextVisitDateTo: addDays(today, -1),
    }),
    countVisitRecords(accessibleStudentIds, {
      ...baseFilter,
      nextVisitDateFrom: tomorrow,
      nextVisitDateTo: nextWeek,
    }),
  ])

  return {
    total,
    month: monthRange.month,
    month_visits: monthVisits,
    scheduled_follow_ups: scheduledFollowUps,
    due_today: dueToday,
    overdue,
    upcoming_7_days: upcoming7Days,
  }
}

function buildFollowUpTitle(studentName?: string | null) {
  return `回访提醒：${studentName || '学生'}`
}

async function getPendingFollowUpTodo(visitRecordId: string) {
  const { data, error } = await supabaseServer
    .from('todos')
    .select(VISIT_FOLLOW_UP_TODO_SELECT)
    .eq('auto_trigger_type', VISIT_FOLLOW_UP_TRIGGER)
    .filter('metadata->>visit_record_id', 'eq', visitRecordId)
    .in('status', ['pending', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    logger.warn('查询回访提醒待办失败', {
      visitRecordId,
      error_summary: summarizeError(error),
    })
    return null
  }

  return data?.[0] || null
}

async function cancelFollowUpTodo(visitRecordId: string) {
  const existing = await getPendingFollowUpTodo(visitRecordId)
  if (!existing || existing.status !== 'pending') {
    return { status: existing ? 'skipped' : 'none' }
  }

  const { error } = await supabaseServer
    .from('todos')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (error) {
    logger.warn('取消回访提醒待办失败', {
      visitRecordId,
      todoId: existing.id,
      error_summary: summarizeError(error),
    })
    return { status: 'failed' }
  }

  return { status: 'cancelled' }
}

async function resolveFollowUpAssignee(studentId: string, profile: { id: string; role?: string | null }) {
  const { data: student, error: studentError } = await supabaseServer
    .from('students')
    .select('id, student_name, student_code, head_teacher_id')
    .eq('id', studentId)
    .maybeSingle()

  if (studentError || !student) {
    logger.warn('查询回访提醒学生失败', {
      studentId,
      error_summary: studentError ? summarizeError(studentError) : undefined,
    })
    return null
  }

  if (student.head_teacher_id) {
    const { data: headTeacher, error: teacherError } = await supabaseServer
      .from('user_profiles')
      .select('id, role')
      .eq('id', student.head_teacher_id)
      .maybeSingle()

    if (!teacherError && headTeacher?.role === 'head_teacher') {
      return {
        assignedTo: headTeacher.id,
        studentName: student.student_name,
        studentCode: student.student_code,
      }
    }

    if (teacherError) {
      logger.warn('查询回访提醒班主任失败', {
        studentId,
        error_summary: summarizeError(teacherError),
      })
    }
  }

  if (profile.role && VISIT_FOLLOW_UP_ASSIGNEE_ROLES.has(profile.role)) {
    return {
      assignedTo: profile.id,
      studentName: student.student_name,
      studentCode: student.student_code,
    }
  }

  logger.warn('回访提醒缺少可分配接收人', { studentId, operatorId: profile.id, role: profile.role })
  return null
}

async function syncFollowUpTodo(params: {
  visitRecordId: string
  studentId: string
  nextVisitDate: unknown
  profile: { id: string; role?: string | null }
}) {
  const dueDate = buildFollowUpDueDate(params.nextVisitDate)

  if (!dueDate) {
    return cancelFollowUpTodo(params.visitRecordId)
  }

  const assignee = await resolveFollowUpAssignee(params.studentId, params.profile)
  if (!assignee) {
    return { status: 'skipped' }
  }

  const existing = await getPendingFollowUpTodo(params.visitRecordId)
  const payload = {
    assigned_to: assignee.assignedTo,
    assigned_by: params.profile.id,
    title: buildFollowUpTitle(assignee.studentName),
    description: '请按计划完成学生回访，并在回访管理中补充记录。',
    priority: 'high',
    entity_type: 'student',
    entity_id: params.studentId,
    due_date: dueDate,
    metadata: {
      visit_record_id: params.visitRecordId,
      student_code: assignee.studentCode || null,
    },
    is_auto_created: true,
    auto_trigger_type: VISIT_FOLLOW_UP_TRIGGER,
    status: 'pending',
    completed_at: null,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabaseServer
      .from('todos')
      .update(payload)
      .eq('id', existing.id)

    if (error) {
      logger.warn('更新回访提醒待办失败', {
        visitRecordId: params.visitRecordId,
        todoId: existing.id,
        error_summary: summarizeError(error),
      })
      return { status: 'failed' }
    }

    return { status: 'updated' }
  }

  const { error } = await supabaseServer
    .from('todos')
    .insert({
      ...payload,
      created_by: params.profile.id,
    })

  if (error) {
    logger.warn('创建回访提醒待办失败', {
      visitRecordId: params.visitRecordId,
      error_summary: summarizeError(error),
    })
    return { status: 'failed' }
  }

  return { status: 'created' }
}

async function enrichVisitRecords(records: any[]) {
  if (!records.length) return records

  const studentIds = uniqueValues(records.map((record) => record.student_id))
  const personnelIds = uniqueValues(records.map((record) => record.visit_personnel))
  const studentMap = new Map<string, { student_name?: string | null; student_code?: string | null }>()
  const personnelMap = new Map<string, string>()

  if (studentIds.length > 0) {
    const { data: students, error } = await supabaseServer
      .from('students')
      .select('id, student_name, student_code')
      .in('id', studentIds)

    if (error) {
      logger.warn('补充回访学生信息失败', { error_summary: summarizeError(error) })
    } else {
      ;(students || []).forEach((student: any) => {
        studentMap.set(student.id, {
          student_name: student.student_name,
          student_code: student.student_code,
        })
      })
    }
  }

  if (personnelIds.length > 0) {
    const { data: users, error } = await supabaseServer
      .from('user_profiles')
      .select('id, name, email')
      .in('id', personnelIds)

    if (error) {
      logger.warn('补充回访人员信息失败', { error_summary: summarizeError(error) })
    } else {
      ;(users || []).forEach((user: any) => {
        personnelMap.set(user.id, user.name || user.email || '未知')
      })
    }
  }

  return records.map((record) => {
    const student = studentMap.get(record.student_id)

    return {
      ...record,
      student_name: student?.student_name || null,
      student_code: student?.student_code || null,
      visit_personnel_name: record.visit_personnel
        ? (personnelMap.get(record.visit_personnel) || '未知')
        : '未知',
    }
  })
}

// GET: 获取回访记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('student_id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const includeStats = searchParams.get('include_stats') === 'true'
    const statsMonth = searchParams.get('stats_month')
    const followUpFrom = searchParams.get('follow_up_from')
    const followUpTo = searchParams.get('follow_up_to')
    const mode = searchParams.get('mode')
    const profile = await getCurrentProfile(request)

    logger.debug('获取回访记录', {
      studentId,
      from,
      to,
      include_stats: includeStats,
      mode,
      has_follow_up_from: Boolean(followUpFrom),
      has_follow_up_to: Boolean(followUpTo),
    })

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!canVisitStudents(profile)) {
      return denyMissingStudentPermission(ACTIONS.visit)
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)

    if (studentId && !hasScopedIdAccess(accessibleStudentIds, studentId)) {
      return NextResponse.json(
        { error: '无权查看该学生的回访记录' },
        { status: 403 }
      )
    }

    if ((followUpFrom && !DATE_PATTERN.test(followUpFrom)) || (followUpTo && !DATE_PATTERN.test(followUpTo))) {
      return NextResponse.json(
        { error: '下次回访日期筛选格式无效' },
        { status: 400 }
      )
    }

    if (mode === 'follow_up_calendar') {
      let calendarQuery = supabaseServer
        .from('visit_records')
        .select(VISIT_RECORD_SELECT)

      calendarQuery = applyVisitRecordFilters(calendarQuery, accessibleStudentIds, {
        studentId,
        nextVisitDateFrom: followUpFrom,
        nextVisitDateTo: followUpTo,
        hasNextVisitDate: true,
      })

      const { data, error } = await calendarQuery
        .order('next_visit_date', { ascending: true })
        .order('visit_date', { ascending: false })
        .limit(500)

      if (error) {
        logger.error('获取回访日历失败', { error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取回访日历失败' },
          { status: 400 }
        )
      }

      const recordsWithNames = await enrichVisitRecords(data || [])
      return NextResponse.json({
        data: recordsWithNames,
        count: recordsWithNames.length,
        follow_up_from: followUpFrom,
        follow_up_to: followUpTo,
      })
    }

    let query = supabaseServer
      .from('visit_records')
      .select(VISIT_RECORD_SELECT)
    let countQuery = supabaseServer
      .from('visit_records')
      .select('id', { count: 'exact', head: true })

    // 如果指定了学生ID，添加过滤条件
    query = applyVisitRecordFilters(query, accessibleStudentIds, { studentId })
    countQuery = applyVisitRecordFilters(countQuery, accessibleStudentIds, { studentId })

    // 先获取总数
    const { count: totalCount } = await countQuery
    const stats = includeStats
      ? await buildVisitStats(accessibleStudentIds, studentId, statsMonth)
      : undefined

    // 获取数据
    query = query.order('visit_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
    const { data, error } = await query

    if (error) {
      logger.error('获取回访记录失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取回访记录失败' },
        { status: 400 }
      )
    }

    const recordsWithNames = await enrichVisitRecords(data || [])

    logger.debug('获取回访记录成功', { count: recordsWithNames.length })
    return NextResponse.json({
      data: recordsWithNames,
      count: totalCount || 0,
      from,
      to,
      ...(stats ? { stats } : {}),
    })
  } catch (error: any) {
    logger.error('获取回访记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取回访记录失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新回访记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)
    const bodySummary = summarizeVisitRecordPayload(body)

    logger.debug('创建回访记录 - 接收到的数据', { body_summary: bodySummary })

    // 后端验证：必填字段
    if (!body.student_id || typeof body.student_id !== 'string') {
      logger.error('创建回访记录失败 - 学生ID为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '学生ID不能为空' },
        { status: 400 }
      )
    }

    if (!body.visit_date) {
      logger.error('创建回访记录失败 - 回访日期为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '回访日期不能为空' },
        { status: 400 }
      )
    }

    if (!body.visit_method || typeof body.visit_method !== 'string') {
      logger.error('创建回访记录失败 - 回访方式为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '回访方式不能为空' },
        { status: 400 }
      )
    }

    if (!body.visit_notes || typeof body.visit_notes !== 'string' || !body.visit_notes.trim()) {
      logger.error('创建回访记录失败 - 回访备注为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '回访备注不能为空' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!canVisitStudents(profile)) {
      return denyMissingStudentPermission(ACTIONS.visit)
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    if (!hasScopedIdAccess(accessibleStudentIds, body.student_id)) {
      return NextResponse.json(
        { error: '无权为该学生创建回访记录' },
        { status: 403 }
      )
    }

    const insertData = {
      student_id: body.student_id,
      visit_date: body.visit_date,
      visit_method: body.visit_method,
      parent_attitude: body.parent_attitude || null,
      visit_notes: body.visit_notes.trim(),
      visit_personnel: profile.id,
      next_visit_date: body.next_visit_date || null,
    }

    logger.debug('创建回访记录 - 准备插入的数据', {
      insert_summary: summarizeVisitRecordPayload(insertData),
    })

    const { data, error } = await supabaseServer
      .from('visit_records')
      .insert(insertData)
      .select(VISIT_RECORD_SELECT)
      .single()

    if (error) {
      logger.error('创建回访记录失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '创建回访记录失败' },
        { status: 400 }
      )
    }

    const followUpTodo = await syncFollowUpTodo({
      visitRecordId: data.id,
      studentId: data.student_id,
      nextVisitDate: data.next_visit_date,
      profile,
    })

    logger.info('创建回访记录成功', { id: data.id, follow_up_todo_status: followUpTodo.status })
    return NextResponse.json({ data, follow_up_todo: followUpTodo }, { status: 201 })
  } catch (error: any) {
    logger.error('创建回访记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建回访记录失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新回访记录
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)

    const { id, ...updateData } = body
    const updateSummary = summarizeVisitRecordPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少回访记录ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!canVisitStudents(profile)) {
      return denyMissingStudentPermission(ACTIONS.visit)
    }

    const { data: existingRecord, error: existingError } = await supabaseServer
      .from('visit_records')
      .select('id, student_id')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('查询回访记录失败', { id, error_summary: summarizeError(existingError) })
      return NextResponse.json(
        { error: '查询回访记录失败' },
        { status: 400 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    if (!existingRecord || !hasScopedIdAccess(accessibleStudentIds, existingRecord.student_id)) {
      return NextResponse.json(
        { error: '无权更新该回访记录' },
        { status: 403 }
      )
    }

    logger.debug('更新回访记录 - 接收到的数据', { id, update_summary: updateSummary })

    const updatePayload: any = {}
    const optionalFields = [
      'visit_date', 'visit_method',
      'parent_attitude', 'visit_notes',
      'next_visit_date'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新回访记录 - 准备更新的数据', {
      id,
      update_summary: summarizeVisitRecordPayload(updatePayload),
    })

    const { data, error } = await supabaseServer
      .from('visit_records')
      .update(updatePayload)
      .eq('id', id)
      .select(VISIT_RECORD_SELECT)
      .single()

    if (error) {
      logger.error('更新回访记录失败', { id, error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '更新回访记录失败' },
        { status: 400 }
      )
    }

    const followUpTodo = await syncFollowUpTodo({
      visitRecordId: data.id,
      studentId: data.student_id,
      nextVisitDate: data.next_visit_date,
      profile,
    })

    logger.info('更新回访记录成功', { id, follow_up_todo_status: followUpTodo.status })
    return NextResponse.json({ data, follow_up_todo: followUpTodo })
  } catch (error: any) {
    logger.error('更新回访记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新回访记录失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除回访记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const profile = await getCurrentProfile(request)

    if (!id) {
      return NextResponse.json(
        { error: '缺少回访记录ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!canDeleteStudents(profile)) {
      return denyMissingStudentPermission(ACTIONS.delete)
    }

    const { data: existingRecord, error: existingError } = await supabaseServer
      .from('visit_records')
      .select('id, student_id')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('查询回访记录失败', { id, error_summary: summarizeError(existingError) })
      return NextResponse.json(
        { error: '查询回访记录失败' },
        { status: 400 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    if (!existingRecord || !hasScopedIdAccess(accessibleStudentIds, existingRecord.student_id)) {
      return NextResponse.json(
        { error: '无权删除该回访记录' },
        { status: 403 }
      )
    }

    logger.debug('删除回访记录', { id })

    const followUpTodo = await cancelFollowUpTodo(id)

    const { error } = await supabaseServer
      .from('visit_records')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除回访记录失败', { id, error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '删除回访记录失败' },
        { status: 400 }
      )
    }

    logger.info('删除回访记录成功', { id, follow_up_todo_status: followUpTodo.status })
    return NextResponse.json({ success: true, follow_up_todo: followUpTodo })
  } catch (error: any) {
    logger.error('删除回访记录异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除回访记录失败' },
      { status: 500 }
    )
  }
}
