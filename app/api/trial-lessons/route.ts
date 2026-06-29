import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { batchCalculateTrialLessonStatus } from "@/lib/status-calculator"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleStudentIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { ensureClassInStudentAccount } from "@/lib/server-classin-students"
import { ensureClassInTeacherAccountByName, findAvailableTrialTeacherByName } from "@/lib/server-classin-teachers"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { ensureChinaTimezone } from "@/lib/utils/timezone"
import { redactTrialLessonSensitiveFields, redactTrialLessonsSensitiveFields } from "@/lib/server-formal-order-redaction"
import { getErrorMessage, summarizeError } from "@/lib/safe-error"
import {
  leadCreatedByEqualsProfileFilter,
  leadGrabWechatEqualsProfileFilter,
} from "@/lib/server-lead-access"

const logger = createLogger('API:TrialLessons')
const CLASSIN_STUDENT_ERROR_MESSAGE = '创建 ClassIn 学生账号失败'
type TrialUrgencyLevel = 'low' | 'medium' | 'high' | 'urgent'
const TRIAL_URGENCY_LEVELS = new Set<TrialUrgencyLevel>(['low', 'medium', 'high', 'urgent'])

const TRIAL_LESSON_SELECT_BASE = `
  id,
  created_at,
  updated_at,
  child_name,
  status,
  lead_id,
  student_id,
  region,
  grade,
  trial_subject,
  trial_time,
  trial_duration,
  phone,
  channel,
  trial_amount,
  payment_proof,
  urgency_level,
  notes,
  assigned_consultant,
  course_status,
  student_type,
  matched_teacher,
  confirmed_teacher,
  classin_course_id,
  classin_class_id,
  classin_unit_id,
  classin_activity_id,
  classin_student_uid,
  classin_student_registered_at,
  classin_student_error,
  class_link,
  lead:leads(report_number)
`


function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeTrialUrgencyLevel(value: unknown): TrialUrgencyLevel | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null

  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'normal') return 'medium'
  if (TRIAL_URGENCY_LEVELS.has(normalized as TrialUrgencyLevel)) return normalized as TrialUrgencyLevel

  return 'invalid'
}

function isMissingColumnError(error: unknown, column: string) {
  const message = getErrorMessage(error).toLowerCase()
  const { code } = summarizeError(error)

  return code === '42703' ||
    code === 'PGRST204' ||
    message.includes(column.toLowerCase())
}

function summarizeTrialLessonPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_lead_id: hasNonEmptyString(payload?.lead_id),
    has_student_id: hasNonEmptyString(payload?.student_id),
    has_phone: hasNonEmptyString(payload?.phone),
    has_payment_proof: hasNonEmptyString(payload?.payment_proof),
    has_notes: hasNonEmptyString(payload?.notes),
    has_trial_amount: payload?.trial_amount !== undefined && payload?.trial_amount !== null && payload?.trial_amount !== '',
    has_assigned_consultant: hasNonEmptyString(payload?.assigned_consultant),
    has_matched_teacher: hasNonEmptyString(payload?.matched_teacher),
    has_confirmed_teacher: hasNonEmptyString(payload?.confirmed_teacher),
    has_class_link: hasNonEmptyString(payload?.class_link),
  }
}

