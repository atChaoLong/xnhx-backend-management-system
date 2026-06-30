import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, hasScopedIdAccess, restrictByIds } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:ClassSessions')
const CLASS_SESSION_SELECT = 'id, course_id, classroom_id, session_number, session_name, scheduled_date, scheduled_time_start, scheduled_time_end, scheduled_duration_minutes, actual_start_time, actual_end_time, actual_duration_minutes, status, teacher_id, teacher_name, student_attendance_status, notes, created_at, updated_at'
const CLASS_SESSION_DETAIL_SELECT = `
  ${CLASS_SESSION_SELECT},
  course:course_id(id, course_name)
`
const CLASS_SESSION_LIST_SELECT = `
  ${CLASS_SESSION_SELECT},
  course:course_id(
    id,
    course_name,
    subject,
    grade,
    student:student_id(id, student_name, student_code)
  )
`

const SCHEDULE_TIME_FIELDS = new Set([
  'scheduled_date',
  'scheduled_time_start',
  'scheduled_time_end',
])

const VALID_SESSION_STATUS_FILTERS = new Set([
  'scheduled',
  'completed',
  'cancelled',
  'missed',
  'no-show',
])

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function parseNonNegativeInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseBoundedRange(searchParams: URLSearchParams) {
  const from = parseNonNegativeInt(searchParams.get('from'), 0)
  const requestedTo = parseNonNegativeInt(searchParams.get('to'), from + 19)
  return {
    from,
    to: Math.min(Math.max(requestedTo, from), from + 99),
  }
}

function summarizeClassSessionPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_course_id: hasNonEmptyString(payload?.course_id),
    session_count: Array.isArray(payload?.sessions) ? payload.sessions.length : undefined,
    has_classroom_id: hasNonEmptyString(payload?.classroom_id),
    has_session_number: hasValue(payload?.session_number),
    has_session_name: hasNonEmptyString(payload?.session_name),
    has_scheduled_date: hasNonEmptyString(payload?.scheduled_date),
    has_scheduled_time_start: hasNonEmptyString(payload?.scheduled_time_start),
    has_scheduled_time_end: hasNonEmptyString(payload?.scheduled_time_end),
    has_teacher_id: hasNonEmptyString(payload?.teacher_id),
    has_teacher_name: hasNonEmptyString(payload?.teacher_name),
    has_student_attendance_status: hasNonEmptyString(payload?.student_attendance_status),
    has_notes: hasNonEmptyString(payload?.notes),
  }
}

function normalizeClockTime(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('上课时间格式无效')
  }

  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }

  throw new Error('上课时间格式必须为 HH:mm 或 HH:mm:ss')
}

function buildChinaDateTime(dateValue: unknown, timeValue: unknown): Date {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error('上课日期格式必须为 YYYY-MM-DD')
  }

  const date = new Date(`${dateValue}T${normalizeClockTime(timeValue)}+08:00`)
  if (Number.isNaN(date.getTime())) {
    throw new Error('上课日期时间无效')
  }
  return date
}

function shouldSyncClassInSchedule(updateData: Record<string, any>) {
  return Object.keys(updateData).some((field) => SCHEDULE_TIME_FIELDS.has(field))
}

/**
 * 同步更新课程统计信息
 * 当课节增删改时，自动更新课程的 session_count 和 course_consumption_info
 */
async function syncCourseStats(courseId: string) {
  try {
    // 获取该课程的所有课节
    const { data: allSessions, error: sessionsError } = await supabaseServer
      .from('class_sessions')
      .select('id, status, scheduled_date, scheduled_time_start, scheduled_time_end')
      .eq('course_id', courseId)

    if (sessionsError) {
      logger.warn("获取课程所有课节失败（非致命）", { courseId, error_summary: summarizeError(sessionsError) })
      return
    }

    // 统计课程信息
    const totalSessions = allSessions?.length || 0
    const completedSessions = allSessions?.filter((s: any) => s.status === 'completed').length || 0
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

    // 获取最后上课日期
    let lastSessionDate = null
    if (allSessions && allSessions.length > 0) {
      const sortedByDate = [...allSessions].sort((a: any, b: any) =>
        new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
      )
      lastSessionDate = sortedByDate[0].scheduled_date
    }

    // 更新课程统计信息
    const consumptionInfo = {
      totalSessions,
      completedSessions,
      progress,
      lastSessionDate,
      lastSyncTime: new Date().toISOString(),
    }

    const { error: updateError } = await supabaseServer
      .from('courses')
      .update({
        session_count: totalSessions,
        course_consumption_info: JSON.stringify(consumptionInfo),
      })
      .eq('id', courseId)

    if (updateError) {
      logger.warn("更新课程统计信息失败（非致命）", { courseId, error_summary: summarizeError(updateError) })
    } else {
      logger.info("同步课程统计信息成功", {
        courseId,
        totalSessions,
        completedSessions,
        progress,
        lastSessionDate,
      })
    }
  } catch (error) {
    logger.warn("同步课程统计信息异常（非致命）", summarizeError(error))
  }
}

