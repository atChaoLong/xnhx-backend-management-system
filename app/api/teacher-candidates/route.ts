import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { summarizeError } from "@/lib/safe-error"
import { ACTIONS, RESOURCES, Role, hasPermission } from "@/lib/permissions"
import { calculateInterviewStatus, getInterviewStatusName } from "@/lib/status-calculator"

const logger = createLogger('API:TeacherCandidates')

const TEACHER_CANDIDATE_SELECT = `
  id,
  created_at,
  updated_at,
  name,
  wechat_id,
  phone,
  daily_lead_id,
  resume_url,
  profile_photo_url,
  grade_level,
  subjects_taught,
  teacher_type,
  trial_subject,
  teaching_style,
  interview_date,
  interviewer_name,
  interview_time,
  interview_link,
  interview_officer,
  interview_exception,
  video_recording_url,
  trial_video_url,
  interview_notes,
  interview_month,
  interview_week,
  registration_date,
  interview_score,
  interview_rating,
  logical_expression_score,
  dress_appearance_score,
  material_preparation_score,
  exam_score,
  initial_evaluation,
  teacher_characteristics,
  mandarin_level,
  research_ability,
  service_awareness,
  affinity,
  review_status,
  reviewed_by,
  review_result,
  review_evaluation_comment,
  review_notes,
  review_date,
  teacher_level,
  can_teach_graduation_class,
  is_hired,
  teacher_feeling,
  suitable_for_students,
  scheduling_preference,
  hired_notes,
  qr_code_url,
  current_rate,
  approved_hourly_rate,
  bank_account,
  bank_account_name,
  bank_name,
  bank_branch,
  notes_external,
  grade_level_rates,
  grade_level_settings,
  interview_result,
  recruitment_step,
  recruitment_status,
  video_reviewed_at,
  reviewed_by_id,
  salary_confirmed_at,
  salary_confirmed_by_id
`

const TEACHER_CANDIDATE_FALLBACK_SELECT = `
  id,
  created_at,
  updated_at,
  name,
  wechat_id,
  daily_lead_id,
  resume_url,
  profile_photo_url,
  grade_level,
  subjects_taught,
  teacher_type,
  trial_subject,
  teaching_style,
  interview_date,
  interviewer_name,
  interview_time,
  interview_link,
  interview_officer,
  interview_exception,
  video_recording_url,
  trial_video_url,
  interview_month,
  interview_week,
  registration_date,
  interview_score,
  logical_expression_score,
  dress_appearance_score,
  material_preparation_score,
  exam_score,
  initial_evaluation,
  teacher_characteristics,
  mandarin_level,
  research_ability,
  service_awareness,
  affinity,
  review_status,
  reviewed_by,
  review_result,
  review_evaluation_comment,
  review_notes,
  review_date,
  teacher_level,
  can_teach_graduation_class,
  is_hired,
  teacher_feeling,
  suitable_for_students,
  scheduling_preference,
  hired_notes,
  qr_code_url,
  current_rate,
  approved_hourly_rate
`

