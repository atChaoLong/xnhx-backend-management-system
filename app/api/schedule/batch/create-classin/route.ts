import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { ensureClassInStudentAccount } from "@/lib/server-classin-students"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getAccessibleFormalOrderIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:ScheduleBatchCreateClassIn")

const TEACHER_CLASSIN_UID_FIELDS = 'uid'
const MAX_BATCH_SCHEDULE_ITEMS = 120

interface SchedulePayloadItem {
  studentName: string
  teacherName: string
  subject: string
  date: string
  startTime: string
  endTime: string
}

interface ScheduleValidationError {
  index: number
  error: string
}

interface ExistingSessionForConflict {
  id: string
  course_id: string | null
  scheduled_date: string
  scheduled_time_start: string
  scheduled_time_end: string
  teacher_name: string | null
  courses?: { student_id?: string | null; course_name?: string | null } | Array<{ student_id?: string | null; course_name?: string | null }> | null
}

function toClassInId(value: unknown, label: string): number {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
    ? Number(value.trim())
    : NaN

  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error(`${label}无效`)
  }

  return numeric
}

function maybeClassInId(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null
  return toClassInId(value, label)
}

function normalizePersonName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, "").toLowerCase() : ""
}

function toNameList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,\n，、]/)
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function toNormalizedNameSet(value: unknown): Set<string> {
  return new Set(toNameList(value).map(normalizePersonName).filter(Boolean))
}

function normalizeClockTime(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("上课时间格式无效")
  }

  const trimmed = value.trim()
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed)
  if (!match) {
    throw new Error("上课时间格式必须为 HH:mm 或 HH:mm:ss")
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function buildChinaDateTime(dateValue: unknown, timeValue: unknown): Date {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("上课日期格式必须为 YYYY-MM-DD")
  }

  const date = new Date(`${dateValue}T${normalizeClockTime(timeValue)}:00+08:00`)
  if (Number.isNaN(date.getTime())) {
    throw new Error("上课日期时间无效")
  }

  return date
}

function sessionKey(date: unknown, startTime: unknown, endTime: unknown) {
  return `${date}_${normalizeClockTime(startTime)}_${normalizeClockTime(endTime)}`
}

function validateScheduleItems(items: SchedulePayloadItem[]): ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = []
  const seenKeys = new Map<string, number>()

  items.forEach((item, index) => {
    const rowNumber = index + 1

    try {
      if (!item || typeof item !== "object") {
        throw new Error("排课记录格式无效")
      }

      if (!item.studentName?.trim()) {
        throw new Error("缺少学生姓名")
      }

      if (!item.teacherName?.trim()) {
        throw new Error("缺少老师姓名")
      }

      if (!item.date) {
        throw new Error("缺少上课日期")
      }

      if (!item.startTime || !item.endTime) {
        throw new Error("缺少上课开始或结束时间")
      }

      const startTime = buildChinaDateTime(item.date, item.startTime)
      const endTime = buildChinaDateTime(item.date, item.endTime)

      if (endTime.getTime() <= startTime.getTime()) {
        throw new Error("结束时间必须晚于开始时间")
      }

      const key = sessionKey(item.date, item.startTime, item.endTime)
      const firstRow = seenKeys.get(key)
      if (firstRow) {
        throw new Error(`与第 ${firstRow} 条排课时间重复`)
      }
      seenKeys.set(key, rowNumber)
    } catch (error) {
      errors.push({
        index: rowNumber,
        error: error instanceof Error ? error.message : "排课记录无效",
      })
    }
  })

  return errors
}

function validateScheduleItemsAgainstOrder(
  items: SchedulePayloadItem[],
  expectedStudentName: string | null,
  orderTeacherNames: unknown,
): ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = []
  const normalizedStudentName = normalizePersonName(expectedStudentName)
  const allowedTeacherNames = toNormalizedNameSet(orderTeacherNames)

  items.forEach((item, index) => {
    const rowNumber = index + 1

    if (normalizedStudentName && normalizePersonName(item.studentName) !== normalizedStudentName) {
      errors.push({ index: rowNumber, error: "排课学生必须与订单学生一致" })
    }

    if (allowedTeacherNames.size > 0 && !allowedTeacherNames.has(normalizePersonName(item.teacherName))) {
      errors.push({ index: rowNumber, error: "排课老师必须在订单老师范围内" })
    }
  })

  return errors
}

