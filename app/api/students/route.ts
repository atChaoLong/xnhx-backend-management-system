import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { canViewStudentClassInSecrets, redactStudentClassInSecrets, redactStudentsClassInSecrets } from "@/lib/server-student-redaction"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"
import {
  leadCreatedByEqualsProfileFilter,
  leadGrabWechatEqualsProfileFilter,
} from "@/lib/server-lead-access"
import {
  batchCalculateStudentStatus,
} from "@/lib/status-calculator"

const logger = createLogger('API:Students')
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'
const STUDENT_SELECT = `
  id,
  created_at,
  updated_at,
  student_code,
  student_name,
  grade_code,
  region,
  school,
  parent_phone,
  head_teacher_id,
  status,
  classin_initial_password,
  classin_uid
`

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function summarizeStudentPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_student_code: hasNonEmptyString(payload?.student_code),
    has_student_name: hasNonEmptyString(payload?.student_name),
    has_parent_phone: hasNonEmptyString(payload?.parent_phone),
    has_school: hasNonEmptyString(payload?.school),
    has_region: hasNonEmptyString(payload?.region),
    has_grade_code: hasNonEmptyString(payload?.grade_code),
    has_head_teacher_id: hasNonEmptyString(payload?.head_teacher_id),
    has_classin_uid: hasNonEmptyString(payload?.classin_uid),
    has_classin_initial_password: hasNonEmptyString(payload?.classin_initial_password),
  }
}

interface FormalStudentSummary {
  formal_order_count: number
  total_formal_hours: number
  completed_formal_hours: number
  remaining_formal_hours: number
  total_formal_amount: number
  remaining_formal_amount: number
  formal_subjects: string[]
  formal_teachers: string[]
  latest_order_id: string | null
  latest_order_time: string | null
}