function isMissingTeacherCandidateColumnError(error: unknown) {
  const err = typeof error === 'object' && error !== null && !Array.isArray(error)
    ? error as Record<string, any>
    : {}
  const code = String(err.code || '')
  const message = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase()

  return code === '42703' ||
    code === 'PGRST204' ||
    (message.includes('column') && message.includes('does not exist')) ||
    message.includes('could not find') ||
    message.includes('schema cache')
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function hasUuidString(value: unknown): boolean {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

function summarizeTeacherCandidatePayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_name: hasNonEmptyString(payload?.name),
    has_wechat_id: hasNonEmptyString(payload?.wechat_id),
    has_daily_lead_id: hasNonEmptyString(payload?.daily_lead_id),
    has_resume_url: hasNonEmptyString(payload?.resume_url),
    has_profile_photo_url: hasNonEmptyString(payload?.profile_photo_url),
    has_interview_link: hasNonEmptyString(payload?.interview_link),
    has_video_recording_url: hasNonEmptyString(payload?.video_recording_url),
    has_trial_video_url: hasNonEmptyString(payload?.trial_video_url),
    has_interview_notes: hasNonEmptyString(payload?.interview_notes),
    has_interview_exception: hasNonEmptyString(payload?.interview_exception),
    has_review_comment: hasNonEmptyString(payload?.review_evaluation_comment),
    has_review_notes: hasNonEmptyString(payload?.review_notes),
    has_hired_notes: hasNonEmptyString(payload?.hired_notes),
    has_notes_external: hasNonEmptyString(payload?.notes_external),
    has_qr_code_url: hasNonEmptyString(payload?.qr_code_url),
    has_current_rate: hasValue(payload?.current_rate),
    has_approved_hourly_rate: hasValue(payload?.approved_hourly_rate),
    has_bank_account: hasNonEmptyString(payload?.bank_account),
    has_bank_account_name: hasNonEmptyString(payload?.bank_account_name),
    has_bank_name: hasNonEmptyString(payload?.bank_name),
    has_bank_branch: hasNonEmptyString(payload?.bank_branch),
  }
}

const TEACHER_CANDIDATE_LEGACY_WRITE_FIELDS = [
  'name',
  'wechat_id',
  'daily_lead_id',
  'resume_url',
  'profile_photo_url',
  'grade_level',
  'subjects_taught',
  'teacher_type',
  'trial_subject',
  'teaching_style',
  'interview_date',
  'interviewer_name',
  'interview_time',
  'interview_link',
  'interview_officer',
  'interview_exception',
  'video_recording_url',
  'trial_video_url',
  'interview_month',
  'interview_week',
  'registration_date',
  'interview_score',
  'logical_expression_score',
  'dress_appearance_score',
  'material_preparation_score',
  'exam_score',
  'initial_evaluation',
  'teacher_characteristics',
  'mandarin_level',
  'research_ability',
  'service_awareness',
  'affinity',
  'review_status',
  'reviewed_by',
  'review_result',
  'review_evaluation_comment',
  'review_notes',
  'review_date',
  'teacher_level',
  'can_teach_graduation_class',
  'is_hired',
  'teacher_feeling',
  'suitable_for_students',
  'scheduling_preference',
  'hired_notes',
  'qr_code_url',
  'current_rate',
  'approved_hourly_rate',
] as const

function pickTeacherCandidatePayload(payload: Record<string, any>) {
  return TEACHER_CANDIDATE_LEGACY_WRITE_FIELDS.reduce<Record<string, any>>((picked, field) => {
    if (payload[field] !== undefined) {
      picked[field] = payload[field]
    }
    return picked
  }, {})
}

const TEACHER_CANDIDATE_UPDATE_FIELDS = [
  'name', 'wechat_id', 'daily_lead_id', 'resume_url', 'profile_photo_url',
  'grade_level', 'subjects_taught', 'teacher_type', 'trial_subject', 'teaching_style',
  'interview_date', 'interviewer_name', 'interview_time', 'interview_link', 'interview_officer',
  'interview_exception', 'video_recording_url', 'trial_video_url', 'interview_notes',
  'interview_month', 'interview_week', 'registration_date',
  'interview_score', 'interview_rating', 'logical_expression_score',
  'dress_appearance_score', 'material_preparation_score', 'exam_score',
  'initial_evaluation', 'teacher_characteristics',
  'mandarin_level', 'research_ability', 'service_awareness', 'affinity',
  'review_status', 'reviewed_by', 'review_result', 'review_evaluation_comment', 'review_notes',
  'review_date', 'teacher_level', 'can_teach_graduation_class',
  'is_hired', 'teacher_feeling', 'suitable_for_students', 'scheduling_preference',
  'hired_notes', 'qr_code_url', 'current_rate', 'approved_hourly_rate',
  'bank_account', 'bank_account_name', 'bank_name', 'bank_branch', 'notes_external',
  'grade_level_rates', 'grade_level_settings'
]