function getJoinedCourse(session: ExistingSessionForConflict) {
  return Array.isArray(session.courses) ? session.courses[0] : session.courses
}

function isSameSessionTime(
  session: ExistingSessionForConflict,
  item: SchedulePayloadItem,
) {
  return session.scheduled_date === item.date &&
    normalizeClockTime(session.scheduled_time_start) === normalizeClockTime(item.startTime) &&
    normalizeClockTime(session.scheduled_time_end) === normalizeClockTime(item.endTime)
}

function sessionOverlapsItem(session: ExistingSessionForConflict, item: SchedulePayloadItem) {
  if (session.scheduled_date !== item.date) {
    return false
  }

  const sessionStart = buildChinaDateTime(session.scheduled_date, session.scheduled_time_start)
  const sessionEnd = buildChinaDateTime(session.scheduled_date, session.scheduled_time_end)
  const itemStart = buildChinaDateTime(item.date, item.startTime)
  const itemEnd = buildChinaDateTime(item.date, item.endTime)

  return sessionStart.getTime() < itemEnd.getTime() && sessionEnd.getTime() > itemStart.getTime()
}

async function validateScheduleItemsAgainstExistingSessions(
  items: SchedulePayloadItem[],
  orderStudentId: string | null,
  currentCourseId: string | null,
): Promise<ScheduleValidationError[]> {
  const dates = Array.from(new Set(items.map(item => item.date).filter(Boolean)))
  if (dates.length === 0) {
    return []
  }

  const { data, error } = await supabaseServer
    .from('class_sessions')
    .select(`
      id,
      course_id,
      scheduled_date,
      scheduled_time_start,
      scheduled_time_end,
      teacher_name,
      courses (
        student_id,
        course_name
      )
    `)
    .in('scheduled_date', dates)
    .neq('status', 'cancelled')

  if (error) {
    logger.error("查询全局排课冲突失败", { error_summary: summarizeError(error) })
    throw new Error("查询排课冲突失败")
  }

  const existingSessions = (data || []) as ExistingSessionForConflict[]
  const errors: ScheduleValidationError[] = []

  items.forEach((item, index) => {
    const rowNumber = index + 1
    const normalizedTeacherName = normalizePersonName(item.teacherName)

    const conflict = existingSessions.find((session) => {
      if (
        currentCourseId &&
        session.course_id === currentCourseId &&
        isSameSessionTime(session, item)
      ) {
        return false
      }

      if (!sessionOverlapsItem(session, item)) {
        return false
      }

      const course = getJoinedCourse(session)
      const sameStudent = Boolean(orderStudentId && course?.student_id === orderStudentId)
      const sameTeacher = Boolean(
        normalizedTeacherName &&
        normalizePersonName(session.teacher_name) === normalizedTeacherName
      )

      return sameStudent || sameTeacher
    })

    if (!conflict) {
      return
    }

    const course = getJoinedCourse(conflict)
    const sameStudent = Boolean(orderStudentId && course?.student_id === orderStudentId)
    const sameTeacher = Boolean(
      normalizedTeacherName &&
      normalizePersonName(conflict.teacher_name) === normalizedTeacherName
    )
    const conflictTarget = sameStudent && sameTeacher
      ? "学生和老师"
      : sameStudent
      ? "学生"
      : "老师"

    errors.push({
      index: rowNumber,
      error: `与已有课节冲突：${conflictTarget}在 ${conflict.scheduled_date} ${normalizeClockTime(conflict.scheduled_time_start)}-${normalizeClockTime(conflict.scheduled_time_end)} 已有排课`,
    })
  })

  return errors
}

