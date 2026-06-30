import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'

const logger = createLogger('API:TeacherForm')
const TEACHER_FORM_SUBMISSION_SELECT = 'id, candidate_id, created_at'
const TEACHER_FORM_ADMIN_SELECT = [
  'id',
  'created_at',
  'updated_at',
  'candidate_id',
  'teacher_name',
  'gender',
  'wechat',
  'classin_phone',
  'location',
  'subjects',
  'grade_levels',
  'used_classin',
  'has_certificate',
  'education',
  'university',
  'teaching_years',
  'available_times',
  'textbook_versions',
  'student_regions',
  'student_levels',
  'teaching_style',
  'teaching_experience',
  'success_cases',
  'notes',
  'photo_url',
  'review_screenshots',
].join(', ')

type JsonRecord = Record<string, any>

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function joinArray(values: unknown, separator = '、') {
  return Array.isArray(values)
    ? values.filter(Boolean).join(separator)
    : null
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function summarizeTeacherFormPayload(formData: JsonRecord, candidateId: unknown) {
  const fields = Object.keys(formData)
  const arrayFields = [
    'subjects',
    'grade_levels',
    'available_times',
    'textbook_versions',
    'student_regions',
    'student_levels',
  ]
  const arrayFieldCounts = arrayFields.reduce<Record<string, number | 'not_array'>>((summary, field) => {
    summary[field] = Array.isArray(formData[field]) ? formData[field].length : 'not_array'
    return summary
  }, {})

  return {
    has_candidate_id: Boolean(normalizeOptionalString(candidateId)),
    field_count: fields.length,
    fields: fields.slice(0, 40),
    array_field_counts: arrayFieldCounts,
    has_photo_url: Boolean(normalizeOptionalString(formData.photo_url)),
    has_notes: Boolean(normalizeOptionalString(formData.notes)),
    review_screenshot_count: Array.isArray(formData.review_screenshots) ? formData.review_screenshots.length : 0,
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    const rawBody = await request.json()
    const body = isRecord(rawBody) ? rawBody : {}
    const { candidate_id, ...formData } = body
    const candidateId = normalizeOptionalString(candidate_id)

    // 2. 验证必填字段
    const requiredFields = [
      'teacher_name',
      'gender',
      'wechat',
      'classin_phone',
      'location',
      'subjects',
      'grade_levels',
      'used_classin',
      'has_certificate',
      'education',
      'university',
      'teaching_years',
      'available_times',
      'textbook_versions',
      'student_regions',
      'student_levels',
      'teaching_style',
      'teaching_experience',
      'success_cases',
      'photo_url'
    ]

    const missingFields = requiredFields.filter(field => !formData[field])
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: '缺少必填字段',
        missingFields
      }, { status: 400 })
    }

    // 3. 验证数组字段
    const arrayFields = [
      'subjects',
      'grade_levels',
      'available_times',
      'textbook_versions',
      'student_regions',
      'student_levels'
    ]

    for (const field of arrayFields) {
      if (!Array.isArray(formData[field])) {
        return NextResponse.json({
          error: `${field} 必须是数组`
        }, { status: 400 })
      }
    }

    // 4. 验证枚举字段
    if (!['女', '男'].includes(formData.gender)) {
      return NextResponse.json({ error: '性别值无效' }, { status: 400 })
    }

    if (!['用过', '没用过'].includes(formData.used_classin)) {
      return NextResponse.json({ error: '是否用过ClassIn值无效' }, { status: 400 })
    }

    if (!['有', '暂时没有'].includes(formData.has_certificate)) {
      return NextResponse.json({ error: '是否有教资证值无效' }, { status: 400 })
    }

    if (!['本科', '硕士', '博士', '其他'].includes(formData.education)) {
      return NextResponse.json({ error: '学历值无效' }, { status: 400 })
    }

    if (!candidateId) {
      return NextResponse.json({ error: '缺少候选人信息，请使用招师发送的专属表单链接' }, { status: 400 })
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('teacher_candidates')
      .select('id, name, wechat_id, phone, interview_result')
      .eq('id', candidateId)
      .maybeSingle()

    if (candidateError) {
      logger.error('教师表单候选人校验失败', {
        body_summary: summarizeTeacherFormPayload(formData, candidate_id),
        error_summary: summarizeError(candidateError),
      })
      return NextResponse.json({ error: '候选人校验失败' }, { status: 500 })
    }

    if (!candidate) {
      return NextResponse.json({ error: '未找到候选人信息' }, { status: 404 })
    }

    if (candidate.interview_result && candidate.interview_result !== '通过面试') {
      return NextResponse.json({ error: '该候选人尚未通过面试' }, { status: 400 })
    }

    const { data: existingSubmission, error: existingSubmissionError } = await supabaseAdmin
      .from('teacher_details')
      .select('id')
      .eq('candidate_id', candidate.id)
      .maybeSingle()

    if (existingSubmissionError) {
      logger.error('查询教师表单重复提交状态失败', {
        body_summary: summarizeTeacherFormPayload(formData, candidate_id),
        error_summary: summarizeError(existingSubmissionError),
      })
      return NextResponse.json({ error: '提交状态校验失败' }, { status: 500 })
    }

    if (existingSubmission) {
      return NextResponse.json({ error: '您已经提交过信息，如需修改请联系教务老师' }, { status: 400 })
    }

    // 5. 插入数据库
    const { data: insertedTeacherDetail, error: insertError } = await supabaseAdmin
      .from('teacher_details')
      .insert({
        teacher_name: formData.teacher_name,
        gender: formData.gender,
        wechat: formData.wechat,
        classin_phone: formData.classin_phone,
        location: formData.location,
        subjects: formData.subjects,
        grade_levels: formData.grade_levels,
        used_classin: formData.used_classin,
        has_certificate: formData.has_certificate,
        education: formData.education,
        university: formData.university,
        teaching_years: parseFloat(formData.teaching_years),
        available_times: formData.available_times,
        textbook_versions: formData.textbook_versions,
        student_regions: formData.student_regions,
        student_levels: formData.student_levels,
        teaching_style: formData.teaching_style,
        teaching_experience: formData.teaching_experience,
        success_cases: formData.success_cases,
        notes: formData.notes || null,
        photo_url: formData.photo_url,
        review_screenshots: formData.review_screenshots || null,
        candidate_id: candidate.id
      })
      .select(TEACHER_FORM_SUBMISSION_SELECT)
      .single()

    if (insertError) {
      logger.error('教师表单提交失败', {
        body_summary: summarizeTeacherFormPayload(formData, candidate_id),
        error_summary: summarizeError(insertError),
      })
      return NextResponse.json({
        error: '提交失败'
      }, { status: 500 })
    }

    const candidateUpdate = {
      name: formData.teacher_name,
      wechat_id: formData.wechat,
      phone: formData.classin_phone,
      profile_photo_url: formData.photo_url,
      grade_level: joinArray(formData.grade_levels),
      subjects_taught: formData.subjects,
      teaching_style: formData.teaching_style,
      teacher_characteristics: formData.teaching_experience,
      suitable_for_students: joinArray(formData.student_levels),
      scheduling_preference: joinArray(formData.available_times),
      updated_at: new Date().toISOString(),
    }

    const { error: updateCandidateError } = await supabaseAdmin
      .from('teacher_candidates')
      .update(candidateUpdate)
      .eq('id', candidate.id)

    if (updateCandidateError) {
      logger.error('教师表单回填候选人失败', {
        submission_id: insertedTeacherDetail.id,
        error_summary: summarizeError(updateCandidateError),
      })
      return NextResponse.json({
        error: '表单已提交，但回填候选人失败'
      }, { status: 500 })
    }

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        id: insertedTeacherDetail.id,
        candidate_id: insertedTeacherDetail.candidate_id,
        created_at: insertedTeacherDetail.created_at,
      }
    }, { status: 201 })

  } catch (error) {
    logger.error('提交教师表单异常', summarizeError(error))
    return NextResponse.json({
      error: '服务器错误'
    }, { status: 500 })
  }
}

// GET: 获取所有表单提交记录（管理员）
export async function GET(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)

    if (!profile) {
      return NextResponse.json({ error: '未登录或账号不可用' }, { status: 401 })
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    // 3. 获取查询参数
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const from = (page - 1) * limit
    const to = from + limit - 1

    // 4. 查询数据
    const { data, error, count } = await supabaseAdmin
      .from('teacher_details')
      .select(TEACHER_FORM_ADMIN_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('查询教师表单记录失败', {
        error_summary: summarizeError(error),
      })
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    // 5. 返回结果
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    logger.error('获取教师表单记录异常', summarizeError(error))
    return NextResponse.json({
      error: '服务器错误'
    }, { status: 500 })
  }
}
