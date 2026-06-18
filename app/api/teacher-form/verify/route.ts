import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:TeacherFormVerify')
const CANDIDATE_PREFILL_SELECT = 'id, name, wechat_id, phone, subjects_taught, grade_level, interview_result'

type JsonRecord = Record<string, any>

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function summarizeVerifyPayload(body: JsonRecord) {
  const fields = Object.keys(body)

  return {
    has_candidate_id: Boolean(normalizeOptionalString(body.candidate_id)),
    has_phone: Boolean(normalizeOptionalString(body.phone)),
    has_wechat: Boolean(normalizeOptionalString(body.wechat)),
    field_count: fields.length,
    fields: fields.slice(0, 20),
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const body = isRecord(rawBody) ? rawBody : {}
    const candidateId = normalizeOptionalString(body.candidate_id)

    if (!candidateId) {
      return NextResponse.json({ error: '请使用招师发送的专属表单链接' }, { status: 400 })
    }

    const candidateQuery = supabaseAdmin
      .from('teacher_candidates')
      .select(CANDIDATE_PREFILL_SELECT)
      .eq('id', candidateId)

    // 查询 teacher_candidates 表，找到通过面试的候选人
    const { data: candidate, error } = await candidateQuery.maybeSingle()

    if (error) {
      logger.error('查询教师候选人失败', {
        lookup_by: 'candidate_id',
        body_summary: summarizeVerifyPayload(body),
        error_summary: summarizeError(error),
      })
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    if (!candidate) {
      return NextResponse.json({
        error: '未找到候选人信息',
        message: '请确认您使用的是招师发送的专属表单链接'
      }, { status: 404 })
    }

    // 检查面试状态（如果有 interview_result 字段且值为"通过面试"）
    if (candidate.interview_result && candidate.interview_result !== '通过面试') {
      return NextResponse.json({
        error: '面试结果不符合',
        message: '请确认您已经通过面试'
      }, { status: 400 })
    }

    // 检查是否已经提交过信息
    const { data: existingSubmission, error: existingSubmissionError } = await supabaseAdmin
      .from('teacher_details')
      .select('id')
      .eq('candidate_id', candidate.id)
      .maybeSingle()

    if (existingSubmissionError) {
      logger.error('查询教师表单提交状态失败', {
        lookup_by: 'candidate_id',
        body_summary: summarizeVerifyPayload(body),
        error_summary: summarizeError(existingSubmissionError),
      })
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    if (existingSubmission) {
      return NextResponse.json({
        error: '您已经提交过信息',
        message: '如需修改信息，请联系教务老师'
      }, { status: 400 })
    }

    // 返回候选人信息（预填充表单）
    const gradeLevels = typeof candidate.grade_level === 'string'
      ? candidate.grade_level.split(/[,，、]/).map((item: string) => item.trim()).filter(Boolean)
      : []

    return NextResponse.json({
      success: true,
      data: {
        id: candidate.id,
        name: candidate.name,
        wechat_id: candidate.wechat_id,
        phone: candidate.phone,
        subjects: candidate.subjects_taught || [],
        grade_levels: gradeLevels,
      }
    })

  } catch (error) {
    logger.error('验证教师表单链接异常', summarizeError(error))
    return NextResponse.json({
      error: '服务器错误'
    }, { status: 500 })
  }
}