const RECRUITER_UPDATE_FIELDS = new Set([
  'name', 'wechat_id', 'daily_lead_id', 'resume_url', 'profile_photo_url',
  'grade_level', 'subjects_taught', 'teacher_type', 'trial_subject', 'teaching_style',
  'interview_date', 'interviewer_name', 'interview_time', 'interview_link', 'interview_officer',
  'interview_exception', 'video_recording_url', 'interview_notes',
  'interview_month', 'interview_week', 'registration_date',
  'interview_score', 'logical_expression_score',
  'dress_appearance_score', 'material_preparation_score', 'exam_score',
  'initial_evaluation', 'teacher_characteristics',
  'mandarin_level', 'research_ability', 'service_awareness', 'affinity',
  'teacher_feeling', 'suitable_for_students',
  'qr_code_url', 'current_rate', 'approved_hourly_rate',
  'grade_level_rates', 'grade_level_settings'
])

const ACADEMIC_UPDATE_FIELDS = new Set([
  'name', 'wechat_id', 'daily_lead_id', 'resume_url', 'profile_photo_url',
  'grade_level', 'subjects_taught',
  'interview_date', 'interviewer_name', 'interview_time', 'interview_link', 'interview_officer',
  'interview_exception',
  'trial_video_url', 'interview_score', 'interview_rating', 'logical_expression_score',
  'dress_appearance_score', 'material_preparation_score', 'initial_evaluation',
  'teacher_characteristics', 'mandarin_level', 'research_ability', 'service_awareness', 'affinity',
  'review_status', 'reviewed_by', 'review_result', 'review_evaluation_comment',
  'review_notes',
  'review_date', 'teacher_level', 'can_teach_graduation_class',
  'scheduling_preference', 'hired_notes',
  'trial_subject', 'teacher_type', 'approved_hourly_rate',
  'bank_account', 'bank_account_name', 'bank_name', 'bank_branch', 'notes_external'
])

const ENTRY_CONFIRM_UPDATE_FIELDS = new Set([
  'grade_level', 'subjects_taught', 'teacher_type', 'trial_subject',
  'teacher_level', 'can_teach_graduation_class',
  'approved_hourly_rate', 'bank_account', 'bank_account_name', 'bank_name', 'bank_branch',
  'hired_notes', 'notes_external'
])

const ENTRY_SENSITIVE_FIELDS = [
  'bank_account',
  'bank_account_name',
  'bank_name',
  'bank_branch',
  'notes_external',
] as const

function getAllowedUpdateFields(role?: string) {
  if (role === 'admin') return new Set(TEACHER_CANDIDATE_UPDATE_FIELDS)
  if (role === 'teacher_recruiter') return RECRUITER_UPDATE_FIELDS
  if (role === 'academic_affairs') return ACADEMIC_UPDATE_FIELDS
  if (role === 'finance' || role === 'hr') return ENTRY_CONFIRM_UPDATE_FIELDS
  return new Set<string>()
}

function isAdminRole(role?: string) {
  return role === 'admin'
}

function canViewEntrySensitiveFields(role?: string) {
  if (role === 'admin') return true
  return hasPermission(role as Role | undefined, RESOURCES.teacherCandidates, ACTIONS.confirmEntry)
}

function isEntryConfirmOnlyRole(role?: string) {
  return role === 'finance' || role === 'hr'
}

function isPendingEntryCandidate(candidate: Record<string, any> | null | undefined) {
  return candidate?.review_result === '通过' && candidate?.is_hired !== true
}

function sanitizeTeacherCandidate<T extends Record<string, any> | null>(candidate: T, role?: string): T {
  if (!candidate || canViewEntrySensitiveFields(role)) return candidate

  const sanitized: Record<string, any> = { ...candidate }
  ENTRY_SENSITIVE_FIELDS.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = null
    }
  })
  return sanitized as T
}