// GET: 获取课时列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const courseId = searchParams.get('course_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const status = searchParams.get('status')
    const { from, to } = parseBoundedRange(searchParams)
    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    logger.debug('获取课时数据', {
      id,
      courseId,
      has_start_date: Boolean(startDate),
      has_end_date: Boolean(endDate),
      status: status || null,
    })

    // 如果提供了ID，查询单个课时
    if (id) {
      let detailQuery = supabaseServer
        .from('class_sessions')
        .select(CLASS_SESSION_DETAIL_SELECT)
        .eq('id', id)

      detailQuery = restrictByIds(detailQuery, 'course_id', accessibleCourseIds)

      const { data, error } = await detailQuery
        .single()

      if (error) {
        logger.error('获取课时失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取课时失败' },
          { status: 400 }
        )
      }

      logger.debug('获取课时成功', { id })
      return NextResponse.json({ data })
    }

    // 基础查询
    let query = supabaseServer
      .from('class_sessions')
      .select(CLASS_SESSION_LIST_SELECT)

    query = restrictByIds(query, 'course_id', accessibleCourseIds)

    // 按课程筛选
    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    if (startDate) {
      query = query.gte('scheduled_date', startDate)
    }

    if (endDate) {
      query = query.lte('scheduled_date', endDate)
    }

    if (status) {
      if (!VALID_SESSION_STATUS_FILTERS.has(status)) {
        return NextResponse.json(
          { error: '课节状态筛选无效' },
          { status: 400 }
        )
      }
      query = query.eq('status', status)
    }

    if (startDate || endDate) {
      query = query
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time_start', { ascending: true })
        .order('session_number', { ascending: true })
    } else {
      query = query.order('session_number', { ascending: true })
    }

    const shouldPageBroadList = searchParams.has('from') || searchParams.has('to') || (!courseId && !startDate && !endDate)
    if (shouldPageBroadList) {
      query = query.range(from, to)
    }

    const { data, error } = await query

    if (error) {
      logger.error('获取课时列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取课时列表失败' },
        { status: 400 }
      )
    }

    logger.debug('获取课时列表成功', { count: data?.length || 0 })
    return NextResponse.json({ data: data || [], from: shouldPageBroadList ? from : undefined, to: shouldPageBroadList ? to : undefined })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '获取课时失败')
    logger.error('获取课时异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// POST: 创建新课时（支持批量创建）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)
    const bodySummary = summarizeClassSessionPayload(body)

    logger.debug('创建课时 - 接收到的数据摘要', { body_summary: bodySummary })

    // 检查是否为批量创建
    if (body.sessions && Array.isArray(body.sessions)) {
      // 批量创建
      if (body.sessions.length === 0) {
        return NextResponse.json(
          { error: '课时列表不能为空' },
          { status: 400 }
        )
      }

      const inaccessibleSession = body.sessions.find((session: any) => !hasScopedIdAccess(accessibleCourseIds, session.course_id))
      if (inaccessibleSession) {
        logger.warn('批量创建课时失败 - 无权访问课程', {
          courseId: inaccessibleSession.course_id,
          profileId: profile?.id,
        })
        return NextResponse.json(
          { error: '无权为该课程创建课时' },
          { status: 403 }
        )
      }

      const { data, error } = await supabaseServer
        .from('class_sessions')
        .insert(body.sessions)
        .select(CLASS_SESSION_SELECT)

      if (error) {
        logger.error('批量创建课时失败', { error_summary: summarizeError(error) })
        const { message, status } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }

      // 同步更新课程统计信息（批量创建时，使用第一个课节的课程ID）
      if (data && data.length > 0) {
        const courseId = data[0].course_id
        await syncCourseStats(courseId)
      }

      logger.info('批量创建课时成功', { count: data?.length || 0 })
      return NextResponse.json({ data: data || [] }, { status: 201 })
    }

    // 单个创建
    if (!body.course_id || typeof body.course_id !== 'string') {
      logger.error('创建课时失败 - 课程ID为空', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '课程ID不能为空' },
        { status: 400 }
      )
    }

    if (!hasScopedIdAccess(accessibleCourseIds, body.course_id)) {
      logger.warn('创建课时失败 - 无权访问课程', { courseId: body.course_id, profileId: profile?.id })
      return NextResponse.json(
        { error: '无权为该课程创建课时' },
        { status: 403 }
      )
    }

    if (!body.session_number || isNaN(body.session_number)) {
      logger.error('创建课时失败 - 课时序号无效', { body_summary: bodySummary })
      return NextResponse.json(
        { error: '课时序号不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      course_id: body.course_id,
      classroom_id: body.classroom_id || null,
      session_number: parseInt(body.session_number),
      session_name: body.session_name || null,
      scheduled_date: body.scheduled_date || null,
      scheduled_time_start: body.scheduled_time_start || null,
      scheduled_time_end: body.scheduled_time_end || null,
      scheduled_duration_minutes: body.scheduled_duration_minutes || null,
      actual_start_time: body.actual_start_time || null,
      actual_end_time: body.actual_end_time || null,
      actual_duration_minutes: body.actual_duration_minutes || null,
      status: body.status || 'scheduled',
      teacher_id: body.teacher_id || null,
      teacher_name: body.teacher_name || null,
      student_attendance_status: body.student_attendance_status || null,
      notes: body.notes || null,
    }

    logger.debug('创建课时 - 准备插入的数据摘要', { insert_summary: summarizeClassSessionPayload(insertData) })

    const { data, error } = await supabaseServer
      .from('class_sessions')
      .insert(insertData)
      .select(CLASS_SESSION_SELECT)
      .single()

    if (error) {
      logger.error('创建课时失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 同步更新课程统计信息
    await syncCourseStats(insertData.course_id)

    logger.info('创建课时成功', { id: data.id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '创建课时失败')
    logger.error('创建课时异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// PUT: 更新课时
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    const { id, ...updateData } = body
    const updateSummary = summarizeClassSessionPayload(updateData)

    if (!id) {
      return NextResponse.json(
        { error: '缺少课时ID' },
        { status: 400 }
      )
    }

    logger.debug('更新课时 - 接收到的数据摘要', { id, update_summary: updateSummary })

    let accessQuery = supabaseServer
      .from('class_sessions')
      .select(`
        id,
        course_id,
        classroom_id,
        session_name,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end
      `)
      .eq('id', id)

    accessQuery = restrictByIds(accessQuery, 'course_id', accessibleCourseIds)

    const { data: accessSession, error: accessError } = await accessQuery.single()

    if (accessError || !accessSession) {
      logger.warn('更新课时失败 - 无权访问课时', { id, profileId: profile?.id, error_summary: summarizeError(accessError) })
      return NextResponse.json(
        { error: '无权修改该课时' },
        { status: 403 }
      )
    }

    const updatePayload: any = {}
    const optionalFields = [
      'classroom_id', 'session_number', 'session_name',
      'scheduled_date', 'scheduled_time_start', 'scheduled_time_end',
      'scheduled_duration_minutes', 'actual_start_time', 'actual_end_time',
      'actual_duration_minutes', 'status', 'teacher_id', 'teacher_name',
      'student_attendance_status', 'notes'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新课时 - 准备更新的数据摘要', { id, update_summary: summarizeClassSessionPayload(updatePayload) })

    let classInSync: {
      attempted: boolean
      synced: boolean
      skippedReason?: string
    } = {
      attempted: false,
      synced: false,
    }

    if (shouldSyncClassInSchedule(updatePayload)) {
      if (!accessSession.classroom_id) {
        classInSync.skippedReason = '课节未绑定 ClassIn 课堂'
      } else {
        const { data: course, error: courseError } = await supabaseServer
          .from('courses')
          .select('id, classin_course_id, course_name')
          .eq('id', accessSession.course_id)
          .single()

        if (courseError || !course?.classin_course_id) {
          logger.error('同步 ClassIn 课节时间失败 - 课程未绑定 ClassIn', {
            id,
            courseId: accessSession.course_id,
            error_summary: summarizeError(courseError),
          })
          return NextResponse.json(
            { error: '该课节已绑定 ClassIn 课堂，但课程未绑定 ClassIn，无法同步修改时间' },
            { status: 400 }
          )
        } else {
          const { data: classroomClassin, error: classroomError } = await supabaseServer
            .from('classroom_classin')
            .select('class_id, activity_id, name')
            .eq('class_id', accessSession.classroom_id)
            .single()

          if (classroomError || !classroomClassin) {
            logger.error('同步 ClassIn 课节时间失败 - 本地课堂镜像不存在', {
              id,
              classroomId: accessSession.classroom_id,
              error_summary: summarizeError(classroomError),
            })
            return NextResponse.json(
              { error: '该课节已绑定 ClassIn 课堂，但本地课堂镜像不存在，无法同步修改时间' },
              { status: 400 }
            )
          } else {
            let beginTime: Date
            let endTime: Date

            try {
              const nextDate = updatePayload.scheduled_date ?? accessSession.scheduled_date
              const nextStart = updatePayload.scheduled_time_start ?? accessSession.scheduled_time_start
              const nextEnd = updatePayload.scheduled_time_end ?? accessSession.scheduled_time_end
              beginTime = buildChinaDateTime(nextDate, nextStart)
              endTime = buildChinaDateTime(nextDate, nextEnd)
            } catch (timeError) {
              logger.warn('同步 ClassIn 课节时间失败 - 时间参数无效', {
                id,
                error_summary: summarizeError(timeError),
              })
              return NextResponse.json(
                { error: '上课时间无效' },
                { status: 400 }
              )
            }

            if (endTime.getTime() <= beginTime.getTime()) {
              return NextResponse.json(
                { error: '结束时间必须晚于开始时间' },
                { status: 400 }
              )
            }

            try {
              classInSync.attempted = true
              const sdk = getClassInSDKService()
              await sdk.updateClassroom({
                courseId: Number(course.classin_course_id),
                classId: Number(classroomClassin.class_id),
                activityId: Number(classroomClassin.activity_id || classroomClassin.class_id),
                name: classroomClassin.name || accessSession.session_name || course.course_name,
                startTime: beginTime,
                endTime,
              })

              const { error: updateClassroomError } = await supabaseServer
                .from('classroom_classin')
                .update({
                  start_time: Math.floor(beginTime.getTime() / 1000),
                  end_time: Math.floor(endTime.getTime() / 1000),
                  sync_time: new Date().toISOString(),
                })
                .eq('class_id', classroomClassin.class_id)

              if (updateClassroomError) {
                logger.warn('同步 ClassIn 成功但更新本地课堂镜像失败', {
                  id,
                  classroomId: classroomClassin.class_id,
                  error_summary: summarizeError(updateClassroomError),
                })
              }

              classInSync.synced = true
              logger.info('同步 ClassIn 课节时间成功', {
                id,
                courseId: course.classin_course_id,
                classroomId: classroomClassin.class_id,
              })
            } catch (classInError) {
              const actualError = classInError instanceof Error ? classInError.message : '同步 ClassIn 课节时间失败'
              logger.error('同步 ClassIn 课节时间失败', {
                id,
                classroomId: classroomClassin.class_id,
                error_summary: summarizeError(classInError),
              })
              return NextResponse.json(
                { error: `同步 ClassIn 课节时间失败：${actualError}` },
                { status: 502 }
              )
            }
          }
        }
      }
    }

    const { data, error } = await supabaseServer
      .from('class_sessions')
      .update(updatePayload)
      .eq('id', id)
      .select(CLASS_SESSION_SELECT)
      .single()

    if (error) {
      logger.error('更新课时失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 同步更新课程统计信息（状态或排课日期变化会影响完成进度/最后上课日期）
    if ((updatePayload.status !== undefined || updatePayload.scheduled_date !== undefined) && data?.course_id) {
      await syncCourseStats(data.course_id)
    }

    logger.info('更新课时成功', { id })
    return NextResponse.json({ data, classInSync })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '更新课时失败')
    logger.error('更新课时异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}

// DELETE: 删除课时（支持同步删除 ClassIn 课堂）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteClassIn = searchParams.get('delete_classin') === 'true'
    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    if (!id) {
      return NextResponse.json(
        { error: '缺少课时ID' },
        { status: 400 }
      )
    }

    logger.debug('删除课时', { id, deleteClassIn })

    // 1. 获取课节信息（用于同步删除 ClassIn）
    let fetchQuery = supabaseServer
      .from('class_sessions')
      .select(`
        id,
        classroom_id,
        course_id,
        courses (
          id,
          classin_course_id
        )
      `)
      .eq('id', id)

    fetchQuery = restrictByIds(fetchQuery, 'course_id', accessibleCourseIds)

    const { data: session, error: fetchError } = await fetchQuery
      .single()

    if (fetchError) {
      logger.error('获取课时信息失败', { id, error_summary: summarizeError(fetchError) })
      return NextResponse.json({ error: '获取课时信息失败' }, { status: 400 })
    }

    if (!session) {
      return NextResponse.json({ error: '课时不存在' }, { status: 404 })
    }

    const relatedCourse = Array.isArray((session as any).courses)
      ? (session as any).courses[0]
      : (session as any).courses

    // 2. 如果需要同步删除 ClassIn 课堂
    let classInDeleted = false
    let classInError = false

    if (deleteClassIn && session.classroom_id && relatedCourse?.classin_course_id) {
      try {
        // 获取 ClassIn 课堂信息
        const { data: classroomClassin } = await supabaseServer
          .from('classroom_classin')
          .select('class_id, activity_id')
          .eq('class_id', session.classroom_id)
          .single()

        if (classroomClassin?.activity_id) {
          const sdk = getClassInSDKService()
          await sdk.deleteClassroom({
            courseId: Number(relatedCourse.classin_course_id),
            classId: Number(session.classroom_id),
            activityId: Number(classroomClassin.activity_id),
          })

          logger.info('删除 ClassIn 课堂成功', {
            classroomId: session.classroom_id,
            activityId: classroomClassin.activity_id,
          })

          // 删除 classroom_classin 记录
          await supabaseServer
            .from('classroom_classin')
            .delete()
            .eq('class_id', session.classroom_id)

          logger.debug('删除 classroom_classin 记录成功', { classroomId: session.classroom_id })
          classInDeleted = true
        }
      } catch (e) {
        // 解析错误信息，判断是否是"活动不存在"等可忽略的错误
        const errorMessage = e instanceof Error ? e.message : ''
        const isNotFoundError =
          errorMessage.includes('活动不存在') ||
          errorMessage.includes('30002') || // ClassIn 错误码
          errorMessage.includes('不存在') ||
          errorMessage.includes('not found')

        if (isNotFoundError) {
          // 活动不存在是预期情况，记录信息日志而不是警告
          logger.info('ClassIn 课堂不存在或已删除，跳过 ClassIn 删除', {
            classroomId: session.classroom_id,
            error_summary: summarizeError(e),
          })
          // 仍然删除 classroom_classin 记录
          try {
            await supabaseServer
              .from('classroom_classin')
              .delete()
              .eq('class_id', session.classroom_id)
          } catch (cleanupError) {
            logger.warn('清理 classroom_classin 记录失败', summarizeError(cleanupError))
          }
        } else {
          // 其他错误，记录警告但继续删除本地记录
          classInError = true
          logger.warn('删除 ClassIn 课堂失败（非致命），将继续删除本地记录', {
            classroomId: session.classroom_id,
            error_summary: summarizeError(e),
          })
        }
      }
    }

    // 3. 删除本地课节记录
    const { error } = await supabaseServer
      .from('class_sessions')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除课时失败', { id, error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    // 同步更新课程统计信息
    if (session.course_id) {
      await syncCourseStats(session.course_id)
    }

    logger.info('删除课时成功', { id, deleteClassIn, classInDeleted, classInError })
    return NextResponse.json({
      success: true,
      data: {
        id,
        deletedClassIn: classInDeleted,
        classInError,
        message: classInError
          ? '本地记录已删除，但 ClassIn 删除失败，请稍后重试同步'
          : classInDeleted
          ? '课节和 ClassIn 课堂已删除'
          : deleteClassIn
          ? '课节已删除（ClassIn 课堂不存在）'
          : '课节已删除',
      },
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '删除课时失败')
    logger.error('删除课时异常', safeError.log)
    return NextResponse.json(
      safeError.response,
      { status: safeError.status }
    )
  }
}
