import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, restrictByIds } from "@/lib/server-business-scope"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:ClassSessions:Export")

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_EXPORT_ROWS = 5000
const EXPORT_QUERY_LIMIT = MAX_EXPORT_ROWS + 1
const VALID_STATUS_FILTERS = new Set(["scheduled", "completed", "cancelled", "missed", "no-show"])
const CLASS_SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: "未开始",
  completed: "已完成",
  cancelled: "已取消",
  missed: "缺课",
  "no-show": "未到课",
}

function isValidDateParam(value: string | null): value is string {
  return Boolean(value && DATE_PATTERN.test(value))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().replace("T", " ").slice(0, 19)
}

function sanitizeCsvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const raw = Array.isArray(value) ? value.join("、") : String(value)
  const safe = /^[=+\-@\t\r]/.test(raw.trimStart()) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\n")
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const status = searchParams.get("status")

    if (!isValidDateParam(startDate) || !isValidDateParam(endDate)) {
      return NextResponse.json(
        { error: "start_date 和 end_date 必须是 YYYY-MM-DD 格式" },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "开始日期不能晚于结束日期" },
        { status: 400 }
      )
    }

    if (status && !VALID_STATUS_FILTERS.has(status)) {
      return NextResponse.json(
        { error: "课节状态筛选值无效" },
        { status: 400 }
      )
    }

    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    let query = supabaseServer
      .from("class_sessions")
      .select(`
        id,
        course_id,
        classroom_id,
        session_number,
        session_name,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        scheduled_duration_minutes,
        actual_start_time,
        actual_end_time,
        actual_duration_minutes,
        status,
        teacher_name,
        student_attendance_status,
        notes
      `)
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time_start", { ascending: true })
      .limit(EXPORT_QUERY_LIMIT)

    query = restrictByIds(query, "course_id", accessibleCourseIds)

    if (status) {
      query = query.eq("status", status)
    }

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      logger.error("导出课节失败", { error_summary: summarizeError(sessionsError) })
      return NextResponse.json({ error: "导出课节失败" }, { status: 500 })
    }

    const exportSessions = (sessions || []).slice(0, MAX_EXPORT_ROWS)
    const limited = (sessions || []).length > MAX_EXPORT_ROWS
    const courseIds = Array.from(new Set(exportSessions.map((session: any) => session.course_id).filter(Boolean)))
    const courseMap = new Map<string, any>()

    if (courseIds.length > 0) {
      const { data: courses, error: coursesError } = await supabaseServer
        .from("courses")
        .select(`
          id,
          course_name,
          subject,
          grade,
          teacher_name,
          student:student_id(id, student_name),
          formal_orders(id, order_number)
        `)
        .in("id", courseIds)

      if (coursesError) {
        logger.error("导出课节时查询课程失败", { error_summary: summarizeError(coursesError) })
        return NextResponse.json({ error: "查询课程信息失败" }, { status: 500 })
      }

      ;(courses || []).forEach((course: any) => {
        courseMap.set(course.id, course)
      })
    }

    const headers = [
      "上课日期",
      "开始时间",
      "结束时间",
      "计划时长(分钟)",
      "实际开始时间",
      "实际结束时间",
      "实际时长(分钟)",
      "课程名称",
      "订单号",
      "学生",
      "学科",
      "年级",
      "老师",
      "课节序号",
      "课节名称",
      "课节状态",
      "学生出勤",
      "ClassIn课堂ID",
      "备注",
    ]

    const rows = exportSessions.map((session: any) => {
      const course = courseMap.get(session.course_id) || {}
      const student = Array.isArray(course.student) ? course.student[0] : course.student
      const formalOrder = Array.isArray(course.formal_orders) ? course.formal_orders[0] : course.formal_orders

      return [
        session.scheduled_date,
        session.scheduled_time_start,
        session.scheduled_time_end,
        session.scheduled_duration_minutes,
        formatDateTime(session.actual_start_time),
        formatDateTime(session.actual_end_time),
        session.actual_duration_minutes,
        course.course_name,
        formalOrder?.order_number,
        student?.student_name,
        course.subject,
        course.grade,
        session.teacher_name || course.teacher_name,
        session.session_number,
        session.session_name,
        CLASS_SESSION_STATUS_LABELS[session.status] || session.status,
        session.student_attendance_status,
        session.classroom_id,
        session.notes,
      ]
    })

    const csv = `\uFEFF${toCsv([headers, ...rows])}`
    const filename = `class-sessions-${startDate}-to-${endDate}.csv`

    logger.info("导出课节成功", {
      profileId: profile?.id,
      startDate,
      endDate,
      count: rows.length,
      limited,
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Export-Row-Count": String(rows.length),
        "X-Export-Limited": limited ? "true" : "false",
      },
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "导出课节失败")
    logger.error("导出课节异常", safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}
