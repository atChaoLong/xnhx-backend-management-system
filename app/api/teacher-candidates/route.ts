import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:TeacherCandidates')

// GET: 获取老师面试列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    logger.debug('获取老师面试数据', { id })

    // 如果提供了ID，查询单个候选
    if (id) {
      const { data, error } = await supabaseServer
        .from('teacher_candidates')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取老师面试失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取老师面试成功', { id })
      return NextResponse.json({ data })
    }

    // 否则获取所有候选，按面试日期降序排序
    const { data, error } = await supabaseServer
      .from('teacher_candidates')
      .select('*')
      .order('interview_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('获取老师面试列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取老师面试列表成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取老师面试异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取老师面试失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新老师面试
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建老师面试 - 接收到的数据', { body })

    // 后端验证：必填字段
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      logger.error('创建老师面试失败 - 姓名为空', { body })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    if (!body.wechat_id || typeof body.wechat_id !== 'string' || !body.wechat_id.trim()) {
      logger.error('创建老师面试失败 - 微信号为空', { body })
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      name: body.name.trim(),
      wechat_id: body.wechat_id.trim(),
      daily_lead_id: body.daily_lead_id || null,
      resume_url: body.resume_url || null,
      profile_photo_url: body.profile_photo_url || null,
      grade_level: body.grade_level || null,
      subjects_taught: body.subjects_taught || null,
      teacher_type: body.teacher_type || null,
      trial_subject: body.trial_subject || null,
      teaching_style: body.teaching_style || null,
      interview_date: body.interview_date || null,
      interviewer_name: body.interviewer_name || null,
      interview_time: body.interview_time || null,
      interview_link: body.interview_link || null,
      interview_officer: body.interview_officer || null,
      interview_exception: body.interview_exception || null,
      video_recording_url: body.video_recording_url || null,
      trial_video_url: body.trial_video_url || null,
      interview_month: body.interview_month || null,
      interview_week: body.interview_week || null,
      registration_date: body.registration_date || null,
      interview_score: body.interview_score || null,
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
      review_status: body.review_status || '待复核',
      reviewed_by: body.reviewed_by || null,
      review_result: body.review_result || null,
      review_evaluation_comment: body.review_evaluation_comment || null,
      review_date: body.review_date || null,
      teacher_level: body.teacher_level || null,
      can_teach_graduation_class: body.can_teach_graduation_class || null,
      is_hired: body.is_hired !== undefined ? body.is_hired : false,
      teacher_feeling: body.teacher_feeling || null,
      suitable_for_students: body.suitable_for_students || null,
      scheduling_preference: body.scheduling_preference || null,
      hired_notes: body.hired_notes || null,
      qr_code_url: body.qr_code_url || null,
      current_rate: body.current_rate || null,
      approved_hourly_rate: body.approved_hourly_rate || null,
    }

    logger.debug('创建老师面试 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('teacher_candidates')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建老师面试失败', { message: error.message, code: error.code, details: error.details })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('创建老师面试成功', { id: data.id, name: data.name })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建老师面试异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建老师面试失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新老师面试
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师面试ID' },
        { status: 400 }
      )
    }

    logger.debug('更新老师面试 - 接收到的数据', { id, updateData })

    // 后端验证：必填字段
    if (updateData.name !== undefined && (!updateData.name || !updateData.name.trim())) {
      logger.error('更新老师面试失败 - 姓名为空', { id, updateData })
      return NextResponse.json(
        { error: '姓名不能为空' },
        { status: 400 }
      )
    }

    if (updateData.wechat_id !== undefined && (!updateData.wechat_id || !updateData.wechat_id.trim())) {
      logger.error('更新老师面试失败 - 微信号为空', { id, updateData })
      return NextResponse.json(
        { error: '微信号不能为空' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'name', 'wechat_id', 'daily_lead_id', 'resume_url', 'profile_photo_url',
      'grade_level', 'subjects_taught', 'teacher_type', 'trial_subject', 'teaching_style',
      'interview_date', 'interviewer_name', 'interview_time', 'interview_link', 'interview_officer',
      'interview_exception', 'video_recording_url', 'trial_video_url',
      'interview_month', 'interview_week', 'registration_date',
      'interview_score', 'logical_expression_score',
      'dress_appearance_score', 'material_preparation_score', 'exam_score',
      'initial_evaluation', 'teacher_characteristics',
      'mandarin_level', 'research_ability', 'service_awareness', 'affinity',
      'review_status', 'reviewed_by', 'review_result', 'review_evaluation_comment',
      'review_date', 'teacher_level', 'can_teach_graduation_class',
      'is_hired', 'teacher_feeling', 'suitable_for_students', 'scheduling_preference',
      'hired_notes', 'qr_code_url', 'current_rate', 'approved_hourly_rate'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新老师面试 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('teacher_candidates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新老师面试失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('更新老师面试成功', { id, name: data.name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新老师面试异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新老师面试失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除老师面试
export async function DELETE(request: NextRequest) {
  try {
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
      logger.error('删除老师面试失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('删除老师面试成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除老师面试异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除老师面试失败' },
      { status: 500 }
    )
  }
}