function createEmptyFormalStudentSummary(): FormalStudentSummary {
  return {
    formal_order_count: 0,
    total_formal_hours: 0,
    completed_formal_hours: 0,
    remaining_formal_hours: 0,
    total_formal_amount: 0,
    remaining_formal_amount: 0,
    formal_subjects: [],
    formal_teachers: [],
    latest_order_id: null,
    latest_order_time: null,
  }
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

async function getFormalStudentIds(): Promise<string[]> {
  const { data } = await supabaseServer
    .from('formal_orders')
    .select('student_id')
    .neq('status', 'cancelled')
    .not('student_id', 'is', null)

  return Array.from(new Set((data || []).map((order: any) => order.student_id).filter(Boolean)))
}

async function buildFormalStudentSummaries(studentIds: string[]): Promise<Map<string, FormalStudentSummary>> {
  const summaries = new Map<string, FormalStudentSummary>()
  if (studentIds.length === 0) return summaries

  try {
    const { data: orders, error } = await supabaseServer
      .from('formal_orders')
      .select(`
        id, student_id, subjects, teacher_names, total_hours, payment_amount, hourly_rate, first_class_time, created_at, status,
        courses (
          id, order_id, subject, teacher_name, total_hours,
          class_sessions (
            course_id, status, scheduled_duration_minutes
          )
        )
      `)
      .in('student_id', studentIds)
      .neq('status', 'cancelled')

    if (error) {
      logger.warn('查询正式订单汇总失败', { error_summary: summarizeError(error) })
      return summaries
    }

    ;(orders || []).forEach((order: any) => {
    const studentId = order.student_id
    const existing = summaries.get(studentId) || {
      formal_order_count: 0,
      total_formal_hours: 0,
      completed_formal_hours: 0,
      remaining_formal_hours: 0,
      total_formal_amount: 0,
      remaining_formal_amount: 0,
      formal_subjects: [] as string[],
      formal_teachers: [] as string[],
      latest_order_id: null as string | null,
      latest_order_time: null as string | null,
    }

    const orderCourses = order.courses || []
    const completedHours = orderCourses.reduce((sum: number, course: any) => {
      const courseCompleted = (course.class_sessions || [])
        .filter((s: any) => s.status === 'completed')
        .reduce((s: number, session: any) => s + ((session.scheduled_duration_minutes || 0) / 60), 0)
      return sum + courseCompleted
    }, 0)
    const totalHours = Number(order.total_hours || 0)
    const remainingHours = Math.max(0, totalHours - completedHours)
    const paymentAmount = Number(order.payment_amount || 0)
    const hourlyRate = Number(order.hourly_rate || 0)
    const remainingAmount = hourlyRate > 0 ? remainingHours * hourlyRate : Math.max(0, paymentAmount - (completedHours * hourlyRate))

    existing.formal_order_count += 1
    existing.total_formal_hours += totalHours
    existing.completed_formal_hours += completedHours
    existing.remaining_formal_hours += remainingHours
    existing.total_formal_amount += paymentAmount
    existing.remaining_formal_amount += remainingAmount

    if (order.subjects) {
      const subjects = Array.isArray(order.subjects) ? order.subjects : [order.subjects]
      existing.formal_subjects.push(...subjects.filter(Boolean))
    }
    if (order.teacher_names) {
      const teachers = Array.isArray(order.teacher_names) ? order.teacher_names : [order.teacher_names]
      existing.formal_teachers.push(...teachers.filter(Boolean))
    }

    if (!existing.latest_order_time || (order.created_at && order.created_at > existing.latest_order_time)) {
      existing.latest_order_id = order.id
      existing.latest_order_time = order.created_at
    }

    summaries.set(studentId, existing)
  })

  return summaries
  } catch (error) {
    logger.warn('查询正式订单汇总异常', { error_summary: summarizeError(error) })
    return summaries
  }
}

async function getAccessibleStudentIds(profile: Awaited<ReturnType<typeof getCurrentProfile>>): Promise<string[]> {
  if (!profile || profile.role === 'admin' || profile.role === 'academic_affairs') return []

  if (profile.role === 'head_teacher') {
    const { data } = await supabaseServer
      .from('students')
      .select('id')
      .eq('head_teacher_id', profile.id)
    return (data || []).map((student: any) => student.id).filter(Boolean)
  }

  if (profile.role === 'sales' || profile.role === 'operator') {
    const meName = profile.name || ''
    let leadQuery = supabaseServer.from('leads').select('id')
    if (profile.role === 'sales') {
      leadQuery = leadQuery.or([
        `grab_user_id.eq.${profile.id}`,
        leadGrabWechatEqualsProfileFilter(profile),
        leadCreatedByEqualsProfileFilter(profile),
      ].filter(Boolean).join(','))
    } else {
      leadQuery = leadQuery.or([
        `operator_id.eq.${profile.id}`,
        meName ? `created_by.eq.${meName}` : '',
      ].filter(Boolean).join(','))
    }

    const { data: leads } = await leadQuery
    const leadIds = (leads || []).map((lead: any) => lead.id).filter(Boolean)
    if (leadIds.length === 0) return []

    const { data: orders } = await supabaseServer
      .from('formal_orders')
      .select('student_id')
      .in('lead_id', leadIds)

    return Array.from(new Set((orders || []).map((order: any) => order.student_id).filter(Boolean)))
  }

  return []
}

function applyStudentScope(query: any, profile: Awaited<ReturnType<typeof getCurrentProfile>>, studentIds: string[]) {
  if (!profile) return query.eq('id', EMPTY_UUID)
  if (profile.role === 'admin' || profile.role === 'academic_affairs') return query

  if (profile.role === 'head_teacher') {
    return query.eq('head_teacher_id', profile.id)
  }

  if (profile.role === 'sales' || profile.role === 'operator') {
    if (studentIds.length === 0) return query.eq('id', EMPTY_UUID)
    return query.in('id', studentIds)
  }

  return query.eq('id', EMPTY_UUID)
}

async function assertStudentAccess(profile: Awaited<ReturnType<typeof getCurrentProfile>>, studentId: string) {
  const accessibleStudentIds = await getAccessibleStudentIds(profile)
  let accessQuery = supabaseServer
    .from('students')
    .select('id')
    .eq('id', studentId)

  accessQuery = applyStudentScope(accessQuery, profile, accessibleStudentIds)

  const { data, error } = await accessQuery.maybeSingle()
  if (error) {
    logger.error('学生范围校验失败', { studentId, error_summary: summarizeError(error) })
    return {
      ok: false as const,
      response: NextResponse.json({ error: '校验学生访问权限失败' }, { status: 400 }),
    }
  }

  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: '无权操作该学生' }, { status: 403 }),
    }
  }

  return { ok: true as const }
}