function sanitizeTeacherCandidates<T extends Record<string, any>>(candidates: T[] | null | undefined, role?: string): T[] {
  return (candidates || []).map((candidate) => sanitizeTeacherCandidate(candidate, role))
}

function attachTeacherCandidateStatus<T extends Record<string, any> | null>(candidate: T): T {
  if (!candidate) return candidate
  const interviewStatus = calculateInterviewStatus(candidate)
  return {
    ...candidate,
    interview_status: interviewStatus,
    interview_status_name: getInterviewStatusName(interviewStatus),
  } as T
}

function attachTeacherCandidatesStatus<T extends Record<string, any>>(candidates: T[] | null | undefined): T[] {
  return (candidates || []).map((candidate) => attachTeacherCandidateStatus(candidate))
}

function applyTeacherCandidateQueueFilter(query: any, queue: string | undefined) {
  if (queue === 'scheduling') {
    return query
      .or('interview_date.is.null,interview_date.eq.')
      .or('video_recording_url.is.null,video_recording_url.eq.')
      .or('is_hired.is.null,is_hired.eq.false')
  }

  if (queue === 'pending_entry') {
    return query
      .eq('review_result', '通过')
      .or('is_hired.is.null,is_hired.eq.false')
  }

  if (queue === 'video_upload') {
    return query
      .not('interview_date', 'is', null)
      .or('video_recording_url.is.null,video_recording_url.eq.')
      .or('is_hired.is.null,is_hired.eq.false')
  }

  if (queue === 'teaching_review') {
    return query
      .not('video_recording_url', 'is', null)
      .or('review_result.is.null,review_result.eq.')
      .or('is_hired.is.null,is_hired.eq.false')
  }

  if (queue === 'reserve') {
    return query
      .or('review_result.eq.不符合,review_status.eq.不符合')
      .or('is_hired.is.null,is_hired.eq.false')
  }

  return query
}

function buildTeacherCandidateListQuery(selectFields: string, name?: string, queue?: string) {
  let listQuery = supabaseServer
    .from('teacher_candidates')
    .select(selectFields)
    .order('interview_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (name) {
    listQuery = listQuery.eq('name', name)
  }

  return applyTeacherCandidateQueueFilter(listQuery, queue)
}

