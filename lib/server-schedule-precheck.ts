import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getAccessibleFormalOrderIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { summarizeError } from "@/lib/safe-error"
import type { NextRequest } from "next/server"

const logger = createLogger("SchedulePrecheck")

export interface SchedulePrecheckItem {
  studentName: string
  teacherName: string
  subject?: string
  date: string
  startTime: string
  endTime: string
}

export interface SchedulePrecheckIssue {
  index: number
  type: "error" | "warning"
  message: string
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

function getJoinedCourse(session: ExistingSessionForConflict) {
  return Array.isArray(session.courses) ? session.courses[0] : session.courses
}

function isSameSessionTime(session: ExistingSessionForConflict, item: SchedulePrecheckItem) {
  return session.scheduled_date === item.date &&
    normalizeClockTime(session.scheduled_time_start) === normalizeClockTime(item.startTime) &&
    normalizeClockTime(session.scheduled_time_end) === normalizeClockTime(item.endTime)
}

function sessionOverlapsItem(session: ExistingSessionForConflict, item: SchedulePrecheckItem) {
  if (session.scheduled_date !== item.date) {
    return false
  }

  const sessionStart = buildChinaDateTime(session.scheduled_date, session.scheduled_time_start)
  const sessionEnd = buildChinaDateTime(session.scheduled_date, session.scheduled_time_end)
  const itemStart = buildChinaDateTime(item.date, item.startTime)
  const itemEnd = buildChinaDateTime(item.date, item.endTime)

  return sessionStart.getTime() < itemEnd.getTime() && sessionEnd.getTime() > itemStart.getTime()
}

function validateRequiredFields(items: SchedulePrecheckItem[]): SchedulePrecheckIssue[] {
  const issues: SchedulePrecheckIssue[] = []

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
    } catch (error) {
      issues.push({
        index: rowNumber,
        type: "error",
        message: error instanceof Error ? error.message : "排课记录无效",
      })
    }
  })

  return issues
}

function validateItemsAgainstOrder(
  items: SchedulePrecheckItem[],
  expectedStudentName: string | null,
  orderTeacherNames: unknown,
): SchedulePrecheckIssue[] {
  const issues: SchedulePrecheckIssue[] = []
  const normalizedStudentName = normalizePersonName(expectedStudentName)
  const allowedTeacherNames = toNormalizedNameSet(orderTeacherNames)

  items.forEach((item, index) => {
    const rowNumber = index + 1

    if (normalizedStudentName && normalizePersonName(item.studentName) !== normalizedStudentName) {
      issues.push({ index: rowNumber, type: "error", message: "排课学生必须与订单学生一致" })
    }

    if (allowedTeacherNames.size > 0 && !allowedTeacherNames.has(normalizePersonName(item.teacherName))) {
      issues.push({ index: rowNumber, type: "error", message: "排课老师必须在订单老师范围内" })
    }
  })

  return issues
}

function validateItemsAgainstEachOther(items: SchedulePrecheckItem[]): SchedulePrecheckIssue[] {
  const issues: SchedulePrecheckIssue[] = []

  items.forEach((item, index) => {
    let itemStart: Date
    let itemEnd: Date

    try {
      itemStart = buildChinaDateTime(item.date, item.startTime)
      itemEnd = buildChinaDateTime(item.date, item.endTime)
    } catch {
      return
    }

    const normalizedTeacherName = normalizePersonName(item.teacherName)
    const normalizedStudentName = normalizePersonName(item.studentName)

    for (let compareIndex = 0; compareIndex < index; compareIndex++) {
      const other = items[compareIndex]
      if (other.date !== item.date) continue

      let otherStart: Date
      let otherEnd: Date
      try {
        otherStart = buildChinaDateTime(other.date, other.startTime)
        otherEnd = buildChinaDateTime(other.date, other.endTime)
      } catch {
        continue
      }

      const overlaps = otherStart.getTime() < itemEnd.getTime() && otherEnd.getTime() > itemStart.getTime()
      if (!overlaps) continue

      const sameStudent = normalizedStudentName && normalizePersonName(other.studentName) === normalizedStudentName
      const sameTeacher = normalizedTeacherName && normalizePersonName(other.teacherName) === normalizedTeacherName
      if (!sameStudent && !sameTeacher) continue

      const target = sameStudent && sameTeacher ? "学生和老师" : sameStudent ? "学生" : "老师"
      issues.push({
        index: index + 1,
        type: "error",
        message: `与第 ${compareIndex + 1} 条排课重叠：${target}时间冲突`,
      })
      break
    }
  })

  return issues
}

