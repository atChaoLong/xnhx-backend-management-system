import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, supabaseServer } from "@/lib/supabase"
import { checkPermission } from "@/lib/middleware"
import { ACTIONS, RESOURCES } from "@/lib/permissions"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:TeacherExceptions")

const TEACHER_EXCEPTION_SELECT = `
  id,
  created_at,
  updated_at,
  teacher_code,
  teacher_level,
  status,
  name,
  mobile,
  classin_phone,
  used_classin,
  classin_uid,
  candidate_id,
  subjects,
  grade_levels,
  education,
  university,
  location
`

const TEACHER_EXCEPTION_RECORD_SELECT = `
  id,
  teacher_id,
  issue_code,
  issue_label,
  severity,
  status,
  reason,
  current_suggestion,
  assigned_to,
  resolved_by,
  resolved_at,
  created_by,
  created_by_name,
  updated_by,
  updated_by_name,
  created_at,
  updated_at
`

const TEACHER_EXCEPTION_EVENT_SELECT = `
  id,
  exception_id,
  teacher_id,
  action,
  from_status,
  to_status,
  note,
  actor_id,
  actor_name,
  actor_role,
  created_at
`

type Severity = "high" | "medium" | "low"
type ExceptionStatus = "open" | "in_progress" | "resolved" | "ignored"

interface ExceptionIssue {
  code: string
  label: string
  severity: Severity
  suggestion: string
  record?: TeacherExceptionRecord | null
}

interface TeacherExceptionRecord {
  id: string
  teacher_id: string
  issue_code: string
  issue_label: string
  severity: Severity
  status: ExceptionStatus
  reason: string | null
  current_suggestion: string | null
  assigned_to: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
  events?: TeacherExceptionEvent[]
}

interface TeacherExceptionEvent {
  id: string
  exception_id: string
  teacher_id: string
  action: "created" | "updated" | "status_changed" | "note_added"
  from_status: ExceptionStatus | null
  to_status: ExceptionStatus | null
  note: string | null
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  created_at: string
}