function scheduleItemLogSummary(item: Partial<SchedulePayloadItem> | undefined, index?: number) {
  return {
    index,
    date: item?.date,
    startTime: item?.startTime,
    endTime: item?.endTime,
    hasTeacherName: Boolean(item?.teacherName),
    hasStudentName: Boolean(item?.studentName),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, orderId, className } = body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "请求体缺少 items 或为空" }, { status: 400 })
    }

    if (items.length > MAX_BATCH_SCHEDULE_ITEMS) {
      return NextResponse.json(
        { error: `单次最多创建 ${MAX_BATCH_SCHEDULE_ITEMS} 节课，请拆分后提交` },
        { status: 400 },
      )
    }

    if (!orderId) {
      return NextResponse.json({ error: "缺少 orderId" }, { status: 400 })
    }

    const profile = await getProfileFromHeaders(request)
    const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)
    if (!hasScopedIdAccess(accessibleOrderIds, orderId)) {
      logger.warn("批量创建 ClassIn 失败 - 无权访问订单", { orderId, profileId: profile?.id })
      return NextResponse.json({ error: "无权为该订单排课" }, { status: 403 })
    }

    // 获取订单信息
    const { data: order, error: orderError } = await supabaseServer
      .from('formal_orders')
      .select('id, student_id, total_sessions, total_hours, subjects, teacher_names')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      logger.error('订单不存在', { orderId, error_summary: summarizeError(orderError) })
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 获取学生信息（如果存在）
    let gradeCode = null
    let studentClassinUid: number | null = null
    let studentParentPhone: string | null = null
    let studentName: string | null = null

    if (order.student_id) {
      const { data: student, error: studentError } = await supabaseServer
        .from('students')
        .select('student_name, grade_code, classin_uid, parent_phone')
        .eq('id', order.student_id)
        .single()

      if (studentError || !student) {
        logger.error("订单关联学生不存在", { orderId, studentId: order.student_id, error_summary: summarizeError(studentError) })
        return NextResponse.json({ error: "订单学生不存在或不可用" }, { status: 400 })
      }

      studentName = student.student_name || null
      gradeCode = student?.grade_code || null
      studentClassinUid = maybeClassInId(student?.classin_uid, "学生 ClassIn UID")
      studentParentPhone = student?.parent_phone || null
    }

    const sdk = getClassInSDKService()
    let success = 0
    const results: any[] = []

    const scheduleItems = items as SchedulePayloadItem[]
    const validationErrors = validateScheduleItems(scheduleItems)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: validationErrors[0]?.error || "排课信息校验失败",
          errors: validationErrors,
          failed: validationErrors.length,
          total: scheduleItems.length,
        },
        { status: 400 },
      )
    }

    const businessScopeErrors = validateScheduleItemsAgainstOrder(
      scheduleItems,
      studentName,
      order.teacher_names,
    )
    if (businessScopeErrors.length > 0) {
      logger.warn("批量创建 ClassIn 失败 - 排课记录不属于订单范围", {
        orderId,
        failed: businessScopeErrors.length,
        firstIndex: businessScopeErrors[0]?.index,
      })
      return NextResponse.json(
        {
          error: businessScopeErrors[0]?.error || "排课记录不属于订单范围",
          errors: businessScopeErrors,
          failed: businessScopeErrors.length,
          total: scheduleItems.length,
        },
        { status: 400 },
      )
    }

    const first = scheduleItems[0]
    if (!first.teacherName || !first.studentName) {
      return NextResponse.json({ error: "首条记录缺少 teacherName 或 studentName" }, { status: 400 })
    }

    const courseName = className?.trim() || `${first.studentName} ${first.subject || ""}课`

    // 1. 先检查订单是否已有课程（检查本地和 ClassIn）
    let courseId: number | null = null
    let localCourseId: string | null = null

    const { data: existingCourse, error: fetchError } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id, course_name')
      .eq('order_id', orderId)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error("查询现有课程失败", { orderId, error_summary: summarizeError(fetchError) })
    }

    const subject = order.subjects?.[0] || first.subject
    const teacherName = toNameList(order.teacher_names)[0] || first.teacherName
    const grade = gradeCode

    // 尝试查找教师ID
    let teacherId = null
    if (teacherName) {
      const { data: teacherProfile } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('name', teacherName)
        .single()
      teacherId = teacherProfile?.id || null
    }

    if (existingCourse) {
      // 2a. 课程已存在，使用现有课程
      localCourseId = existingCourse.id
      courseId = maybeClassInId(existingCourse.classin_course_id, "ClassIn 课程ID")
      logger.info("使用现有课程", { orderId, localCourseId, classinCourseId: courseId })

      // 如果本地有课程但 ClassIn course_id 为空，需要创建
      if (!courseId) {
        logger.info("本地课程存在但 ClassIn 课程 ID 为空，创建新 ClassIn 课程", { localCourseId })

        const { data: firstTeacher, error: firstTErr } = await supabaseServer
          .from("teacher_classin")
          .select(TEACHER_CLASSIN_UID_FIELDS)
          .eq("name", first.teacherName)
          .eq("is_del", 0)
          .single()
        if (firstTErr || !firstTeacher?.uid) {
          return NextResponse.json({ error: "教师未绑定 ClassIn，无法创建课程" }, { status: 400 })
        }

        courseId = await sdk.createCourse({ courseName })

        // 更新本地课程的 ClassIn ID
        const { error: updateError } = await supabaseServer
          .from('courses')
          .update({
            classin_course_id: courseId,
            course_name: courseName,
          })
          .eq('id', existingCourse.id)

        if (updateError) {
          logger.error("更新课程 ClassIn ID 失败", { localCourseId, error_summary: summarizeError(updateError) })
          return NextResponse.json({ error: "更新本地课程 ClassIn ID 失败" }, { status: 500 })
        } else {
          logger.info("更新课程 ClassIn ID 成功", { localCourseId, classinCourseId: courseId })
        }

        // 写入 class_classin 表
        try {
          await supabaseServer
            .from("class_classin")
            .upsert(
              {
                course_id: courseId,
                course_name: courseName,
                creator_uid: toClassInId(firstTeacher.uid, "老师 ClassIn UID"),
                creater_name: first.teacherName,
                add_time: Math.floor(Date.now() / 1000),
                course_state: 1,
                sync_time: new Date().toISOString(),
              },
              { onConflict: "course_id" }
            )
        } catch (e) {
          logger.warn("写入 class_classin 失败（非致命）", { error_summary: summarizeError(e) })
        }
      }
    } else {
      // 2b. 课程不存在，创建新课程
      logger.info("课程不存在，创建新 ClassIn 课程和本地课程", { orderId })

      const { data: firstTeacher, error: firstTErr } = await supabaseServer
        .from("teacher_classin")
        .select(TEACHER_CLASSIN_UID_FIELDS)
        .eq("name", first.teacherName)
        .eq("is_del", 0)
        .single()
      if (firstTErr || !firstTeacher?.uid) {
        return NextResponse.json({ error: "教师未绑定 ClassIn，无法创建课程" }, { status: 400 })
      }

      // 创建 ClassIn 课程
      courseId = await sdk.createCourse({ courseName })

      // 写入 class_classin 表
      try {
        await supabaseServer
          .from("class_classin")
          .upsert(
            {
              course_id: courseId,
              course_name: courseName,
              creator_uid: toClassInId(firstTeacher.uid, "老师 ClassIn UID"),
              creater_name: first.teacherName,
              add_time: Math.floor(Date.now() / 1000),
              course_state: 1,
              sync_time: new Date().toISOString(),
            },
            { onConflict: "course_id" }
          )
      } catch (e) {
        logger.warn("写入 class_classin 失败（非致命）", { error_summary: summarizeError(e) })
      }

      // 创建本地 course 记录
      const { data: courseData, error: courseError } = await supabaseServer
        .from('courses')
        .insert({
          order_id: orderId,
          student_id: order.student_id,
          classin_course_id: courseId,
          course_name: courseName,
          subject: subject,
          grade: grade,
          teacher_id: teacherId,
          teacher_name: teacherName,
          session_count: scheduleItems.length,
          total_hours: order.total_hours || 0,
          course_status: 'active',
          course_consumption_info: JSON.stringify({
            totalSessions: scheduleItems.length,
            completedSessions: 0,
            progress: 0,
            lastSyncTime: new Date().toISOString(),
          }),
          notes: `通过批量排课创建，订单号：${order.id || ''}`,
        })
        .select('id')
        .single()

      if (courseError) {
        logger.error("创建本地 course 记录失败", { orderId, courseId, error_summary: summarizeError(courseError) })
        return NextResponse.json({ error: "创建本地课程失败" }, { status: 500 })
      } else if (courseData) {
        localCourseId = courseData.id
        logger.info("创建本地 course 记录成功", { orderId, classinCourseId: courseId, localCourseId })
      }
    }

    // 注册学生到 ClassIn（如果需要）并添加到课程
    if (courseId && first.studentName) {
      // 如果学生没有 classin_uid，需要先注册
      if (!studentClassinUid) {
        if (!studentParentPhone) {
          return NextResponse.json({ error: "学生缺少手机号，无法加入 ClassIn 课程" }, { status: 400 })
        }

        logger.info('学生未注册 ClassIn，开始注册或复用同步账号', {
          orderId,
          studentId: order.student_id,
          hasPhone: Boolean(studentParentPhone),
        })
        const studentBinding = await ensureClassInStudentAccount({
          telephone: studentParentPhone,
          nickname: studentName || first.studentName,
        })

        if (!studentBinding.uid) {
          logger.error('绑定学生 ClassIn 失败', {
            orderId,
            studentId: order.student_id,
            error_summary: summarizeError(studentBinding.error),
          })
          return NextResponse.json(
            { error: "学生 ClassIn 账号绑定失败" },
            { status: 400 }
          )
        }

        studentClassinUid = studentBinding.uid

        // 更新 students 表的 classin_uid
        if (order.student_id) {
          const { error: updateError } = await supabaseServer
            .from('students')
            .update({ classin_uid: studentClassinUid })
            .eq('id', order.student_id)

          if (updateError) {
            logger.warn('更新学生 classin_uid 失败', { studentId: order.student_id, error_summary: summarizeError(updateError) })
          } else {
            logger.info('更新学生 classin_uid 成功', { studentId: order.student_id, hasClassinUid: Boolean(studentClassinUid) })
          }
        }
      }

      // 将学生添加到课程（课程下所有课节均可上）
      if (studentClassinUid) {
        try {
          await sdk.addCourseStudent({
            courseId,
            studentUid: studentClassinUid,
            identity: 1,
            studentName: studentName || first.studentName,
          })
          logger.info('添加学生到课程成功', { courseId, hasStudentUid: Boolean(studentClassinUid) })
        } catch (e) {
          logger.warn('添加学生到课程失败（非致命）', { error_summary: summarizeError(e), courseId, hasStudentUid: Boolean(studentClassinUid) })
        }
      } else {
        logger.warn('学生没有 ClassIn UID，无法添加到课程', { orderId, studentId: order.student_id })
      }
    }

    // 获取现有课节列表（用于检查重复）
    const existingSessionsMap = new Map<string, any>()
    let nextSessionNumber = 1
    if (localCourseId) {
      const { data: existingSessions } = await supabaseServer
        .from('class_sessions')
        .select('id, session_number, scheduled_date, scheduled_time_start, scheduled_time_end')
        .eq('course_id', localCourseId)

      if (existingSessions) {
        for (const session of existingSessions) {
          const key = sessionKey(session.scheduled_date, session.scheduled_time_start, session.scheduled_time_end)
          existingSessionsMap.set(key, session)
        }
        nextSessionNumber = Math.max(
          0,
          ...existingSessions.map((session: any) => Number(session.session_number) || 0)
        ) + 1
      }
      logger.debug('现有课节', { count: existingSessionsMap.size })
    }

    const globalConflictErrors = await validateScheduleItemsAgainstExistingSessions(
      scheduleItems,
      order.student_id || null,
      localCourseId,
    )
    if (globalConflictErrors.length > 0) {
      logger.warn("批量创建 ClassIn 失败 - 存在全局排课冲突", {
        orderId,
        failed: globalConflictErrors.length,
        firstIndex: globalConflictErrors[0]?.index,
      })
      return NextResponse.json(
        {
          error: globalConflictErrors[0]?.error || "存在排课冲突",
          errors: globalConflictErrors,
          failed: globalConflictErrors.length,
          total: scheduleItems.length,
        },
        { status: 400 },
      )
    }

    let skipped = 0
    const errors: any[] = []

    for (const [index, raw] of scheduleItems.entries()) {
      const rowNumber = index + 1
      try {
        if (!raw.teacherName || !raw.studentName || !raw.date || !raw.startTime || !raw.endTime) {
          throw new Error("缺少必要字段：teacherName/studentName/date/startTime/endTime")
        }

        // 检查是否已存在相同时间的课节
        const currentSessionKey = sessionKey(raw.date, raw.startTime, raw.endTime)
        if (existingSessionsMap.has(currentSessionKey)) {
          const existing = existingSessionsMap.get(currentSessionKey)
          logger.debug('跳过已存在的课节', {
            key: currentSessionKey,
            existingSessionId: existing.id,
            sessionNumber: existing.session_number,
          })
          skipped++
          continue
        }

        const { data: teacherClassin, error: tErr } = await supabaseServer
          .from("teacher_classin")
          .select(TEACHER_CLASSIN_UID_FIELDS)
          .eq("name", raw.teacherName)
          .eq("is_del", 0)
          .order("uid", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (tErr || !teacherClassin?.uid) throw new Error(`第 ${rowNumber} 条教师 ${raw.teacherName} 未绑定 ClassIn`)
        const teacherUid = toClassInId(teacherClassin.uid, "老师 ClassIn UID")
        if (!courseId) throw new Error("ClassIn 课程 ID 为空，无法创建课堂")

        const classroomName = courseName
        const normalizedStartTime = normalizeClockTime(raw.startTime)
        const normalizedEndTime = normalizeClockTime(raw.endTime)
        const startTime = buildChinaDateTime(raw.date, normalizedStartTime)
        const endTime = buildChinaDateTime(raw.date, normalizedEndTime)

        if (endTime.getTime() <= startTime.getTime()) {
          throw new Error("结束时间必须晚于开始时间")
        }

        logger.debug("准备创建 ClassIn 课堂", {
          courseId,
          hasTeacherUid: Boolean(teacherUid),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })

        let classroomRes: any
        try {
          classroomRes = await sdk.createClassroom({
            courseId,
            name: classroomName,
            teacherUid,
            startTime,
            endTime,
            liveState: 0,
            openState: 0,
            recordState: 1,
            recordType: 0,
            seatNum: 2, // 一对一（1v1）
          })

          logger.info("创建 ClassIn 课堂成功", {
            classId: classroomRes.classId,
            activityId: classroomRes.activityId,
          })
        } catch (e) {
          logger.error("创建 ClassIn 课堂失败", {
            courseId,
            error_summary: summarizeError(e),
          })
          throw e // 重新抛出，跳过这条记录
        }

        try {
          const classroomClassinData = {
            class_id: classroomRes.classId,
            name: classroomName,
            start_time: Math.floor(startTime.getTime() / 1000),
            end_time: Math.floor(endTime.getTime() / 1000),
            course_id: courseId,
            course_name: courseName,
            activity_id: classroomRes.activityId,
            created_at_timestamp: Math.floor(Date.now() / 1000),
            sync_time: new Date().toISOString(),
          }

          logger.debug("准备写入 classroom_classin", {
            classId: classroomRes.classId,
            courseId,
            hasActivityId: Boolean(classroomRes.activityId),
          })

          const { error: upsertError } = await supabaseServer
            .from("classroom_classin")
            .upsert(classroomClassinData, { onConflict: "class_id" })

          if (upsertError) {
            logger.error("写入 classroom_classin 失败", {
              error_summary: summarizeError(upsertError),
            })
            throw new Error("写入 classroom_classin 失败")
          }

          logger.info("写入 classroom_classin 成功", { classId: classroomRes.classId })
        } catch (e) {
          logger.error("写入 classroom_classin 异常", {
            error_summary: summarizeError(e),
            classId: classroomRes.classId,
          })
          throw e // 重新抛出，跳过这条记录
        }

        // 创建本地 class_session 记录（课节）
        if (localCourseId) {
          try {
            const sessionNumber = nextSessionNumber

            // 计算时长（分钟）
            const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)

            const sessionDataToInsert = {
              course_id: localCourseId,
              classroom_id: classroomRes.classId,
              session_number: sessionNumber,
              session_name: `第${sessionNumber}节`,
              scheduled_date: raw.date,
              scheduled_time_start: normalizedStartTime,
              scheduled_time_end: normalizedEndTime,
              scheduled_duration_minutes: durationMinutes,
              status: 'scheduled' as const,
              teacher_name: raw.teacherName,
            }

            logger.debug("准备创建课节记录", {
              localCourseId,
              sessionNumber,
              classroomId: classroomRes.classId,
              date: raw.date,
              startTime: normalizedStartTime,
              endTime: normalizedEndTime,
            })

            const { data: sessionData, error: sessionError } = await supabaseServer
              .from("class_sessions")
              .insert(sessionDataToInsert)
              .select('id')
              .single()

            if (sessionError) {
              logger.error("插入 class_session 失败", {
                localCourseId,
                sessionNumber,
                error_summary: summarizeError(sessionError),
              })
              throw new Error("插入课节失败")
            }

            if (!sessionData) {
              logger.error("插入 class_session 返回空数据", {
                localCourseId,
                sessionNumber,
              })
              throw new Error("插入课节返回空数据")
            }

            // 添加到现有课节Map，避免后续重复
            existingSessionsMap.set(currentSessionKey, {
              id: sessionData.id,
              session_number: sessionNumber,
              scheduled_date: raw.date,
              scheduled_time_start: normalizedStartTime,
              scheduled_time_end: normalizedEndTime,
            })
            nextSessionNumber++

            logger.info("创建课节记录成功", {
              localCourseId,
              sessionId: sessionData.id,
              sessionNumber,
              classroomId: classroomRes.classId
            })
          } catch (e) {
            logger.error("创建 class_session 异常", {
              error_summary: summarizeError(e),
              localCourseId,
              item: scheduleItemLogSummary(raw, rowNumber),
            })
            throw e
          }
        } else {
          throw new Error("本地课程 ID 为空，无法创建课节")
        }

        success++
        results.push({
          courseId,
          classId: classroomRes.classId,
          activityId: classroomRes.activityId,
          courseName,
          classroomName,
          date: raw.date,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime,
        })
      } catch (e) {
        const actualError = e instanceof Error ? e.message : (typeof e === 'string' ? e : '创建课堂失败')
        logger.warn("批量创建失败条目", {
          error_summary: summarizeError(e),
          actualError,
          item: scheduleItemLogSummary(raw, rowNumber),
        })
        errors.push({
          index: rowNumber,
          date: raw?.date,
          startTime: raw?.startTime,
          endTime: raw?.endTime,
          error: actualError,
        })
      }

      // 避免 ClassIn API 限流，每次创建课堂之间加 300ms 延迟
      if (success + skipped + errors.length < scheduleItems.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // 同步更新课程统计信息
    if (localCourseId) {
      try {
        // 获取该课程的所有课节
        const { data: allSessions, error: sessionsError } = await supabaseServer
          .from('class_sessions')
          .select('id, status, scheduled_date, scheduled_time_start, scheduled_time_end')
          .eq('course_id', localCourseId)

        if (sessionsError) {
          logger.warn("获取课程所有课节失败（非致命）", { localCourseId, error_summary: summarizeError(sessionsError) })
        } else {
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
            .eq('id', localCourseId)

          if (updateError) {
            logger.warn("更新课程统计信息失败（非致命）", { localCourseId, error_summary: summarizeError(updateError) })
          } else {
            logger.info("更新课程统计信息成功", {
              localCourseId,
              totalSessions,
              completedSessions,
              progress,
            })
          }
        }
      } catch (e) {
        logger.warn("同步课程统计信息异常（非致命）", { localCourseId, error_summary: summarizeError(e) })
      }
    }

    const status = success > 0 || skipped > 0 ? 200 : 400

    return NextResponse.json({
      success,
      skipped,
      failed: errors.length,
      total: items.length,
      courseId,
      courseName,
      results,
      errors,
      error: status === 400 ? (errors[0]?.error || "批量创建失败") : undefined,
    }, { status })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "批量创建失败")
    logger.error("批量创建 ClassIn 异常", safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}