async function validateItemsAgainstExistingSessions(
  items: SchedulePrecheckItem[],
  orderStudentId: string | null,
  currentCourseId: string | null,
): Promise<SchedulePrecheckIssue[]> {
  const dates = Array.from(new Set(items.map(item => item.date).filter(Boolean)))
  if (dates.length === 0) {
    return []
  }

  const { data, error } = await supabaseServer
    .from("class_sessions")
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
    .in("scheduled_date", dates)
    .neq("status", "cancelled")

  if (error) {
    logger.error("查询全局排课冲突失败", { error_summary: summarizeError(error) })
    throw new Error("查询排课冲突失败")
  }

  const existingSessions = (data || []) as ExistingSessionForConflict[]
  const issues: SchedulePrecheckIssue[] = []

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

    issues.push({
      index: rowNumber,
      type: "error",
      message: `与已有课节冲突：${conflictTarget}在 ${conflict.scheduled_date} ${normalizeClockTime(conflict.scheduled_time_start)}-${normalizeClockTime(conflict.scheduled_time_end)} 已有排课`,
    })
  })

  return issues
}

export async function precheckBatchSchedule(
  request: NextRequest,
  orderId: string,
  items: SchedulePrecheckItem[],
) {
  const profile = await getCurrentProfile(request)
  const accessibleOrderIds = await getAccessibleFormalOrderIds(profile)
  if (!hasScopedIdAccess(accessibleOrderIds, orderId)) {
    return {
      status: 403,
      body: { ok: false, error: "无权为该订单排课", issues: [] as SchedulePrecheckIssue[] },
    }
  }

  const { data: order, error: orderError } = await supabaseServer
    .from("formal_orders")
    .select("id, student_id, total_hours, subjects, teacher_names")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    logger.error("订单不存在", { orderId, error_summary: summarizeError(orderError) })
    return {
      status: 404,
      body: { ok: false, error: "订单不存在", issues: [] as SchedulePrecheckIssue[] },
    }
  }

  let studentName: string | null = null
  if (order.student_id) {
    const { data: student, error: studentError } = await supabaseServer
      .from("students")
      .select("student_name")
      .eq("id", order.student_id)
      .single()

    if (studentError || !student) {
      logger.error("订单关联学生不存在", { orderId, studentId: order.student_id, error_summary: summarizeError(studentError) })
      return {
        status: 400,
        body: { ok: false, error: "订单学生不存在或不可用", issues: [] as SchedulePrecheckIssue[] },
      }
    }

    studentName = student.student_name || null
  }

  const { data: existingCourse, error: courseError } = await supabaseServer
    .from("courses")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle()

  if (courseError && courseError.code !== "PGRST116") {
    logger.warn("查询现有课程失败", { orderId, error_summary: summarizeError(courseError) })
  }

  const issues = [
    ...validateRequiredFields(items),
    ...validateItemsAgainstEachOther(items),
    ...validateItemsAgainstOrder(items, studentName, order.teacher_names),
    ...await validateItemsAgainstExistingSessions(items, order.student_id || null, existingCourse?.id || null),
  ]

  return {
    status: 200,
    body: {
      ok: issues.every(issue => issue.type !== "error"),
      total: items.length,
      issues,
    },
  }
}
