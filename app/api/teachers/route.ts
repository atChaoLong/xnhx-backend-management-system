import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { generateTeacherCode } from "@/lib/server-teacher-code"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { redactTeacherClassInSecrets, redactTeachersClassInSecrets } from "@/lib/server-teacher-redaction"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:Teachers')
const TEACHER_LIST_SELECT = `
  id,
  created_at,
  updated_at,
  teacher_code,
  teacher_level,
  status,
  name,
  wechat,
  classin_phone,
  subjects,
  grade_levels,
  used_classin,
  education,
  university,
  teaching_years,
  teaching_style,
  success_cases,
  student_regions,
  student_levels,
  classin_uid,
  location
`

const TEACHER_DETAIL_SELECT = `
  id,
  created_at,
  updated_at,
  teacher_code,
  teacher_level,
  status,
  name,
  gender,
  wechat,
  classin_phone,
  subjects,
  grade_levels,
  used_classin,
  has_certificate,
  education,
  university,
  available_times,
  textbook_versions,
  student_regions,
  student_levels,
  teaching_years,
  teaching_style,
  success_cases,
  photo_url,
  review_screenshots,
  notes,
  classin_uid,
  location
`

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function listCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined
}

function summarizeTeacherPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_name: hasNonEmptyString(payload?.name),
    has_wechat: hasNonEmptyString(payload?.wechat),
    has_classin_phone: hasNonEmptyString(payload?.classin_phone),
    has_location: hasNonEmptyString(payload?.location),
    has_university: hasNonEmptyString(payload?.university),
    subject_count: listCount(payload?.subjects),
    grade_level_count: listCount(payload?.grade_levels),
    has_photo_url: hasNonEmptyString(payload?.photo_url),
    has_review_screenshots: Array.isArray(payload?.review_screenshots) ? payload.review_screenshots.length > 0 : Boolean(payload?.review_screenshots),
    has_notes: hasNonEmptyString(payload?.notes),
    has_bank_card_info: Boolean(payload?.bank_card_info),
  }
}

function isMissingTeacherColumnError(error: unknown) {
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

const TEACHER_LEGACY_WRITE_FIELDS = [
  'teacher_code',
  'name',
  'teacher_level',
  'status',
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
  'available_times',
  'textbook_versions',
  'student_regions',
  'student_levels',
  'teaching_years',
  'teaching_style',
  'success_cases',
  'photo_url',
  'review_screenshots',
  'notes',
] as const

function pickTeacherPayload(payload: Record<string, any>) {
  return TEACHER_LEGACY_WRITE_FIELDS.reduce<Record<string, any>>((picked, field) => {
    if (payload[field] !== undefined) {
      picked[field] = payload[field]
    }
    return picked
  }, {})
}

// GET: 获取老师列表（支持ID查询单个和分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const profile = await getCurrentProfile(request)

    logger.debug('获取老师数据', { id, from, to })

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (id) {
      const { data, error } = await supabaseServer
        .from('teachers')
        .select(TEACHER_DETAIL_SELECT)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取老师失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取老师失败' },
          { status: 400 }
        )
      }

      logger.debug('获取老师成功', { id })
      return NextResponse.json({ data: redactTeacherClassInSecrets(data, profile) })
    }

    const { count: totalCount, error: countError } = await supabaseServer
      .from('teachers')
      .select('id', { count: 'exact', head: true })

    if (countError) {
      logger.error('获取老师数量失败', { error_summary: summarizeError(countError) })
      return NextResponse.json(
        { error: '获取老师列表失败' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .from('teachers')
      .select(TEACHER_LIST_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取老师列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取老师列表失败' },
        { status: 400 }
      )
    }

    logger.debug('获取老师列表成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: redactTeachersClassInSecrets(data || [], profile),
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取老师异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取老师失败' },
      { status: 500 }
    )
  }
}

