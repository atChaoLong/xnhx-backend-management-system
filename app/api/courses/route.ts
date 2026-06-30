import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getAccessibleFormalOrderIds, hasScopedIdAccess, restrictByIds } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"
import { COURSE_RESPONSE_SELECT, formatCourseResponse } from "@/lib/server-course-selects"
import { ACTIONS, RESOURCES, Role, hasPermission, type Action } from "@/lib/permissions"

const logger = createLogger('API:Courses')

function requireCoursePermission(
  profile: Awaited<ReturnType<typeof getProfileFromHeaders>>,
  action: Action
): NextResponse | null {
  if (!profile) {
    return NextResponse.json(
      { error: '未认证', code: 'UNAUTHENTICATED' },
      { status: 401 }
    )
  }

  if (!hasPermission(profile.role as Role | undefined, RESOURCES.courses, action)) {
    return NextResponse.json(
      {
        error: '权限不足',
        message: `您需要 courses 资源的 ${action} 权限`,
        code: 'PERMISSION_DENIED',
        requiredResource: RESOURCES.courses,
        requiredActions: [action],
      },
      { status: 403 }
    )
  }

  return null
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function summarizeCoursePayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_order_id: hasNonEmptyString(payload?.order_id),
    has_classin_course_id: hasValue(payload?.classin_course_id),
    has_course_name: hasNonEmptyString(payload?.course_name),
    has_subject: hasNonEmptyString(payload?.subject),
    has_grade: hasNonEmptyString(payload?.grade),
    has_teacher_id: hasNonEmptyString(payload?.teacher_id),
    has_teacher_name: hasNonEmptyString(payload?.teacher_name),
    has_session_count: hasValue(payload?.session_count),
    has_total_hours: hasValue(payload?.total_hours),
    has_consumption_info: hasValue(payload?.course_consumption_info),
    has_notes: hasNonEmptyString(payload?.notes),
  }
}