interface TeacherException {
  teacher: {
    id: string
    name: string | null
    teacher_code: string | null
    teacher_level: string | null
    status: string | null
    mobile: string | null
    classin_phone: string | null
    used_classin: boolean | null
    classin_uid: number | null
    candidate_id: string | null
    updated_at: string | null
  }
  severity: Severity
  issues: ExceptionIssue[]
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

function hasListItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function issue(code: string, label: string, severity: Severity, suggestion: string): ExceptionIssue {
  return { code, label, severity, suggestion }
}

function isExceptionStatus(value: unknown): value is ExceptionStatus {
  return ["open", "in_progress", "resolved", "ignored"].includes(String(value))
}

function isSeverity(value: unknown): value is Severity {
  return ["high", "medium", "low"].includes(String(value))
}

function buildRecordKey(teacherId: string, issueCode: string) {
  return `${teacherId}:${issueCode}`
}

function sanitizeText(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

async function getTeacherExceptionRecords(teacherIds: string[]): Promise<Map<string, TeacherExceptionRecord>> {
  if (teacherIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from("teacher_exceptions")
    .select(TEACHER_EXCEPTION_RECORD_SELECT)
    .in("teacher_id", teacherIds)

  if (error) {
    logger.warn("获取老师异常处理记录失败", { error_summary: summarizeError(error) })
    return new Map()
  }

  const records = (data || []) as TeacherExceptionRecord[]
  const recordIds = records.map((record) => record.id)
  const eventsByRecordId = new Map<string, TeacherExceptionEvent[]>()

  if (recordIds.length > 0) {
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("teacher_exception_events")
      .select(TEACHER_EXCEPTION_EVENT_SELECT)
      .in("exception_id", recordIds)
      .order("created_at", { ascending: false })
      .limit(500)

    if (eventsError) {
      logger.warn("获取老师异常处理事件失败", { error_summary: summarizeError(eventsError) })
    } else {
      for (const event of (events || []) as TeacherExceptionEvent[]) {
        const existing = eventsByRecordId.get(event.exception_id) || []
        if (existing.length < 5) {
          existing.push(event)
          eventsByRecordId.set(event.exception_id, existing)
        }
      }
    }
  }

  return records.reduce((acc, record) => {
    acc.set(buildRecordKey(record.teacher_id, record.issue_code), {
      ...record,
      events: eventsByRecordId.get(record.id) || [],
    })
    return acc
  }, new Map<string, TeacherExceptionRecord>())
}

function maxSeverity(issues: ExceptionIssue[]): Severity {
  if (issues.some((item) => item.severity === "high")) return "high"
  if (issues.some((item) => item.severity === "medium")) return "medium"
  return "low"
}

function buildTeacherException(teacher: any): TeacherException | null {
  const issues: ExceptionIssue[] = []

  if (!hasText(teacher.name)) {
    issues.push(issue("missing_name", "缺少老师姓名", "high", "补齐姓名后再进入排课和对外介绍流程"))
  }

  if (!hasText(teacher.teacher_code)) {
    issues.push(issue("missing_teacher_code", "缺少老师编号", "high", "重新保存或补录老师编号，避免后续对账和排课无法定位"))
  }

  if (!hasText(teacher.classin_phone) && !hasText(teacher.mobile)) {
    issues.push(issue("missing_contact_phone", "缺少手机号/ClassIn 手机", "high", "补齐手机号或 ClassIn 手机，确保后续账号绑定和上课通知可用"))
  }

  if (teacher.used_classin === true && !teacher.classin_uid) {
    issues.push(issue("missing_classin_uid", "已启用 ClassIn 但未绑定 UID", "high", "执行 ClassIn 绑定或核对试听确认时的账号创建结果"))
  }

  if (!hasText(teacher.teacher_level)) {
    issues.push(issue("missing_teacher_level", "缺少老师等级", "medium", "补齐老师等级，便于销售匹配和课酬规则判断"))
  }

  if (!hasText(teacher.status)) {
    issues.push(issue("missing_status", "缺少老师状态", "medium", "设置正常、满课、暂停排课或停用状态"))
  }

  if (!hasListItems(teacher.subjects)) {
    issues.push(issue("missing_subjects", "缺少授课科目", "medium", "补齐授课科目，避免老师库筛选和匹配失效"))
  }

  if (!hasListItems(teacher.grade_levels)) {
    issues.push(issue("missing_grade_levels", "缺少授课年级", "medium", "补齐授课年级范围，避免分配试听时误匹配"))
  }

  if (!hasText(teacher.education) || !hasText(teacher.university)) {
    issues.push(issue("missing_education", "学历/学校资料不完整", "low", "补齐展示资料，提升销售介绍时的信息完整度"))
  }

  if (!hasText(teacher.location)) {
    issues.push(issue("missing_location", "缺少所在地", "low", "补齐所在地，便于时区、地域和家长沟通偏好判断"))
  }

  if (issues.length === 0) return null

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      teacher_code: teacher.teacher_code,
      teacher_level: teacher.teacher_level,
      status: teacher.status,
      mobile: teacher.mobile,
      classin_phone: teacher.classin_phone,
      used_classin: teacher.used_classin,
      classin_uid: teacher.classin_uid,
      candidate_id: teacher.candidate_id,
      updated_at: teacher.updated_at,
    },
    severity: maxSeverity(issues),
    issues,
  }
}

export async function GET(request: NextRequest) {
  return checkPermission(request, RESOURCES.teachers, ACTIONS.view, async () => {
    const profile = await getProfileFromHeaders(request)

    if (!profile || !["admin", "academic_affairs"].includes(profile.role)) {
      return NextResponse.json(
        { error: "仅管理员和教务可查看新入库异常" },
        { status: 403 },
      )
    }

    try {
      const { data, error } = await supabaseServer
        .from("teachers")
        .select(TEACHER_EXCEPTION_SELECT)
        .order("updated_at", { ascending: false })
        .limit(300)

      if (error) {
        logger.error("获取老师异常队列失败", { error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: "获取新入库异常失败" },
          { status: 400 },
        )
      }

      const exceptions = (data || [])
        .map(buildTeacherException)
        .filter((item): item is TeacherException => Boolean(item))

      const recordMap = await getTeacherExceptionRecords(
        exceptions.map((item) => item.teacher.id),
      )

      const exceptionsWithRecords = exceptions.map((item) => ({
        ...item,
        issues: item.issues.map((issue) => ({
          ...issue,
          record: recordMap.get(buildRecordKey(item.teacher.id, issue.code)) || null,
        })),
      }))

      const summary = exceptionsWithRecords.reduce(
        (acc, item) => {
          acc.total += 1
          acc[item.severity] += 1
          return acc
        },
        { total: 0, high: 0, medium: 0, low: 0 },
      )

      return NextResponse.json({
        data: exceptionsWithRecords,
        summary,
      })
    } catch (error) {
      logger.error("获取老师异常队列异常", { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: "获取新入库异常失败" },
        { status: 500 },
      )
    }
  })
}

export async function POST(request: NextRequest) {
  return checkPermission(request, RESOURCES.teachers, ACTIONS.view, async () => {
    const profile = await getProfileFromHeaders(request)

    if (!profile || !["admin", "academic_affairs"].includes(profile.role)) {
      return NextResponse.json(
        { error: "仅管理员和教务可处理新入库异常" },
        { status: 403 },
      )
    }

    try {
      const body = await request.json()
      const teacherId = sanitizeText(body.teacher_id, 80)
      const issueCode = sanitizeText(body.issue_code, 120)
      const issueLabel = sanitizeText(body.issue_label, 200)
      const currentSuggestion = sanitizeText(body.current_suggestion, 1000)
      const reason = sanitizeText(body.reason, 2000)
      const note = sanitizeText(body.note, 2000)
      const status = isExceptionStatus(body.status) ? body.status : "in_progress"
      const severity = isSeverity(body.severity) ? body.severity : "medium"

      if (!teacherId || !issueCode || !issueLabel) {
        return NextResponse.json(
          { error: "缺少老师或异常项信息" },
          { status: 400 },
        )
      }

      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("id", teacherId)
        .maybeSingle()

      if (teacherError) {
        logger.error("校验老师异常记录归属失败", { teacherId, error_summary: summarizeError(teacherError) })
        return NextResponse.json(
          { error: "校验老师失败" },
          { status: 400 },
        )
      }

      if (!teacher) {
        return NextResponse.json(
          { error: "老师不存在" },
          { status: 404 },
        )
      }

      const { data: existingRecord, error: existingError } = await supabaseAdmin
        .from("teacher_exceptions")
        .select(TEACHER_EXCEPTION_RECORD_SELECT)
        .eq("teacher_id", teacherId)
        .eq("issue_code", issueCode)
        .maybeSingle()

      if (existingError) {
        logger.error("查询老师异常处理记录失败", { teacherId, issueCode, error_summary: summarizeError(existingError) })
        return NextResponse.json(
          { error: "查询异常处理记录失败" },
          { status: 400 },
        )
      }

      const now = new Date().toISOString()
      const resolvedFields = status === "resolved"
        ? { resolved_by: profile.id, resolved_at: now }
        : { resolved_by: null, resolved_at: null }
      const payload = {
        teacher_id: teacherId,
        issue_code: issueCode,
        issue_label: issueLabel,
        severity,
        status,
        reason,
        current_suggestion: currentSuggestion,
        issue_snapshot: {
          code: issueCode,
          label: issueLabel,
          severity,
          suggestion: currentSuggestion,
        },
        updated_by: profile.id,
        updated_by_name: profile.name,
        updated_at: now,
        ...resolvedFields,
      }

      const action = existingRecord
        ? existingRecord.status !== status
          ? "status_changed"
          : note
            ? "note_added"
            : "updated"
        : "created"

      const { data: record, error: saveError } = existingRecord
        ? await supabaseAdmin
            .from("teacher_exceptions")
            .update(payload)
            .eq("id", existingRecord.id)
            .select(TEACHER_EXCEPTION_RECORD_SELECT)
            .single()
        : await supabaseAdmin
            .from("teacher_exceptions")
            .insert({
              ...payload,
              created_by: profile.id,
              created_by_name: profile.name,
            })
            .select(TEACHER_EXCEPTION_RECORD_SELECT)
            .single()

      if (saveError || !record) {
        logger.error("保存老师异常处理记录失败", { teacherId, issueCode, error_summary: summarizeError(saveError) })
        return NextResponse.json(
          { error: "保存异常处理记录失败" },
          { status: 400 },
        )
      }

      const eventNote = note || reason || null
      const { error: eventError } = await supabaseAdmin
        .from("teacher_exception_events")
        .insert({
          exception_id: record.id,
          teacher_id: teacherId,
          action,
          from_status: existingRecord?.status || null,
          to_status: status,
          note: eventNote,
          actor_id: profile.id,
          actor_name: profile.name,
          actor_role: profile.role,
        })

      if (eventError) {
        logger.warn("保存老师异常处理事件失败", { recordId: record.id, error_summary: summarizeError(eventError) })
      }

      return NextResponse.json({ data: record }, { status: existingRecord ? 200 : 201 })
    } catch (error) {
      logger.error("保存老师异常处理记录异常", { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: "保存异常处理记录失败" },
        { status: 500 },
      )
    }
  })
}