/**
 * 创建新老师。ClassIn 老师账号在试听确认老师时自动创建/绑定。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)
    const bodySummary = summarizeTeacherPayload(body)

    logger.debug('创建老师 - 接收到的数据', { body_summary: bodySummary })

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    // 后端验证：必填字段
    const requiredFields = ['name', 'gender', 'wechat', 'classin_phone', 'location', 'subjects', 'grade_levels', 'education', 'university']
    for (const field of requiredFields) {
      const value = body[field]
      const isEmpty = !value || (Array.isArray(value) && value.length === 0)

      if (isEmpty) {
        logger.error(`创建老师失败 - ${field} 为空`, {
          field,
          value_present: value !== undefined && value !== null,
          type: typeof value,
          body_summary: bodySummary
        })
        return NextResponse.json(
          { error: `${field}不能为空` },
          { status: 400 }
        )
      }
    }

    const teacher_code = await generateTeacherCode()

    const insertData = {
      teacher_code,
      name: body.name?.trim(),
      teacher_level: body.teacher_level || null,
      status: body.status || 'active',
      gender: body.gender,
      wechat: body.wechat.trim(),
      classin_phone: body.classin_phone.trim(),
      location: body.location.trim(),
      subjects: body.subjects,
      grade_levels: body.grade_levels,
      used_classin: body.used_classin !== undefined ? body.used_classin : false,
      has_certificate: body.has_certificate !== undefined ? body.has_certificate : false,
      education: body.education,
      university: body.university,
      available_times: body.available_times || null,
      textbook_versions: body.textbook_versions || null,
      student_regions: body.student_regions || null,
      student_levels: body.student_levels || null,
      teaching_years: body.teaching_years || null,
      teaching_style: body.teaching_style || null,
      success_cases: body.success_cases || null,
      photo_url: body.photo_url || null,
      review_screenshots: body.review_screenshots || null,
      notes: body.notes || null,
      bank_card_info: body.bank_card_info || null,
    }

    logger.debug('创建老师 - 准备插入的数据', {
      insert_summary: summarizeTeacherPayload(insertData),
    })

    const createResult = await supabaseServer
      .from('teachers')
      .insert(insertData)
      .select(TEACHER_DETAIL_SELECT)
      .single()
    let data = createResult.data
    let error = createResult.error

    if (error && isMissingTeacherColumnError(error)) {
      logger.warn('创建老师遇到线上字段不兼容，使用基础字段重试', {
        error_summary: summarizeError(error),
      })
      const fallbackResult = await supabaseServer
        .from('teachers')
        .insert(pickTeacherPayload(insertData))
        .select(TEACHER_DETAIL_SELECT)
        .single()
      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('创建老师失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建老师成功', { id: data.id })
    return NextResponse.json({ data: redactTeacherClassInSecrets(data, profile) }, { status: 201 })
  } catch (error: any) {
    logger.error('创建老师异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建老师失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新老师
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)

    const { id, ...updateData } = body
    const updateSummary = summarizeTeacherPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师ID' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    logger.debug('更新老师 - 接收到的数据', { id, update_summary: updateSummary })

    const updatePayload: any = {}
    const optionalFields = [
      'name', 'teacher_level', 'status', 'gender', 'wechat', 'classin_phone', 'location',
      'subjects', 'grade_levels', 'used_classin', 'has_certificate',
      'education', 'university', 'available_times', 'textbook_versions',
      'student_regions', 'student_levels', 'teaching_years',
      'teaching_style', 'success_cases',
      'photo_url', 'review_screenshots', 'notes', 'bank_card_info'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新老师 - 准备更新的数据', {
      id,
      update_summary: summarizeTeacherPayload(updatePayload),
    })

    const updateResult = await supabaseServer
      .from('teachers')
      .update(updatePayload)
      .eq('id', id)
      .select(TEACHER_DETAIL_SELECT)
      .single()
    let data = updateResult.data
    let error = updateResult.error

    if (error && isMissingTeacherColumnError(error)) {
      logger.warn('更新老师遇到线上字段不兼容，使用基础字段重试', {
        id,
        error_summary: summarizeError(error),
      })
      const fallbackResult = await supabaseServer
        .from('teachers')
        .update(pickTeacherPayload(updatePayload))
        .eq('id', id)
        .select(TEACHER_DETAIL_SELECT)
        .single()
      data = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      logger.error('更新老师失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新老师成功', { id })
    return NextResponse.json({ data: redactTeacherClassInSecrets(data, profile) })
  } catch (error: any) {
    logger.error('更新老师异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新老师失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除老师
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const profile = await getCurrentProfile(request)

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师ID' },
        { status: 400 }
      )
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: '无权删除老师' },
        { status: 403 }
      )
    }

    logger.debug('删除老师', { id })

    const { error } = await supabaseServer
      .from('teachers')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除老师失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除老师成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除老师异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除老师失败' },
      { status: 500 }
    )
  }
}