// GET: 获取老师面试列表（支持ID查询单个和分页）
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json(
        { error: '没有查看老师面试记录的权限' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const name = searchParams.get('name')?.trim()
    const queue = searchParams.get('queue')?.trim()
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    if (isEntryConfirmOnlyRole(profile.role) && !id && queue !== 'pending_entry') {
      logger.warn('待入库确认角色访问非待入库候选人列表被拒绝', {
        role: profile.role,
        queue,
      })
      return NextResponse.json(
        { error: '只能查看待入库老师队列' },
        { status: 403 }
      )
    }

    logger.debug('获取老师面试数据', {
      id,
      has_name_filter: Boolean(name),
      queue,
      from,
      to,
    })

    // 如果提供了ID，查询单个候选
    if (id) {
      const result = await supabaseServer
        .from('teacher_candidates')
        .select(TEACHER_CANDIDATE_SELECT)
        .eq('id', id)
        .single()
      let data = result.data as Record<string, any> | null
      let error = result.error

      if (error && isMissingTeacherCandidateColumnError(error)) {
        logger.warn('老师面试详情字段与线上库结构不一致，回退到基础字段查询', {
          id,
          error_summary: summarizeError(error),
        })
        const fallbackResult = await supabaseServer
          .from('teacher_candidates')
          .select(TEACHER_CANDIDATE_FALLBACK_SELECT)
          .eq('id', id)
          .single()
        data = fallbackResult.data as Record<string, any> | null
        error = fallbackResult.error
      }

      if (error) {
        logger.error('获取老师面试失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取老师面试失败' },
          { status: 400 }
        )
      }

      if (isEntryConfirmOnlyRole(profile.role) && !isPendingEntryCandidate(data)) {
        logger.warn('待入库确认角色访问非待入库候选人详情被拒绝', {
          id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '只能查看待入库老师详情' },
          { status: 403 }
        )
      }

      logger.debug('获取老师面试成功', { id })
      return NextResponse.json({ data: attachTeacherCandidateStatus(sanitizeTeacherCandidate(data, profile.role)) })
    }

    // 先获取总数
    let countQuery = supabaseServer
      .from('teacher_candidates')
      .select('id', { count: 'exact', head: true })

    if (name) {
      countQuery = countQuery.eq('name', name)
    }
    countQuery = applyTeacherCandidateQueueFilter(countQuery, queue)

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      logger.error('获取老师面试数量失败', {
        has_name_filter: Boolean(name),
        queue,
        error_summary: summarizeError(countError),
      })
      return NextResponse.json(
        { error: '获取老师面试列表失败' },
        { status: 400 }
      )
    }

    // 分页查询数据，按面试日期降序排序
    let listQuery = buildTeacherCandidateListQuery(TEACHER_CANDIDATE_SELECT, name, queue)

    const listResult = await listQuery.range(from, to)
    let data = listResult.data as Record<string, any>[] | null
    let error = listResult.error

    if (error && isMissingTeacherCandidateColumnError(error)) {
      logger.warn('老师面试列表字段与线上库结构不一致，回退到基础字段查询', {
        has_name_filter: Boolean(name),
        queue,
        error_summary: summarizeError(error),
      })
      listQuery = buildTeacherCandidateListQuery(TEACHER_CANDIDATE_FALLBACK_SELECT, name, queue)
      const fallbackResult = await listQuery.range(from, to)
      data = fallbackResult.data as Record<string, any>[] | null
      error = fallbackResult.error
    }

    if (error) {
      logger.error('获取老师面试列表失败', {
        has_name_filter: Boolean(name),
        queue,
        error_summary: summarizeError(error),
      })
      return NextResponse.json(
        { error: '获取老师面试列表失败' },
        { status: 400 }
      )
    }

    logger.debug('获取老师面试列表成功', {
      count: data?.length || 0,
      total_count: totalCount || 0,
      has_name_filter: Boolean(name),
      queue,
    })
    return NextResponse.json({
      data: attachTeacherCandidatesStatus(sanitizeTeacherCandidates(data, profile.role)),
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error) {
    logger.error('获取老师面试异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取老师面试失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新老师面试
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json(
        { error: '没有创建老师面试记录的权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const isAdmin = isAdminRole(profile.role)
    const bodySummary = summarizeTeacherCandidatePayload(body)

    logger.debug('创建老师面试 - 接收到的数据', { body_summary: bodySummary })

    // 后端验证：必填字段
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      logger.error('创建老师面试失败 - 姓名为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const insertData = {
      name: body.name.trim(),
      wechat_id: body.wechat_id && typeof body.wechat_id === 'string' ? body.wechat_id.trim() : null,
      daily_lead_id: body.daily_lead_id || null,
      resume_url: body.resume_url || null,
      profile_photo_url: body.profile_photo_url || null,
      grade_level: body.grade_level || null,
      subjects_taught: body.subjects_taught || null,
      teacher_type: body.teacher_type || null,
      trial_subject: body.trial_subject || null,
      teaching_style: body.teaching_style || null,
      interview_date: body.interview_date || today,
      interviewer_name: body.interviewer_name || null,
      interview_time: body.interview_time || null,
      interview_link: body.interview_link || null,
      interview_officer: body.interview_officer || null,
      interview_exception: body.interview_exception || null,
      video_recording_url: body.video_recording_url || null,
      trial_video_url: isAdmin ? body.trial_video_url || null : null,
      interview_notes: body.interview_notes || null,
      interview_month: body.interview_month || null,
      interview_week: body.interview_week || null,
      registration_date: body.registration_date || null,
      interview_score: body.interview_score || null,
      interview_rating: isAdmin ? body.interview_rating || null : null,
      logical_expression_score: body.logical_expression_score || null,
      dress_appearance_score: body.dress_appearance_score || null,
      material_preparation_score: body.material_preparation_score || null,
      exam_score: body.exam_score || null,
      initial_evaluation: body.initial_evaluation || null,
      teacher_characteristics: body.teacher_characteristics || null,
      mandarin_level: body.mandarin_level || null,
      research_ability: body.research_ability || null,
      service_awareness: body.service_awareness || null,
      affinity: body.affinity || null,
      review_status: isAdmin ? body.review_status || '待复核' : '待复核',
      reviewed_by: isAdmin ? body.reviewed_by || null : null,
      review_result: isAdmin ? body.review_result || null : null,
      review_evaluation_comment: isAdmin ? body.review_evaluation_comment || null : null,
      review_notes: isAdmin ? body.review_notes || null : null,
      review_date: isAdmin ? body.review_date || null : null,
      teacher_level: isAdmin ? body.teacher_level || null : null,
      can_teach_graduation_class: isAdmin ? body.can_teach_graduation_class || null : null,
      is_hired: isAdmin && body.is_hired !== undefined ? body.is_hired : false,
      teacher_feeling: body.teacher_feeling || null,
      suitable_for_students: body.suitable_for_students || null,
      scheduling_preference: isAdmin ? body.scheduling_preference || null : null,
      hired_notes: isAdmin ? body.hired_notes || null : null,
      qr_code_url: body.qr_code_url || null,
      current_rate: body.current_rate || null,
      approved_hourly_rate: body.approved_hourly_rate || null,
      bank_account: isAdmin ? body.bank_account || null : null,
      bank_account_name: isAdmin ? body.bank_account_name || null : null,
      bank_name: isAdmin ? body.bank_name || null : null,
      bank_branch: isAdmin ? body.bank_branch || null : null,
      notes_external: isAdmin ? body.notes_external || null : null,
      grade_level_rates: body.grade_level_rates || null,
      grade_level_settings: body.grade_level_settings || null,
    }

    logger.debug('创建老师面试 - 准备插入的数据', {
      insert_summary: summarizeTeacherCandidatePayload(insertData),
    })

    const createResult = await supabaseServer
      .from('teacher_candidates')
      .insert(insertData)
      .select(TEACHER_CANDIDATE_SELECT)
      .single()
    let data = createResult.data as Record<string, any> | null
    let error = createResult.error

    if (error && isMissingTeacherCandidateColumnError(error)) {
      logger.warn('创建老师面试遇到线上字段不兼容，使用基础字段重试', {
        error_summary: summarizeError(error),
      })
      const fallbackResult = await supabaseServer
        .from('teacher_candidates')
        .insert(pickTeacherCandidatePayload(insertData))
        .select(TEACHER_CANDIDATE_FALLBACK_SELECT)
        .single()
      data = fallbackResult.data as Record<string, any> | null
      error = fallbackResult.error
    }

    if (error) {
      logger.error('创建老师面试失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建老师面试成功', { id: data.id })
    return NextResponse.json({ data: attachTeacherCandidateStatus(sanitizeTeacherCandidate(data, profile.role)) }, { status: 201 })
  } catch (error) {
    logger.error('创建老师面试异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建老师面试失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新老师面试
export async function PUT(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    const allowedFields = getAllowedUpdateFields(profile?.role)

    if (!profile || allowedFields.size === 0) {
      return NextResponse.json(
        { error: '没有更新老师面试记录的权限' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const { id, ...updateData } = body
    const updateSummary = summarizeTeacherCandidatePayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师面试ID' },
        { status: 400 }
      )
    }

    logger.debug('更新老师面试 - 接收到的数据', { id, update_summary: updateSummary })

    // 后端验证：必填字段
    if (updateData.name !== undefined && (!updateData.name || !updateData.name.trim())) {
      logger.error('更新老师面试失败 - 姓名为空', { id, update_summary: updateSummary })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const rejectedFields: string[] = []

    TEACHER_CANDIDATE_UPDATE_FIELDS.forEach(field => {
      if (updateData[field] !== undefined) {
        if (allowedFields.has(field)) {
          updatePayload[field] = updateData[field]
        } else {
          rejectedFields.push(field)
        }
      }
    })

    if (rejectedFields.length > 0) {
      logger.warn('老师面试更新忽略未授权字段', {
        id,
        role: profile.role,
        fields: rejectedFields,
      })
    }

    const updatesReviewFields = [
      'review_status',
      'review_result',
      'review_evaluation_comment',
      'review_notes',
      'review_date',
      'teacher_level',
      'trial_video_url',
    ].some((field) => updatePayload[field] !== undefined)

    if (
      updatesReviewFields &&
      allowedFields.has('reviewed_by') &&
      hasUuidString(profile.id)
    ) {
      updatePayload.reviewed_by = profile.id
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: '没有可更新的字段' },
        { status: 403 }
      )
    }

    if (isEntryConfirmOnlyRole(profile.role)) {
      const { data: candidateScope, error: scopeError } = await supabaseServer
        .from('teacher_candidates')
        .select('id, review_result, is_hired')
        .eq('id', id)
        .single()

      if (scopeError || !candidateScope) {
        logger.error('校验待入库候选人范围失败', { id, error_summary: summarizeError(scopeError) })
        return NextResponse.json(
          { error: '老师面试不存在' },
          { status: 404 }
        )
      }

      if (!isPendingEntryCandidate(candidateScope)) {
        logger.warn('待入库确认角色更新非待入库候选人被拒绝', {
          id,
          role: profile.role,
        })
        return NextResponse.json(
          { error: '只能更新待入库老师的入库字段' },
          { status: 403 }
        )
      }
    }

    logger.debug('更新老师面试 - 准备更新的数据', {
      id,
      update_summary: summarizeTeacherCandidatePayload(updatePayload),
    })

    const updateResult = await supabaseServer
      .from('teacher_candidates')
      .update(updatePayload)
      .eq('id', id)
      .select(TEACHER_CANDIDATE_SELECT)
      .single()
    let data = updateResult.data as Record<string, any> | null
    let error = updateResult.error

    if (error && isMissingTeacherCandidateColumnError(error)) {
      const fallbackPayload = pickTeacherCandidatePayload(updatePayload)

      if (Object.keys(fallbackPayload).length === 0) {
        logger.warn('更新老师面试遇到线上字段不兼容，但没有可回退字段', {
          id,
          error_summary: summarizeError(error),
        })
      } else {
        logger.warn('更新老师面试遇到线上字段不兼容，使用基础字段重试', {
          id,
          error_summary: summarizeError(error),
        })
        const fallbackResult = await supabaseServer
          .from('teacher_candidates')
          .update(fallbackPayload)
          .eq('id', id)
          .select(TEACHER_CANDIDATE_FALLBACK_SELECT)
          .single()
        data = fallbackResult.data as Record<string, any> | null
        error = fallbackResult.error
      }
    }

    if (error) {
      logger.error('更新老师面试失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新老师面试成功', { id })
    return NextResponse.json({ data: attachTeacherCandidateStatus(sanitizeTeacherCandidate(data, profile.role)) })
  } catch (error) {
    logger.error('更新老师面试异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新老师面试失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除老师面试
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile || !isAdminRole(profile.role)) {
      return NextResponse.json(
        { error: '没有删除老师面试记录的权限' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师面试ID' },
        { status: 400 }
      )
    }

    logger.debug('删除老师面试', { id })

    const { error } = await supabaseServer
      .from('teacher_candidates')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除老师面试失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除老师面试成功', { id })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('删除老师面试异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除老师面试失败' },
      { status: 500 }
    )
  }
}