// GET: 获取课程列表（支持ID查询单个、按学生筛选、分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const studentId = searchParams.get('student_id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const profile = await getProfileFromHeaders(request)
    const permissionError = requireCoursePermission(profile, ACTIONS.view)
    if (permissionError) return permissionError

    const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)

    logger.debug('获取课程数据', { id, studentId, from, to })

    // 如果提供了ID，查询单个课程
    if (id) {
      let detailQuery = supabaseServer
        .from('courses')
        .select(COURSE_RESPONSE_SELECT)
        .eq('id', id)

      detailQuery = restrictByIds(detailQuery, 'order_id', accessibleOrderIds)

      const { data, error } = await detailQuery
        .single()

      if (error) {
        logger.error('获取课程失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取课程失败' },
          { status: 400 }
        )
      }

      logger.debug('获取课程成功', { id })
      return NextResponse.json({ data: formatCourseResponse(data) })
    }

    // 基础查询
    let query = supabaseServer
      .from('courses')
      .select(COURSE_RESPONSE_SELECT, { count: 'exact' })

    query = restrictByIds(query, 'order_id', accessibleOrderIds)

    // 按学生筛选
    if (studentId) {
      query = query.eq('formal_orders.student_id', studentId)
    }

    // 分页查询数据，按创建时间降序排序
    query = query
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      logger.error('获取课程列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取课程列表失败' },
        { status: 400 }
      )
    }

    // 格式化数据（展平嵌套对象）
    const formattedData = (data || []).map(formatCourseResponse)

    logger.debug('获取课程列表成功', { count: formattedData.length || 0 })
    return NextResponse.json({
      data: formattedData,
      count: count || 0,
      from,
      to,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '获取课程失败')
    logger.error('获取课程异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// POST: 创建新课程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getProfileFromHeaders(request)
    const bodySummary = summarizeCoursePayload(body)
    const permissionError = requireCoursePermission(profile, ACTIONS.create)
    if (permissionError) return permissionError

    const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)

    logger.debug('创建课程 - 接收到的数据摘要', { body_summary: bodySummary })

    // 验证：订单ID必填
    if (!body.order_id || typeof body.order_id !== 'string') {
      logger.error('创建课程失败 - 订单ID为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      )
    }

    // 验证：订单是否存在
    const { data: order, error: orderError } = await supabaseServer
      .from('formal_orders')
      .select('id, student_id')
      .eq('id', body.order_id)
      .single()

    if (orderError || !order) {
      logger.error('创建课程失败 - 订单不存在', { order_id: body.order_id })
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    if (!hasScopedIdAccess(accessibleOrderIds, body.order_id)) {
      logger.warn('创建课程失败 - 无权访问订单', { order_id: body.order_id, profileId: profile?.id })
      return NextResponse.json(
        { error: '无权为该订单创建课程' },
        { status: 403 }
      )
    }

    // 验证：该订单是否已有课程（一对一关系）
    const { data: existingCourse } = await supabaseServer
      .from('courses')
      .select('id')
      .eq('order_id', body.order_id)
      .single()

    if (existingCourse) {
      logger.error('创建课程失败 - 订单已关联课程', { order_id: body.order_id })
      return NextResponse.json(
        { error: '该订单已关联课程，请勿重复创建' },
        { status: 400 }
      )
    }

    const insertData = {
      order_id: body.order_id,
      student_id: order.student_id,
      classin_course_id: body.classin_course_id || null,
      course_name: body.course_name || null,
      subject: body.subject || null,
      grade: body.grade || null,
      teacher_id: body.teacher_id || null,
      teacher_name: body.teacher_name || null,
      session_count: body.session_count || 0,
      total_hours: body.total_hours || 0,
      course_status: body.course_status || 'active',
      course_consumption_info: body.course_consumption_info || null,
      notes: body.notes || null,
    }

    logger.debug('创建课程 - 准备插入的数据摘要', { insert_summary: summarizeCoursePayload(insertData) })

    const { data, error } = await supabaseServer
      .from('courses')
      .insert(insertData)
      .select(COURSE_RESPONSE_SELECT)
      .single()

    if (error) {
      logger.error('创建课程失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 格式化返回数据
    const formattedData = formatCourseResponse(data)

    logger.info('创建课程成功', { id: data.id })
    return NextResponse.json({ data: formattedData }, { status: 201 })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '创建课程失败')
    logger.error('创建课程异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// PUT: 更新课程
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getProfileFromHeaders(request)

    const { id, ...updateData } = body
    const updateSummary = summarizeCoursePayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少课程ID' },
        { status: 400 }
      )
    }

    const permissionError = requireCoursePermission(profile, ACTIONS.edit)
    if (permissionError) return permissionError

    const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)

    logger.debug('更新课程 - 接收到的数据摘要', { id, update_summary: updateSummary })

    let accessQuery = supabaseServer
      .from('courses')
      .select('id, order_id')
      .eq('id', id)

    accessQuery = restrictByIds(accessQuery, 'order_id', accessibleOrderIds)

    const { data: accessCourse, error: accessError } = await accessQuery.single()

    if (accessError || !accessCourse) {
      logger.warn('更新课程失败 - 无权访问课程', { id, profileId: profile?.id, error_summary: summarizeError(accessError) })
      return NextResponse.json(
        { error: '无权修改该课程' },
        { status: 403 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'classin_course_id', 'course_name', 'subject', 'grade',
      'teacher_id', 'teacher_name', 'session_count', 'total_hours',
      'course_status', 'course_consumption_info', 'notes'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新课程 - 准备更新的数据摘要', { id, update_summary: summarizeCoursePayload(updatePayload) })

    const { data, error } = await supabaseServer
      .from('courses')
      .update(updatePayload)
      .eq('id', id)
      .select(COURSE_RESPONSE_SELECT)
      .single()

    if (error) {
      logger.error('更新课程失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 格式化返回数据
    const formattedData = formatCourseResponse(data)

    logger.info('更新课程成功', { id })
    return NextResponse.json({ data: formattedData })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '更新课程失败')
    logger.error('更新课程异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// DELETE: 删除课程
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少课程ID' },
        { status: 400 }
      )
    }

    logger.debug('删除课程', { id })

    const profile = await getProfileFromHeaders(request)
    const permissionError = requireCoursePermission(profile, ACTIONS.delete)
    if (permissionError) return permissionError

    const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)
    let accessQuery = supabaseServer
      .from('courses')
      .select('id, order_id')
      .eq('id', id)

    accessQuery = restrictByIds(accessQuery, 'order_id', accessibleOrderIds)

    const { data: accessCourse, error: accessError } = await accessQuery.maybeSingle()

    if (accessError || !accessCourse) {
      logger.warn('删除课程失败 - 无权访问课程', { id, profileId: profile?.id, error_summary: summarizeError(accessError) })
      return NextResponse.json(
        { error: '无权删除该课程' },
        { status: 403 }
      )
    }

    const { error } = await supabaseServer
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除课程失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除课程成功', { id })
    return NextResponse.json({ success: true })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '删除课程失败')
    logger.error('删除课程异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}