// GET: 获取学生列表（支持ID查询单个、按班主任过滤）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const headTeacherId = searchParams.get('head_teacher_id') // 新增：按班主任过滤
    const formalOnly = searchParams.get('formal') === 'true'
    const includeSummary = searchParams.get('include_summary') === 'true' || formalOnly
    const profile = await getCurrentProfile(request)
    const accessibleStudentIds = await getAccessibleStudentIds(profile)

    logger.debug('获取学生数据', { id, from, to, headTeacherId, formalOnly, includeSummary })

    if (id) {
      // 单个学生查询
      let detailQuery = supabaseServer
        .from('students')
        .select(STUDENT_SELECT)
        .eq('id', id)

      detailQuery = applyStudentScope(detailQuery, profile, accessibleStudentIds)

      const { data, error } = await detailQuery
        .single()

      if (error) {
        logger.error('获取学生失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取学生失败' },
          { status: 400 }
        )
      }

      // 班主任信息、正式订单汇总、回访状态三者互不依赖，并行查询
      const [teacherData, summaryMap, statusResults] = await Promise.all([
        data?.head_teacher_id
          ? supabaseServer
            .from('user_profiles')
            .select('name')
            .eq('id', data.head_teacher_id)
            .single()
            .then(({ data: t }) => t)
          : Promise.resolve(null),
        buildFormalStudentSummaries([data.id]),
        batchCalculateStudentStatus([data]).catch(() => []),
      ])

      const sr = statusResults[0] || { status: 'missing', statusName: '缺状态', newStatus: 'old', newStatusName: '老生', visitStatus: 'not_visited', visitStatusName: '未回访' }
      const studentWithAll = {
        ...data,
        head_teacher_name: teacherData?.name,
        formal_summary: summaryMap.get(data.id) || createEmptyFormalStudentSummary(),
        student_status: sr.status,
        student_status_name: sr.statusName,
        new_student_status: sr.newStatus,
        new_student_status_name: sr.newStatusName,
        visit_status: sr.visitStatus,
        visit_status_name: sr.visitStatusName,
      }

      logger.debug('获取学生成功', { id })
      return NextResponse.json({ data: redactStudentClassInSecrets(studentWithAll, profile) })
    }

    // 构建查询（支持按班主任过滤）
    let countQuery = supabaseServer
      .from('students')
      .select('id', { count: 'exact', head: true })

    let query = supabaseServer
      .from('students')
      .select(STUDENT_SELECT)

    countQuery = applyStudentScope(countQuery, profile, accessibleStudentIds)
    query = applyStudentScope(query, profile, accessibleStudentIds)

    if (formalOnly) {
      const formalStudentIds = await getFormalStudentIds()
      if (formalStudentIds.length === 0) {
        return NextResponse.json({ data: [], count: 0, from, to })
      }
      countQuery = countQuery.in('id', formalStudentIds)
      query = query.in('id', formalStudentIds)
    }

    // 如果指定了班主任ID，添加过滤条件
    if (headTeacherId) {
      countQuery = countQuery.eq('head_teacher_id', headTeacherId)
      query = query.eq('head_teacher_id', headTeacherId)
    }

    // 如果指定了老师ID，通过 courses 表关联查询（子查询方式避免重复）
    const teacherId = searchParams.get('teacher_id')
    logger.debug('teacher_id 参数', { teacherId })
    if (teacherId) {
      // 先获取老师的名字（courses 表可能用 teacher_name 而不是 teacher_id）
      const { data: teacherData } = await supabaseServer
        .from('teachers')
        .select('name')
        .eq('id', teacherId)
        .single()

      const teacherName = teacherData?.name
      logger.debug('查询到的老师名字', { teacherId, teacherName })

      // 查询 courses 表：先用 teacher_id，再用 teacher_name
      let courseData: any[] = []

      // 方式1：用 teacher_id 查询
      const { data: byIdData, error: byIdError } = await supabaseServer
        .from('courses')
        .select('student_id')
        .eq('teacher_id', teacherId)

      logger.debug('按 teacher_id 查询 courses', {
        teacherId,
        match_count: byIdData?.length || 0,
        error_summary: byIdError ? summarizeError(byIdError) : undefined,
      })

      if (byIdData && byIdData.length > 0) {
        courseData = byIdData
      } else if (teacherName) {
        // 方式2：用 teacher_name 查询
        const { data: byNameData, error: byNameError } = await supabaseServer
          .from('courses')
          .select('student_id')
          .eq('teacher_name', teacherName)

        logger.debug('按 teacher_name 查询 courses', {
          teacherId,
          has_teacher_name: Boolean(teacherName),
          match_count: byNameData?.length || 0,
          error_summary: byNameError ? summarizeError(byNameError) : undefined,
        })

        if (byNameData && byNameData.length > 0) {
          courseData = byNameData
        }
      }

      const studentIds = Array.from(new Set(courseData?.map(c => c.student_id).filter(Boolean) || []))
      logger.debug('提取的学生IDs', { studentIds })

      if (studentIds.length > 0) {
        countQuery = countQuery.in('id', studentIds)
        query = query.in('id', studentIds)
      } else {
        // 该老师没有学生，返回空结果
        return NextResponse.json({ data: [], count: 0, from, to })
      }
    }

    // 总数和当前页数据互不依赖，并行查询以减少耗时
    const [
      { count: totalCount },
      dataResult,
    ] = await Promise.all([
      countQuery,
      query.order('created_at', { ascending: false }).range(from, to),
    ])

    const { data, error } = dataResult

    if (error) {
      logger.error('获取学生列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取学生列表失败' },
        { status: 400 }
      )
    }

    // 批量获取班主任信息
    let studentsWithTeachers = data || []
    if (data && data.length > 0) {
      const headTeacherIds = Array.from(
        new Set(data.map(s => s.head_teacher_id).filter(Boolean))
      )

      // 班主任信息、正式订单汇总、回访状态三者互不依赖，并行查询
      const studentIds = data.map((student: any) => student.id)

      const [teacherMap, summaries, statusResults] = await Promise.all([
        headTeacherIds.length > 0
          ? supabaseServer
            .from('user_profiles')
            .select('id, name')
            .in('id', headTeacherIds)
            .then(({ data: teachers }) => {
              const map = new Map<string, string>()
              if (teachers) {
                teachers.forEach(teacher => map.set(teacher.id, teacher.name))
              }
              return map
            })
          : Promise.resolve(new Map<string, string>()),
        buildFormalStudentSummaries(studentIds),
        batchCalculateStudentStatus(data as any[]).catch(() => []),
      ])

      studentsWithTeachers = data.map((student: any, i: number) => {
        const sr = statusResults[i] || { status: 'missing', statusName: '缺状态', newStatus: 'old', newStatusName: '老生', visitStatus: 'not_visited', visitStatusName: '未回访' }
        const formal_summary = summaries.get(student.id) || createEmptyFormalStudentSummary()
        return {
          ...student,
          head_teacher_name: student.head_teacher_id
            ? (teacherMap.get(student.head_teacher_id) || null)
            : null,
          formal_summary,
          student_status: sr.status,
          student_status_name: sr.statusName,
          new_student_status: sr.newStatus,
          new_student_status_name: sr.newStatusName,
          visit_status: sr.visitStatus,
          visit_status_name: sr.visitStatusName,
        }
      })
    }

    const responsePayload = includeSummary
      ? studentsWithTeachers
      : studentsWithTeachers.map(({ formal_summary, ...student }: any) => student)
    const responseStudents = redactStudentsClassInSecrets(
      responsePayload,
      profile
    )

    logger.debug('获取学生列表成功', { count: responseStudents.length })
    return NextResponse.json({
      data: responseStudents,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    const safeError = createSafeErrorResponse(error, '获取学生失败')
    logger.error('获取学生异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

/**
 * 创建新学生，并自动注册到 ClassIn 系统（使用统一初始密码）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const bodySummary = summarizeStudentPayload(body)

    logger.debug('创建学生 - 接收到的数据', { body_summary: bodySummary })

    // 后端验证：学生姓名与学生编号必填
    if (!body.student_name || typeof body.student_name !== 'string' || !body.student_name.trim()) {
      logger.error('创建学生失败 - 学生姓名为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }
    if (!body.student_code || typeof body.student_code !== 'string' || !body.student_code.trim()) {
      logger.error('创建学生失败 - 学号为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '学生编号（学号）不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      student_code: body.student_code.trim(),
      student_name: body.student_name.trim(),
      grade_code: body.grade_code || null,
      region: body.region || null,
      school: body.school?.trim() || null,
      parent_phone: body.parent_phone?.trim() || null,
      head_teacher_id: body.head_teacher_id || null,
      status: body.status || 'active',
    }

    logger.debug('创建学生 - 准备插入的数据', {
      insert_summary: summarizeStudentPayload(insertData),
    })

    const { data, error } = await supabaseServer
      .from('students')
      .insert(insertData)
      .select(STUDENT_SELECT)
      .single()

    if (error) {
      logger.error('创建学生失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建学生成功', { id: data.id })

    // 自动注册到 ClassIn：需要家长电话作为账号、学生姓名作为昵称
    const telephone = insertData.parent_phone
    const nickname = insertData.student_name
    const initialPassword = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("")

    if (!telephone) {
      return NextResponse.json(
        { error: '注册到 ClassIn 需要填写家长电话（parent_phone）' },
        { status: 400 }
      )
    }

    // 随机纯数字初始密码，无需环境变量

    const sdk = getClassInSDKService()

    try {
      const uid = await sdk.registerStudent({
        telephone,
        nickname,
        password: initialPassword,
      })

      try {
        await sdk.addSchoolStudent({
          studentAccount: telephone,
          studentName: nickname,
        })
      } catch (e: any) {
        logger.warn('添加学生到机构失败（可能已存在）', { error_summary: summarizeError(e) })
      }

      const { error: updateError } = await supabaseServer
        .from('students')
        .update({
          classin_initial_password: initialPassword,
          classin_uid: uid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      if (updateError) {
        logger.error('更新学生 ClassIn UID 失败', { id: data.id, error_summary: summarizeError(updateError) })
        return NextResponse.json(
          { error: '注册成功但保存 UID 失败' },
          { status: 500 }
        )
      }

      const merged = redactStudentClassInSecrets({ ...data, classin_uid: uid, classin_initial_password: initialPassword }, profile)
      return NextResponse.json({ data: merged }, { status: 201 })
    } catch (err: any) {
      logger.error('注册学生到 ClassIn 异常', { error_summary: summarizeError(err) })
      return NextResponse.json(
        { error: '注册到 ClassIn 失败' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    const safeError = createSafeErrorResponse(error, '创建学生失败')
    logger.error('创建学生异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// PUT: 更新学生
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)

    const { id, ...updateData } = body
    const updateSummary = summarizeStudentPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const access = await assertStudentAccess(profile, id)
    if (access.ok === false) return access.response

    // #19: 班主任/销售在学生有正式订单后不可修改基本信息
    if (profile.role === 'head_teacher' || profile.role === 'sales') {
      const { count: formalOrderCount } = await supabaseServer
        .from('formal_orders')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id)

      if (formalOrderCount && formalOrderCount > 0) {
        const lockedFields = ['student_name', 'student_code', 'grade_code', 'region', 'school', 'parent_phone']
        const attemptedFields = lockedFields.filter(field => updateData[field] !== undefined)
        if (attemptedFields.length > 0) {
          return NextResponse.json(
            { error: '该学生已有正式订单，基本信息不可修改' },
            { status: 403 }
          )
        }
      }
    }

    logger.debug('更新学生 - 接收到的数据', { id, update_summary: updateSummary })

    // 后端验证：学生姓名必填
    if (!updateData.student_name || typeof updateData.student_name !== 'string' || !updateData.student_name.trim()) {
      logger.error('更新学生失败 - 学生姓名为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    // 构建更新 payload，只包含提供的字段
    const updatePayload: any = {
      student_name: updateData.student_name.trim(),
    }

    // 可选字段：只在提供时才更新
    if (updateData.student_code !== undefined) {
      updatePayload.student_code = updateData.student_code.trim() || ''
    }
    if (updateData.grade_code !== undefined) {
      updatePayload.grade_code = updateData.grade_code || null
    }
    if (updateData.region !== undefined) {
      updatePayload.region = updateData.region || null
    }
    if (updateData.school !== undefined) {
      updatePayload.school = updateData.school?.trim() || null
    }
    if (updateData.parent_phone !== undefined) {
      updatePayload.parent_phone = updateData.parent_phone?.trim() || null
    }
    if (updateData.head_teacher_id !== undefined) {
      updatePayload.head_teacher_id = updateData.head_teacher_id || null
    }
    if (updateData.status !== undefined) {
      updatePayload.status = updateData.status || 'active'
    }
    if (canViewStudentClassInSecrets(profile) && updateData.classin_uid !== undefined) {
      updatePayload.classin_uid = updateData.classin_uid || null
    }
    if (canViewStudentClassInSecrets(profile) && updateData.classin_initial_password !== undefined) {
      updatePayload.classin_initial_password = updateData.classin_initial_password || null
    }

    logger.debug('更新学生 - 准备更新的数据', {
      id,
      update_summary: summarizeStudentPayload(updatePayload),
    })

    const { data, error } = await supabaseServer
      .from('students')
      .update(updatePayload)
      .eq('id', id)
      .select(STUDENT_SELECT)
      .single()

    if (error) {
      logger.error('更新学生失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新学生成功', { id })
    return NextResponse.json({ data: redactStudentClassInSecrets(data, profile) })
  } catch (error: any) {
    const safeError = createSafeErrorResponse(error, '更新学生失败')
    logger.error('更新学生异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// DELETE: 删除学生
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const profile = await getCurrentProfile(request)

    if (!id) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const access = await assertStudentAccess(profile, id)
    if (access.ok === false) return access.response

    logger.debug('删除学生', { id })

    const { error } = await supabaseServer
      .from('students')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除学生失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除学生成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const safeError = createSafeErrorResponse(error, '删除学生失败')
    logger.error('删除学生异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}
