import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { batchCalculateTrialLessonStatus } from "@/lib/status-calculator"

const logger = createLogger('API:TrialLessons')

// GET: 获取试听课程列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取试听课程数据', { id, from, to })

    // 如果提供了ID，查询单个试听课程
    if (id) {
      const { data, error } = await supabaseServer
        .from('trial_lessons')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取试听课程失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取试听课程成功', { id })

      // 计算单个试听状态
      if (data) {
        const [statusResult] = await batchCalculateTrialLessonStatus([data])
        return NextResponse.json({
          data: {
            ...data,
            lesson_status: statusResult.status,
            lesson_status_name: statusResult.statusName,
            is_converted_calculated: statusResult.isConverted,
          }
        })
      }

      return NextResponse.json({ data })
    }

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('trial_lessons')
      .select('*', { count: 'exact', head: true })

    // 分页查询数据，按试听时间降序排序
    const { data, error } = await supabaseServer
      .from('trial_lessons')
      .select('*')
      .order('trial_time', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取试听课程列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
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
      data: lessonsWithStatus,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取试听课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取试听课程失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新试听课程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建试听课程 - 接收到的数据', { body })

    // 后端验证：必填字段
    if (!body.child_name || typeof body.child_name !== 'string' || !body.child_name.trim()) {
      logger.error('创建试听课程失败 - 孩子称呼为空', { body })
      return NextResponse.json(
        { error: '孩子称呼不能为空' },
        { status: 400 }
      )
    }

    if (!body.region || typeof body.region !== 'string' || !body.region.trim()) {
      logger.error('创建试听课程失败 - 地域为空', { body })
      return NextResponse.json(
        { error: '地域不能为空' },
        { status: 400 }
      )
    }

    if (!body.grade || typeof body.grade !== 'string' || !body.grade.trim()) {
      logger.error('创建试听课程失败 - 年级为空', { body })
      return NextResponse.json(
        { error: '年级不能为空' },
        { status: 400 }
      )
    }

    if (!body.trial_subject || typeof body.trial_subject !== 'string' || !body.trial_subject.trim()) {
      logger.error('创建试听课程失败 - 试听科目为空', { body })
      return NextResponse.json(
        { error: '试听科目不能为空' },
        { status: 400 }
      )
    }

    if (!body.trial_time || typeof body.trial_time !== 'string' || !body.trial_time.trim()) {
      logger.error('创建试听课程失败 - 试听时间为空', { body })
      return NextResponse.json(
        { error: '试听时间不能为空' },
        { status: 400 }
      )
    }

    if (body.trial_duration === undefined || body.trial_duration === null || isNaN(body.trial_duration)) {
      logger.error('创建试听课程失败 - 试听时长无效', { body })
      return NextResponse.json(
        { error: '试听时长不能为空' },
        { status: 400 }
      )
    }

    if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
      logger.error('创建试听课程失败 - 手机号为空', { body })
      return NextResponse.json(
        { error: '手机号不能为空' },
        { status: 400 }
      )
    }

    if (!body.channel || typeof body.channel !== 'string' || !body.channel.trim()) {
      logger.error('创建试听课程失败 - 渠道为空', { body })
      return NextResponse.json(
        { error: '渠道不能为空' },
        { status: 400 }
      )
    }

    if (!body.payment_proof || typeof body.payment_proof !== 'string' || !body.payment_proof.trim()) {
      logger.error('创建试听课程失败 - 付款凭证为空', { body })
      return NextResponse.json(
        { error: '付款凭证不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      child_name: body.child_name.trim(),
      status: body.status || 'pending',
      lead_id: body.lead_id || null,
      region: body.region.trim(),
      grade: body.grade.trim(),
      trial_subject: body.trial_subject.trim(),
      trial_time: body.trial_time,
      trial_duration: parseFloat(body.trial_duration),
      phone: body.phone.trim(),
      channel: body.channel.trim(),
      trial_amount: body.trial_amount !== undefined ? parseFloat(body.trial_amount) : null,
      payment_proof: body.payment_proof.trim(),
      urgency_level: body.urgency_level || null,
      notes: body.notes?.trim() || null,
      assigned_consultant: body.assigned_consultant?.trim() || null,
      course_status: body.course_status?.trim() || null,
      student_type: body.student_type?.trim() || null,
      matched_teacher: body.matched_teacher?.trim() || null,
      confirmed_teacher: body.confirmed_teacher?.trim() || null,
    }

    logger.debug('创建试听课程 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('trial_lessons')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建试听课程失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建试听课程成功', { id: data.id, child_name: data.child_name })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建试听课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建试听课程失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新试听课程
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少试听课程ID' },
        { status: 400 }
      )
    }

    logger.debug('更新试听课程 - 接收到的数据', { id, updateData })

    // 后端验证：必填字段
    if (updateData.child_name !== undefined && (!updateData.child_name || !updateData.child_name.trim())) {
      logger.error('更新试听课程失败 - 孩子称呼为空', { id, updateData })
      return NextResponse.json(
        { error: '孩子称呼不能为空' },
        { status: 400 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'child_name', 'status', 'lead_id', 'region', 'grade', 'trial_subject',
      'trial_time', 'trial_duration', 'phone', 'channel', 'trial_amount',
      'payment_proof', 'urgency_level', 'notes', 'assigned_consultant',
      'course_status', 'student_type', 'matched_teacher', 'confirmed_teacher'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新试听课程 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('trial_lessons')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新试听课程失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新试听课程成功', { id, child_name: data.child_name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新试听课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新试听课程失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除试听课程
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少试听课程ID' },
        { status: 400 }
      )
    }

    logger.debug('删除试听课程', { id })

    const { error } = await supabaseServer
      .from('trial_lessons')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除试听课程失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除试听课程成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除试听课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除试听课程失败' },
      { status: 500 }
    )
  }
}
