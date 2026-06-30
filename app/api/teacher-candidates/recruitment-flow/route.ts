import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { summarizeError } from "@/lib/safe-error"
import {
  getStepConfig,
  type RecruitmentStatus,
  type RecruitmentStep,
} from "@/lib/config/teacherRecruitmentFlow"
import { ACTIONS, RESOURCES, Role, hasPermission } from "@/lib/permissions"

const logger = createLogger('API:TeacherRecruitmentFlow')

const RECRUITMENT_STEPS: RecruitmentStep[] = [
  'scheduling',
  'interview_video',
  'teaching_review',
  'salary_negotiation',
  'final_entry',
  'rejected',
]

const RECRUITMENT_STATUSES: RecruitmentStatus[] = [
  'waiting_contact',
  'scheduled',
  'video_uploaded',
  'pending_teaching_review',
  'teaching_review_approved',
  'pending_salary',
  'in_teacher_pool',
  'review_rejected',
]

const ALLOWED_TRANSITIONS: Record<RecruitmentStep, RecruitmentStep[]> = {
  scheduling: ['interview_video'],
  interview_video: ['teaching_review'],
  teaching_review: ['salary_negotiation', 'rejected'],
  salary_negotiation: ['final_entry'],
  final_entry: [],
  rejected: [],
}

const FLOW_SELECT = `
  id,
  recruitment_step,
  recruitment_status,
  video_reviewed_at,
  reviewed_by_id,
  salary_confirmed_at,
  salary_confirmed_by_id,
  review_status,
  review_result,
  review_notes,
  is_hired
`