async function getAccessibleLeadIds(profile: Awaited<ReturnType<typeof getCurrentProfile>>): Promise<string[]> {
  if (!profile || profile.role === 'admin') return []
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

function applyTrialScope(
  query: any,
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  leadIds: string[],
  studentIds: string[] | null,
) {
  if (!profile) return query.eq('id', '00000000-0000-0000-0000-000000000000')
  if (profile.role === 'admin' || profile.role === 'academic_affairs') return query

  const meName = profile.name || ''

  if (profile.role === 'sales' || profile.role === 'head_teacher' || profile.role === 'operator' || profile.role === 'teacher') {
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

async function enrichTrialLessonStatus(lesson: any) {
  if (!lesson) return lesson

  const [statusResult] = await batchCalculateTrialLessonStatus([lesson])

  if (!statusResult) return lesson

  return {
    ...lesson,
    lesson_status: statusResult.status,
    lesson_status_name: statusResult.statusName,
    is_converted_calculated: statusResult.isConverted,
  }
}

// GET: 获取试听课程列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const profile = await getCurrentProfile(request)
    const [accessibleLeadIds, accessibleStudentIds] = await Promise.all([
      getAccessibleLeadIds(profile),
      getAccessibleStudentIds(profile),
    ])

    logger.debug('获取试听课程数据', { id, from, to })

    // 如果提供了ID，查询单个试听课程
    if (id) {
      let detailQuery = supabaseServer
        .from('trial_lessons')
        .select(TRIAL_LESSON_SELECT_BASE)
        .eq('id', id)

      detailQuery = applyTrialScope(detailQuery, profile, accessibleLeadIds, accessibleStudentIds)

      const { data, error } = await detailQuery.single()

      if (error) {
        logger.error('获取试听课程失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取试听课程失败' },
          { status: 400 }
        )
      }

      logger.debug('获取试听课程成功', { id })

      // 计算单个试听状态
      if (data) {
        return NextResponse.json({
          data: redactTrialLessonSensitiveFields(await enrichTrialLessonStatus(data), profile)
        })
      }

      return NextResponse.json({ data: redactTrialLessonSensitiveFields(data, profile) })
    }

    // 总数和当前页数据互不依赖，并行执行，避免列表接口被两次远程查询串行拖慢。
    let countQuery = supabaseServer
      .from('trial_lessons')
      .select('id', { count: 'exact', head: true })
    countQuery = applyTrialScope(countQuery, profile, accessibleLeadIds, accessibleStudentIds)

    let listQuery = supabaseServer
      .from('trial_lessons')
      .select(TRIAL_LESSON_SELECT_BASE)

    listQuery = applyTrialScope(listQuery, profile, accessibleLeadIds, accessibleStudentIds)

    const [countResult, listResult]: any[] = await Promise.all([
      countQuery,
      listQuery
        .order('trial_time', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    ])

    const { count: totalCount, error: countError } = countResult

    if (countError) {
      logger.warn('统计试听课程数量失败', {
        error_summary: summarizeError(countError),
      })
    }

    const { data, error } = listResult

    if (error) {
      logger.error('获取试听课程列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取试听课程列表失败' },
        { status: 400 }
      )
    }

    // 计算试听状态
    const lessonsWithStatus = []
    if (data && data.length > 0) {
      const statusResults = await batchCalculateTrialLessonStatus(data)

      // 合并状态到数据
      for (let i = 0; i < data.length; i++) {
        const lesson = data[i]
        const status = statusResults[i]

        lessonsWithStatus.push({
          ...lesson,
          lesson_status: status.status,
          lesson_status_name: status.statusName,
          is_converted_calculated: status.isConverted,
        })
      }
    }

    logger.debug('获取试听课程列表成功', { count: lessonsWithStatus.length || 0 })
    return NextResponse.json({
      data: redactTrialLessonsSensitiveFields(lessonsWithStatus, profile),
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: unknown) {
    logger.error('获取试听课程异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取试听课程失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新试听课程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)
    const bodySummary = summarizeTrialLessonPayload(body)

    logger.debug('创建试听课程 - 接收到的数据', { body_summary: bodySummary })

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const leadId = typeof body.lead_id === 'string' && body.lead_id.trim() ? body.lead_id.trim() : null
    const studentId = typeof body.student_id === 'string' && body.student_id.trim() ? body.student_id.trim() : null

    if (!leadId && !studentId) {
      logger.error('创建试听课程失败 - 缺少来源线索或正式生', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '试听课程必须关联线索或正式生' },
        { status: 400 }
      )
    }

    if (leadId && studentId) {
      logger.error('创建试听课程失败 - 来源线索和正式生同时存在', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '试听课程只能选择线索或正式生其中一种来源' },
        { status: 400 }
      )
    }

    if (leadId && !['admin', 'academic_affairs', 'finance'].includes(profile.role)) {
      const accessibleLeadIds = await getAccessibleLeadIds(profile)
      if (!accessibleLeadIds.includes(leadId)) {
        logger.warn('创建试听课程失败 - 无权访问关联线索', {
          lead_id: leadId,
          user_id: profile.id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '无权使用该线索创建试听课程' },
          { status: 403 }
        )
      }
    }

    if (leadId) {
      const { data: existingTrialLesson, error: existingTrialLessonError } = await supabaseServer
        .from('trial_lessons')
        .select('id')
        .eq('lead_id', leadId)
        .limit(1)
        .maybeSingle()

      if (existingTrialLessonError) {
        logger.error('创建试听课程失败 - 检查重复试听异常', {
          lead_id: leadId,
          error_summary: summarizeError(existingTrialLessonError),
        })
        const { message, status } = handleDatabaseError(existingTrialLessonError)
        return NextResponse.json({ error: message }, { status })
      }

      if (existingTrialLesson) {
        logger.warn('创建试听课程失败 - 线索已存在试听课程', {
          lead_id: leadId,
          trial_lesson_id: existingTrialLesson.id,
        })
        return NextResponse.json(
          { error: '该线索已创建试听课程，请勿重复创建' },
          { status: 409 }
        )
      }
    }

    if (studentId) {
      const accessibleStudentIds = await getAccessibleStudentIds(profile)
      if (!hasScopedIdAccess(accessibleStudentIds, studentId)) {
        logger.warn('创建试听课程失败 - 无权访问关联正式生', {
          student_id: studentId,
          user_id: profile.id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '无权使用该正式生创建试听课程' },
          { status: 403 }
        )
      }
    }

    if (!body.child_name || typeof body.child_name !== 'string' || !body.child_name.trim()) {
      logger.error('创建试听课程失败 - 孩子称呼为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '孩子称呼不能为空' },
        { status: 400 }
      )
    }

    if (!body.region || typeof body.region !== 'string' || !body.region.trim()) {
      logger.error('创建试听课程失败 - 地域为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '地域不能为空' },
        { status: 400 }
      )
    }

    if (!body.grade || typeof body.grade !== 'string' || !body.grade.trim()) {
      logger.error('创建试听课程失败 - 年级为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '年级不能为空' },
        { status: 400 }
      )
    }

    if (!body.trial_subject || typeof body.trial_subject !== 'string' || !body.trial_subject.trim()) {
      logger.error('创建试听课程失败 - 试听科目为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '试听科目不能为空' },
        { status: 400 }
      )
    }

    if (!body.trial_time || typeof body.trial_time !== 'string' || !body.trial_time.trim()) {
      logger.error('创建试听课程失败 - 试听时间为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '试听时间不能为空' },
        { status: 400 }
      )
    }

    if (body.trial_duration === undefined || body.trial_duration === null || isNaN(body.trial_duration)) {
      logger.error('创建试听课程失败 - 试听时长无效', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '试听时长不能为空' },
        { status: 400 }
      )
    }

    if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
      logger.error('创建试听课程失败 - 手机号为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '手机号不能为空' },
        { status: 400 }
      )
    }

    if (!body.channel || typeof body.channel !== 'string' || !body.channel.trim()) {
      logger.error('创建试听课程失败 - 渠道为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '渠道不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_proof || typeof body.payment_proof !== 'string' || !body.payment_proof.trim()) {
      logger.error('创建试听课程失败 - 付款凭证为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '付款凭证不能为空' },
        { status: 400 }
      )
    }

    const urgencyLevel = normalizeTrialUrgencyLevel(body.urgency_level)
    if (urgencyLevel === 'invalid') {
      logger.warn('创建试听课程失败 - 紧急程度非法', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '紧急程度只能选择低、中、高或紧急' },
        { status: 400 }
      )
    }

    const insertData: Record<string, any> = {
      child_name: body.child_name.trim(),
      status: body.status || 'pending',
      lead_id: leadId,
      student_id: studentId,
      region: body.region.trim(),
      grade: body.grade.trim(),
      trial_subject: body.trial_subject.trim(),
      trial_time: body.trial_time,
      trial_duration: parseFloat(body.trial_duration),
      phone: body.phone.trim(),
      channel: body.channel?.trim() || '',
      trial_amount: body.trial_amount !== undefined ? parseFloat(body.trial_amount) : null,
      payment_proof: body.payment_proof.trim(),
      urgency_level: urgencyLevel,
      notes: body.notes?.trim() || null,
      assigned_consultant: body.assigned_consultant?.trim() || profile.name || null,
      course_status: body.course_status?.trim() || null,
      student_type: body.student_type?.trim() || null,
      matched_teacher: body.matched_teacher?.trim() || null,
      confirmed_teacher: body.confirmed_teacher?.trim() || null,
      class_link: body.class_link?.trim() || null,
      classin_student_uid: null,
      classin_student_registered_at: null,
    }

    if (insertData.matched_teacher) {
      const matchedTeacher = await findAvailableTrialTeacherByName(insertData.matched_teacher)

      if (!matchedTeacher) {
        logger.warn('创建试听课程失败 - 匹配老师不在老师库或 ClassIn 目录中', {
          has_matched_teacher: true,
        })
        return NextResponse.json(
          { error: '请选择老师库或 ClassIn 中已有的匹配老师' },
          { status: 400 }
        )
      }

      insertData.matched_teacher = matchedTeacher.name
    }

    if (insertData.confirmed_teacher) {
      const classinTeacher = await ensureClassInTeacherAccountByName(insertData.confirmed_teacher)

      if (!classinTeacher.uid) {
        logger.warn('创建试听课程失败 - 确认老师未能绑定 ClassIn', {
          teacher_id: classinTeacher.teacherId,
          has_error: Boolean(classinTeacher.error),
        })
        return NextResponse.json(
          { error: '确认老师时创建 ClassIn 老师账号失败' },
          { status: 400 }
        )
      }

      logger.info('创建试听课程时已绑定确认老师 ClassIn', {
        teacher_id: classinTeacher.teacherId,
        classin_uid: classinTeacher.uid,
        source: classinTeacher.source,
      })
    }

    // 环节1：创建 ClassIn 学生账号（在插入试听课程之前）
    let classinStudentUid: string | null = null
    let classinStudentRegisteredAt: string | null = null
    try {
      const classinStudent = await ensureClassInStudentAccount({
        telephone: insertData.phone,
        nickname: insertData.child_name,
      })

      if (!classinStudent.uid) {
        logger.error('创建试听课程失败 - ClassIn 学生账号创建失败', {
          error_summary: summarizeError(classinStudent.error),
        })
        return NextResponse.json(
          { error: '创建 ClassIn 学生账号失败，试听课程未创建' },
          { status: 400 }
        )
      }

      classinStudentUid = String(classinStudent.uid)
      classinStudentRegisteredAt = new Date().toISOString()

      logger.info('创建试听课程时已创建 ClassIn 学生账号', {
        has_classin_student_uid: true,
        source: classinStudent.source,
      })
    } catch (classinError: unknown) {
      logger.error('创建试听课程失败 - ClassIn 学生账号创建异常', {
        error_summary: summarizeError(classinError),
      })
      return NextResponse.json(
        { error: '创建 ClassIn 学生账号失败，试听课程未创建' },
        { status: 400 }
      )
    }

    // 将 ClassIn 学生信息加入插入数据
    insertData.classin_student_uid = classinStudentUid
    insertData.classin_student_registered_at = classinStudentRegisteredAt

    logger.debug('创建试听课程 - 准备插入的数据', {
      insert_summary: summarizeTrialLessonPayload(insertData),
    })

    // 环节2：插入试听课程
    const { data, error } = await supabaseServer
      .from('trial_lessons')
      .insert(insertData)
      .select(TRIAL_LESSON_SELECT_BASE)
      .single()

    if (error) {
      logger.error('创建试听课程失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 环节3：回写线索转化状态
    if (leadId) {
      const { error: updateLeadError } = await supabaseServer
        .from('leads')
        .update({
          add_status: 'added',
          conversion_status: 'trial',
          updated_by: profile.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      if (updateLeadError) {
        logger.error('试听创建后回写线索转化状态失败，回滚试听课程', {
          id: data.id,
          lead_id: leadId,
          error_summary: summarizeError(updateLeadError),
        })

        await supabaseServer
          .from('trial_lessons')
          .delete()
          .eq('id', data.id)

        return NextResponse.json(
          { error: '回写线索转化状态失败，试听课程未创建' },
          { status: 500 }
        )
      }
    }

    let responseData = data

    logger.info('创建试听课程成功', { id: data.id })
    return NextResponse.json({
      data: redactTrialLessonSensitiveFields(await enrichTrialLessonStatus(responseData), profile)
    }, { status: 201 })
  } catch (error: unknown) {
    logger.error('创建试听课程异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建试听课程失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新试听课程
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)

    const { id, ...updateData } = body
    const updateSummary = summarizeTrialLessonPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少试听课程ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    logger.debug('更新试听课程 - 接收到的数据', { id, update_summary: updateSummary })

    const [accessibleLeadIds, accessibleStudentIds] = await Promise.all([
      getAccessibleLeadIds(profile),
      getAccessibleStudentIds(profile),
    ])
    let accessQuery = supabaseServer
      .from('trial_lessons')
      .select('id, confirmed_teacher, lead_id, student_id, classin_course_id, classin_class_id, classin_activity_id, trial_time, trial_duration')
      .eq('id', id)

    accessQuery = applyTrialScope(accessQuery, profile, accessibleLeadIds, accessibleStudentIds)

    const { data: accessibleLesson, error: accessError } = await accessQuery.maybeSingle()

    if (accessError) {
      logger.error('校验试听课程访问权限失败', { id, error_summary: summarizeError(accessError) })
      const { message, status } = handleDatabaseError(accessError)
      return NextResponse.json({ error: message }, { status })
    }

    if (!accessibleLesson) {
      logger.warn('更新试听课程失败 - 无权访问试听课程', {
        id,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '无权更新该试听课程' },
        { status: 403 }
      )
    }

    if (updateData.lead_id !== undefined) {
      const nextLeadId = updateData.lead_id ? String(updateData.lead_id).trim() : null
      const currentLeadId = accessibleLesson.lead_id || null

      if (nextLeadId !== currentLeadId) {
        logger.warn('更新试听课程失败 - 不允许修改来源线索', {
          id,
          user_id: profile.id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '试听课程来源线索不可修改' },
          { status: 400 }
        )
      }
    }

    if (updateData.student_id !== undefined) {
      const nextStudentId = updateData.student_id ? String(updateData.student_id).trim() : null
      const currentStudentId = accessibleLesson.student_id || null

      if (nextStudentId !== currentStudentId) {
        logger.warn('更新试听课程失败 - 不允许修改来源正式生', {
          id,
          user_id: profile.id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '试听课程来源正式生不可修改' },
          { status: 400 }
        )
      }
    }

    // 后端验证：必填字段
    if (updateData.child_name !== undefined && (!updateData.child_name || !updateData.child_name.trim())) {
      logger.error('更新试听课程失败 - 孩子称呼为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '孩子称呼不能为空' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'child_name', 'status', 'region', 'grade', 'trial_subject',
      'trial_time', 'trial_duration', 'phone', 'channel', 'trial_amount',
      'payment_proof', 'urgency_level', 'notes', 'assigned_consultant',
      'course_status', 'student_type', 'matched_teacher', 'confirmed_teacher',
      'class_link'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    if (updatePayload.class_link !== undefined) {
      updatePayload.class_link = String(updatePayload.class_link || '').trim() || null
    }

    if (updatePayload.urgency_level !== undefined) {
      const urgencyLevel = normalizeTrialUrgencyLevel(updatePayload.urgency_level)

      if (urgencyLevel === 'invalid') {
        logger.warn('更新试听课程失败 - 紧急程度非法', { id, update_summary: updateSummary })
        return NextResponse.json(
          { error: '紧急程度只能选择低、中、高或紧急' },
          { status: 400 }
        )
      }

      updatePayload.urgency_level = urgencyLevel
    }

    if (updatePayload.matched_teacher !== undefined) {
      const matchedTeacherName = String(updatePayload.matched_teacher || '').trim()

      if (matchedTeacherName) {
        const matchedTeacher = await findAvailableTrialTeacherByName(matchedTeacherName)

        if (!matchedTeacher) {
          logger.warn('更新试听课程失败 - 匹配老师不在老师库或 ClassIn 目录中', {
            id,
            has_matched_teacher: true,
          })
          return NextResponse.json(
            { error: '请选择老师库或 ClassIn 中已有的匹配老师' },
            { status: 400 }
          )
        }

        updatePayload.matched_teacher = matchedTeacher.name
      } else {
        updatePayload.matched_teacher = null
      }
    }

    let newClassInTeacherUid: number | undefined
    let confirmedTeacherChanged = false

    if (updatePayload.confirmed_teacher !== undefined) {
      const confirmedTeacher = String(updatePayload.confirmed_teacher || '').trim()

      if (confirmedTeacher) {
        const previousTeacher = String(accessibleLesson.confirmed_teacher || '').trim()

        if (confirmedTeacher !== previousTeacher) {
          confirmedTeacherChanged = true
          const classinTeacher = await ensureClassInTeacherAccountByName(confirmedTeacher)

          if (!classinTeacher.uid) {
            logger.warn('更新试听课程失败 - 确认老师未能绑定 ClassIn', {
              id,
              teacher_id: classinTeacher.teacherId,
              has_error: Boolean(classinTeacher.error),
            })
            return NextResponse.json(
              { error: '确认老师时创建 ClassIn 老师账号失败' },
              { status: 400 }
            )
          }

          newClassInTeacherUid = classinTeacher.uid

          logger.info('确认试听老师已绑定 ClassIn', {
            id,
            teacher_id: classinTeacher.teacherId,
            classin_uid: classinTeacher.uid,
            source: classinTeacher.source,
          })
        }

        updatePayload.confirmed_teacher = confirmedTeacher
      } else {
        updatePayload.confirmed_teacher = null
      }
    }

    logger.debug('更新试听课程 - 准备更新的数据', {
      id,
      update_summary: summarizeTrialLessonPayload(updatePayload),
    })

    const { data, error } = await supabaseServer
      .from('trial_lessons')
      .update(updatePayload)
      .eq('id', id)
      .select(TRIAL_LESSON_SELECT_BASE)
      .single()

    if (error) {
      logger.error('更新试听课程失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 同步更新 ClassIn 课堂老师（如果确认老师变更且已有 ClassIn 课堂）
    if (confirmedTeacherChanged && newClassInTeacherUid && data?.classin_class_id && data?.classin_course_id) {
      try {
        const sdk = getClassInSDKService()
        await sdk.updateClassroom({
          courseId: data.classin_course_id,
          classId: data.classin_class_id,
          activityId: data.classin_activity_id || data.classin_class_id,
          teacherUid: newClassInTeacherUid,
          teacherName: data.confirmed_teacher || undefined,
        })
        logger.info('同步更新 ClassIn 课堂老师成功', {
          id,
          class_id: data.classin_class_id,
          new_teacher_uid: newClassInTeacherUid,
        })
      } catch (classinError: unknown) {
        logger.warn('同步更新 ClassIn 课堂老师失败（非致命）', {
          id,
          class_id: data.classin_class_id,
          new_teacher_uid: newClassInTeacherUid,
          error_summary: summarizeError(classinError),
        })
      }
    }

    // 同步更新 ClassIn 课堂时间（如果试听时间变更且已有 ClassIn 课堂）
    const trialTimeChanged = updatePayload.trial_time !== undefined &&
      String(updatePayload.trial_time || '') !== String(accessibleLesson.trial_time || '')
    const trialDurationChanged = updatePayload.trial_duration !== undefined &&
      Number(updatePayload.trial_duration) !== Number(accessibleLesson.trial_duration)

    if ((trialTimeChanged || trialDurationChanged) && data?.classin_class_id && data?.classin_course_id && data?.trial_time) {
      try {
        const sdk = getClassInSDKService()
        const trialTimeISO = ensureChinaTimezone(data.trial_time)
        const trialTime = new Date(trialTimeISO)
        const durationMinutes = Number(data.trial_duration) || 60
        const durationMs = (durationMinutes / 60) * 60 * 60 * 1000
        const endTime = new Date(trialTime.getTime() + durationMs)

        await sdk.updateClassroom({
          courseId: data.classin_course_id,
          classId: data.classin_class_id,
          activityId: data.classin_activity_id || data.classin_class_id,
          beginTime: trialTime,
          endTime: endTime,
        })
        logger.info('同步更新 ClassIn 课堂时间成功', {
          id,
          class_id: data.classin_class_id,
          new_trial_time: data.trial_time,
        })
      } catch (classinTimeError: unknown) {
        logger.warn('同步更新 ClassIn 课堂时间失败（非致命）', {
          id,
          class_id: data.classin_class_id,
          error_summary: summarizeError(classinTimeError),
        })
      }
    }

    let responseData = data

    if (data?.phone && (updatePayload.phone !== undefined || !data.classin_student_uid)) {
      try {
        const classinStudent = await ensureClassInStudentAccount({
          telephone: data.phone,
          nickname: data.child_name || '学生',
        })

        const classinUpdate = {
          classin_student_uid: classinStudent.uid || null,
          classin_student_registered_at: classinStudent.uid ? new Date().toISOString() : null,
          classin_student_error: classinStudent.uid
            ? null
            : CLASSIN_STUDENT_ERROR_MESSAGE,
          updated_at: new Date().toISOString(),
        }

        const { data: updatedLesson, error: updateClassInError } = await supabaseServer
          .from('trial_lessons')
          .update(classinUpdate)
          .eq('id', id)
          .select(TRIAL_LESSON_SELECT_BASE)
          .single()

        if (updateClassInError) {
          logger.warn('更新试听后保存 ClassIn 学生绑定结果失败', {
            id,
            error_summary: summarizeError(updateClassInError),
          })
          responseData = {
            ...responseData,
            ...classinUpdate,
          }
        } else if (updatedLesson) {
          responseData = updatedLesson
        }
      } catch (classinError: unknown) {
        logger.warn('更新试听后创建 ClassIn 学生账号异常', {
          id,
          error_summary: summarizeError(classinError),
        })

        await supabaseServer
          .from('trial_lessons')
          .update({
            classin_student_uid: updatePayload.phone !== undefined ? null : data.classin_student_uid,
            classin_student_error: CLASSIN_STUDENT_ERROR_MESSAGE,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        responseData = {
          ...responseData,
          classin_student_uid: updatePayload.phone !== undefined ? null : data.classin_student_uid,
          classin_student_error: CLASSIN_STUDENT_ERROR_MESSAGE,
        }
      }
    }

    logger.info('更新试听课程成功', { id })
    return NextResponse.json({
      data: redactTrialLessonSensitiveFields(await enrichTrialLessonStatus(responseData), profile)
    })
  } catch (error: unknown) {
    logger.error('更新试听课程异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新试听课程失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除试听课程
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const profile = await getCurrentProfile(request)

    if (!id) {
      return NextResponse.json(
        { error: '缺少试听课程ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    logger.debug('删除试听课程', { id })

    const [accessibleLeadIds, accessibleStudentIds] = await Promise.all([
      getAccessibleLeadIds(profile),
      getAccessibleStudentIds(profile),
    ])
    let accessQuery = supabaseServer
      .from('trial_lessons')
      .select('id')
      .eq('id', id)

    accessQuery = applyTrialScope(accessQuery, profile, accessibleLeadIds, accessibleStudentIds)

    const { data: accessibleLesson, error: accessError } = await accessQuery.maybeSingle()

    if (accessError) {
      logger.error('校验试听课程删除权限失败', { id, error_summary: summarizeError(accessError) })
      const { message, status } = handleDatabaseError(accessError)
      return NextResponse.json({ error: message }, { status })
    }

    if (!accessibleLesson) {
      logger.warn('删除试听课程失败 - 无权访问试听课程', {
        id,
        user_id: profile.id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '无权删除该试听课程' },
        { status: 403 }
      )
    }

    const { error } = await supabaseServer
      .from('trial_lessons')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除试听课程失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除试听课程成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error('删除试听课程异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除试听课程失败' },
      { status: 500 }
    )
  }
}