const FLOW_FALLBACK_SELECT = `
  id,
  video_recording_url,
  review_status,
  review_result,
  review_notes,
  review_date,
  is_hired
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

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isRecruitmentStep(value: unknown): value is RecruitmentStep {
  return typeof value === 'string' && RECRUITMENT_STEPS.includes(value as RecruitmentStep)
}

function isRecruitmentStatus(value: unknown): value is RecruitmentStatus {
  return typeof value === 'string' && RECRUITMENT_STATUSES.includes(value as RecruitmentStatus)
}

function canMoveToStep(role: string | undefined, targetStep: RecruitmentStep): boolean {
  if (role === 'admin') return true
  const canConfirmEntry = hasPermission(role as Role | undefined, RESOURCES.teacherCandidates, ACTIONS.confirmEntry)

  if (role === 'teacher_recruiter') {
    return targetStep === 'interview_video' || targetStep === 'teaching_review'
  }

  if (role === 'academic_affairs') {
    return targetStep === 'salary_negotiation' ||
      targetStep === 'final_entry' ||
      targetStep === 'rejected'
  }

  if (canConfirmEntry) {
    return targetStep === 'salary_negotiation' || targetStep === 'final_entry'
  }

  return false
}

function isEntryConfirmOnlyRole(role?: string) {
  return role === 'finance' || role === 'hr'
}

function isAllowedTransition(currentStep: RecruitmentStep, targetStep: RecruitmentStep): boolean {
  if (currentStep === targetStep) return true
  return ALLOWED_TRANSITIONS[currentStep].includes(targetStep)
}

function summarizeFlowRequest(body: Record<string, unknown>) {
  return {
    has_id: Boolean(normalizeString(body.id)),
    target_step: isRecruitmentStep(body.recruitment_step) ? body.recruitment_step : undefined,
    target_status: isRecruitmentStatus(body.recruitment_status) ? body.recruitment_status : undefined,
    has_review_notes: Boolean(normalizeString(body.review_notes)),
  }
}

function pickLegacyFlowPayload(payload: Record<string, string | boolean | null>) {
  const legacyFields = [
    'review_status',
    'review_result',
    'review_notes',
    'review_date',
    'is_hired',
  ] as const

  return legacyFields.reduce<Record<string, string | boolean | null>>((picked, field) => {
    if (payload[field] !== undefined) {
      picked[field] = payload[field]
    }
    return picked
  }, {})
}

function synthesizeFlowData(
  data: Record<string, any> | null,
  targetStep: RecruitmentStep,
  expectedStatus: RecruitmentStatus
) {
  if (!data) return data
  return {
    ...data,
    recruitment_step: data.recruitment_step || targetStep,
    recruitment_status: data.recruitment_status || expectedStatus,
  }
}

export async function GET(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile || !hasPermission(profile.role as Role | undefined, RESOURCES.teacherCandidates, ACTIONS.view)) {
      return NextResponse.json(
        { error: '没有查看招聘流程的权限' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      data: {
        steps: RECRUITMENT_STEPS.map((step) => ({
          key: step,
          ...getStepConfig(step),
          allowed_next_steps: ALLOWED_TRANSITIONS[step],
        })),
        statuses: RECRUITMENT_STATUSES,
        transitions: ALLOWED_TRANSITIONS,
      },
    })
  } catch (error) {
    logger.error('获取老师招聘流程配置异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取招聘流程配置失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return NextResponse.json(
        { error: '没有更新招聘流程的权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const bodySummary = summarizeFlowRequest(body)
    const id = normalizeString(body.id)

    logger.debug('更新老师招聘流程 - 接收到的数据', { body_summary: bodySummary })

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师面试ID' },
        { status: 400 }
      )
    }

    if (!isRecruitmentStep(body.recruitment_step)) {
      return NextResponse.json(
        { error: '招聘流程步骤不合法' },
        { status: 400 }
      )
    }

    const targetStep = body.recruitment_step
    const expectedStatus = getStepConfig(targetStep).status
    const targetStatus = body.recruitment_status

    if (targetStatus !== undefined && (!isRecruitmentStatus(targetStatus) || targetStatus !== expectedStatus)) {
      return NextResponse.json(
        { error: '招聘流程状态不匹配' },
        { status: 400 }
      )
    }

    if (!canMoveToStep(profile.role, targetStep)) {
      logger.warn('招聘流程更新被拒绝 - 角色无权推进到目标步骤', {
        id,
        role: profile.role,
        target_step: targetStep,
      })
      return NextResponse.json(
        { error: '没有更新招聘流程的权限' },
        { status: 403 }
      )
    }

    const fetchResult = await supabaseServer
      .from('teacher_candidates')
      .select('id, recruitment_step, recruitment_status, video_recording_url, review_status, review_result')
      .eq('id', id)
      .single()
    let currentCandidate = fetchResult.data as Record<string, any> | null
    let fetchError = fetchResult.error
    let useLegacyFlowColumns = false

    if (fetchError && isMissingTeacherCandidateColumnError(fetchError)) {
      logger.warn('老师招聘流程字段与线上库结构不一致，回退到基础字段查询', {
        id,
        error_summary: summarizeError(fetchError),
      })
      const fallbackFetchResult = await supabaseServer
        .from('teacher_candidates')
        .select(FLOW_FALLBACK_SELECT)
        .eq('id', id)
        .single()
      currentCandidate = fallbackFetchResult.data as Record<string, any> | null
      fetchError = fallbackFetchResult.error
      useLegacyFlowColumns = true
    }

    if (fetchError || !currentCandidate) {
      logger.error('获取老师招聘流程失败', { id, error_summary: summarizeError(fetchError) })
      return NextResponse.json(
        { error: '老师面试不存在' },
        { status: 404 }
      )
    }

    const storedCurrentStep = isRecruitmentStep(currentCandidate.recruitment_step)
      ? currentCandidate.recruitment_step
      : 'scheduling'
    const hasInterviewVideo = Boolean(normalizeString(currentCandidate.video_recording_url))
    const hasCompletedReview =
      normalizeString(currentCandidate.review_result) === '通过' ||
      normalizeString(currentCandidate.review_status) === '已复核'

    if (isEntryConfirmOnlyRole(profile.role) && targetStep === 'salary_negotiation' && !hasCompletedReview) {
      logger.warn('待入库确认角色推进未复核候选人到谈薪被拒绝', {
        id,
        role: profile.role,
      })
      return NextResponse.json(
        { error: '候选人尚未复核通过，不能进入谈薪入库' },
        { status: 403 }
      )
    }

    const currentStep = useLegacyFlowColumns && hasCompletedReview && targetStep === 'final_entry'
      ? 'salary_negotiation'
      : hasInterviewVideo && targetStep === 'teaching_review' &&
      (useLegacyFlowColumns || storedCurrentStep === 'scheduling' || storedCurrentStep === 'interview_video')
      ? 'interview_video'
      : hasInterviewVideo &&
      (targetStep === 'salary_negotiation' || targetStep === 'rejected') &&
      (storedCurrentStep === 'scheduling' || storedCurrentStep === 'interview_video')
      ? 'teaching_review'
      : hasCompletedReview &&
        targetStep === 'salary_negotiation' &&
        (storedCurrentStep === 'scheduling' || storedCurrentStep === 'interview_video')
        ? 'teaching_review'
      : storedCurrentStep

    if (!isAllowedTransition(currentStep, targetStep)) {
      logger.warn('招聘流程更新被拒绝 - 非法状态流转', {
        id,
        current_step: currentStep,
        target_step: targetStep,
      })
      return NextResponse.json(
        { error: '招聘流程状态流转不合法' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    const updatePayload: Record<string, string | boolean | null> = {
      recruitment_step: targetStep,
      recruitment_status: expectedStatus,
    }

    if (targetStep === 'salary_negotiation') {
      updatePayload.video_reviewed_at = now
      updatePayload.reviewed_by_id = profile.id
      updatePayload.review_status = '已复核'
      updatePayload.review_result = '通过'
      updatePayload.review_date = today
    }

    if (targetStep === 'final_entry') {
      updatePayload.salary_confirmed_at = now
      updatePayload.salary_confirmed_by_id = profile.id
      updatePayload.is_hired = true
    }

    if (targetStep === 'rejected') {
      const reviewNotes = normalizeString(body.review_notes)
      if (!reviewNotes) {
        return NextResponse.json(
          { error: '拒绝候选人时必须填写原因' },
          { status: 400 }
        )
      }

      updatePayload.review_status = '不符合'
      updatePayload.review_result = '不符合'
      updatePayload.review_notes = reviewNotes
      updatePayload.review_date = today
      updatePayload.is_hired = false
    }

    const updateResult = await supabaseServer
      .from('teacher_candidates')
      .update(updatePayload)
      .eq('id', id)
      .select(FLOW_SELECT)
      .single()
    let data = updateResult.data as Record<string, any> | null
    let error = updateResult.error

    if (error && isMissingTeacherCandidateColumnError(error)) {
      const fallbackPayload = pickLegacyFlowPayload(updatePayload)

      logger.warn('更新老师招聘流程遇到线上字段不兼容，使用基础字段重试', {
        id,
        current_step: currentStep,
        target_step: targetStep,
        error_summary: summarizeError(error),
      })

      if (Object.keys(fallbackPayload).length === 0) {
        // No legacy fields to update (e.g. interview_video step only sets
        // recruitment_step/recruitment_status which don't exist in the DB).
        // Skip the update and just fetch current data to synthesize the response.
        const fetchResult = await supabaseServer
          .from('teacher_candidates')
          .select(FLOW_FALLBACK_SELECT)
          .eq('id', id)
          .single()
        data = synthesizeFlowData(
          fetchResult.data as Record<string, any> | null,
          targetStep,
          expectedStatus
        )
        error = fetchResult.error
      } else {
        const fallbackUpdateResult = await supabaseServer
          .from('teacher_candidates')
          .update(fallbackPayload)
          .eq('id', id)
          .select(FLOW_FALLBACK_SELECT)
          .single()
        data = synthesizeFlowData(
          fallbackUpdateResult.data as Record<string, any> | null,
          targetStep,
          expectedStatus
        )
        error = fallbackUpdateResult.error
      }
    }

    if (error) {
      logger.error('更新老师招聘流程失败', {
        id,
        current_step: currentStep,
        target_step: targetStep,
        error_summary: summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新老师招聘流程成功', {
      id,
      current_step: currentStep,
      target_step: targetStep,
      target_status: expectedStatus,
    })

    return NextResponse.json({ data: synthesizeFlowData(data, targetStep, expectedStatus) })
  } catch (error) {
    logger.error('更新老师招聘流程异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新招聘流程失败' },
      { status: 500 }
    )
  }
}
