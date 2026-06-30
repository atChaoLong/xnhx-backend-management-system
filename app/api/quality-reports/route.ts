import { NextRequest, NextResponse } from "next/server"
import { createUserScopedServerClient } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getRequestAccessToken } from "@/lib/server-auth-token"

const logger = createLogger("API:QualityReports")

const QUALITY_REPORT_SELECT = `
  id,
  report_type,
  target_type,
  target_id,
  target_label,
  quality_score,
  score_level,
  issues,
  improvement_suggestions,
  status,
  generated_at,
  resolved_at,
  created_by,
  created_by_name,
  updated_by,
  updated_by_name,
  metadata,
  created_at,
  updated_at
`

const QUALITY_REPORT_STATS_SELECT = `
  id,
  status,
  score_level,
  quality_score
`

const VALID_REPORT_TYPES = ["trial_conversion", "service_quality"]
const VALID_TARGET_TYPES = ["trial_lesson", "student"]
const VALID_STATUSES = ["open", "resolved"]
const VALID_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type QualityReportFilters = {
  reportType?: string
  targetId?: string
  targetIds?: string[]
  status?: string
  generatedFrom?: string
  generatedTo?: string
}

function qualityReportError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseRange(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function getScopedClient(request: NextRequest) {
  const token = getRequestAccessToken(request)
  return token ? createUserScopedServerClient(token) : null
}

function isQualityReportStorageUnavailable(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string; hint?: string }
  const code = String(err?.code || "").toUpperCase()
  const text = [err?.message, err?.details, err?.hint].filter(Boolean).join(" ").toLowerCase()

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    (text.includes("quality_reports") && (
      text.includes("does not exist") ||
      text.includes("could not find") ||
      text.includes("schema cache")
    ))
  )
}

function emptyQualityReportStats() {
  return {
    total: 0,
    open: 0,
    resolved: 0,
    excellent: 0,
    good: 0,
    warning: 0,
    risk: 0,
    risk_open: 0,
    average_score: null,
  }
}

function getScoreLevel(score: number) {
  if (score >= 90) return "excellent"
  if (score >= 75) return "good"
  if (score >= 60) return "warning"
  return "risk"
}

function applyQualityReportFilters(query: any, filters: QualityReportFilters) {
  let nextQuery = query
  if (filters.reportType) nextQuery = nextQuery.eq("report_type", filters.reportType)
  if (filters.targetId) nextQuery = nextQuery.eq("target_id", filters.targetId)
  if (filters.targetIds && filters.targetIds.length > 0) nextQuery = nextQuery.in("target_id", filters.targetIds)
  if (filters.status) nextQuery = nextQuery.eq("status", filters.status)
  if (filters.generatedFrom) nextQuery = nextQuery.gte("generated_at", `${filters.generatedFrom}T00:00:00+08:00`)
  if (filters.generatedTo) nextQuery = nextQuery.lte("generated_at", `${filters.generatedTo}T23:59:59+08:00`)
  return nextQuery
}

async function buildQualityReportStats(scopedClient: any, filters: QualityReportFilters) {
  const { data, error, count } = await applyQualityReportFilters(
    scopedClient
      .from("quality_reports")
      .select(QUALITY_REPORT_STATS_SELECT, { count: "exact" }),
    filters
  ).range(0, 9999)

  if (error) {
    if (isQualityReportStorageUnavailable(error)) {
      return emptyQualityReportStats()
    }
    throw error
  }

  const rows = data || []
  const scoredRows = rows.filter((report: any) => Number.isFinite(Number(report.quality_score)))
  const scoreSum = scoredRows.reduce((sum: number, report: any) => sum + Number(report.quality_score), 0)

  return {
    total: count ?? rows.length,
    open: rows.filter((report: any) => report.status === "open").length,
    resolved: rows.filter((report: any) => report.status === "resolved").length,
    excellent: rows.filter((report: any) => report.score_level === "excellent").length,
    good: rows.filter((report: any) => report.score_level === "good").length,
    warning: rows.filter((report: any) => report.score_level === "warning").length,
    risk: rows.filter((report: any) => report.score_level === "risk").length,
    risk_open: rows.filter((report: any) =>
      report.status === "open" && ["warning", "risk"].includes(report.score_level)
    ).length,
    average_score: scoredRows.length > 0 ? Math.round(scoreSum / scoredRows.length) : null,
  }
}

function normalizeIssues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 20)
}

function normalizeMetadata(value: unknown): Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

export async function GET(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return qualityReportError("未登录", 401)
    }

    const scopedClient = getScopedClient(request)
    if (!scopedClient) {
      return qualityReportError("未登录", 401)
    }

    const { searchParams } = new URL(request.url)
    const reportType = normalizedString(searchParams.get("report_type"))
    const targetId = normalizedString(searchParams.get("target_id"))
    const targetIds = normalizedString(searchParams.get("target_ids"))
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 200)
    const status = normalizedString(searchParams.get("status"))
    const generatedFrom = normalizedString(searchParams.get("generated_from"))
    const generatedTo = normalizedString(searchParams.get("generated_to"))
    const includeStats = searchParams.get("include_stats") === "true"
    const from = parseRange(searchParams.get("from"), 0)
    const requestedTo = parseRange(searchParams.get("to"), 99)
    const to = Math.min(Math.max(requestedTo, from), from + 199)

    if (reportType && !VALID_REPORT_TYPES.includes(reportType)) {
      return qualityReportError("无效的质检报告类型", 400)
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return qualityReportError("无效的质检报告状态", 400)
    }

    if ((generatedFrom && !VALID_DATE_PATTERN.test(generatedFrom)) || (generatedTo && !VALID_DATE_PATTERN.test(generatedTo))) {
      return qualityReportError("无效的质检报告日期", 400)
    }

    const filters: QualityReportFilters = {
      reportType,
      targetId,
      targetIds,
      status,
      generatedFrom,
      generatedTo,
    }

    const { data, error, count } = await applyQualityReportFilters(
      scopedClient
        .from("quality_reports")
        .select(QUALITY_REPORT_SELECT, { count: "exact" }),
      filters
    )
      .order("generated_at", { ascending: false })
      .range(from, to)

    if (error) {
      if (isQualityReportStorageUnavailable(error)) {
        logger.warn("质检报告存储未就绪，返回空列表", { error_summary: summarizeError(error) })
        return NextResponse.json({
          data: [],
          count: 0,
          from,
          to,
          ...(includeStats ? { stats: emptyQualityReportStats() } : {}),
        })
      }

      logger.error("获取质检报告失败", { error_summary: summarizeError(error) })
      return qualityReportError("获取质检报告失败", 500)
    }

    if (!includeStats) {
      return NextResponse.json({ data: data || [], count: count ?? data?.length ?? 0, from, to })
    }

    const stats = await buildQualityReportStats(scopedClient, filters)
    return NextResponse.json({ data: data || [], count: count ?? data?.length ?? 0, from, to, stats })
  } catch (error) {
    logger.error("获取质检报告异常", { error_summary: summarizeError(error) })
    return qualityReportError("获取质检报告失败", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return qualityReportError("未登录", 401)
    }

    const scopedClient = getScopedClient(request)
    if (!scopedClient) {
      return qualityReportError("未登录", 401)
    }

    const body = await request.json()
    const reportType = normalizedString(body.report_type)
    const targetType = normalizedString(body.target_type)
    const targetId = normalizedString(body.target_id)
    const qualityScore = Number(body.quality_score)
    const issues = normalizeIssues(body.issues)

    if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
      return qualityReportError("无效的质检报告类型", 400)
    }

    if (!targetType || !VALID_TARGET_TYPES.includes(targetType)) {
      return qualityReportError("无效的质检对象类型", 400)
    }

    if (!targetId || !Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 100) {
      return qualityReportError("缺少必填字段或评分无效", 400)
    }

    const commonPayload = {
      target_label: normalizedString(body.target_label) || null,
      quality_score: Math.round(qualityScore),
      score_level: getScoreLevel(Math.round(qualityScore)),
      issues,
      improvement_suggestions: normalizedString(body.improvement_suggestions) || null,
      metadata: normalizeMetadata(body.metadata),
      updated_by: profile.id,
      updated_by_name: profile.name || null,
    }

    const { data: existing, error: existingError } = await scopedClient
      .from("quality_reports")
      .select(QUALITY_REPORT_SELECT)
      .eq("report_type", reportType)
      .eq("target_id", targetId)
      .eq("status", "open")
      .maybeSingle()

    if (existingError) {
      logger.error("查询已有质检报告失败", { error_summary: summarizeError(existingError) })
      return qualityReportError("生成质检报告失败", 500)
    }

    if (existing) {
      const { data, error } = await scopedClient
        .from("quality_reports")
        .update(commonPayload)
        .eq("id", existing.id)
        .select(QUALITY_REPORT_SELECT)
        .single()

      if (error) {
        logger.error("更新质检报告失败", { error_summary: summarizeError(error), id: existing.id })
        return qualityReportError("生成质检报告失败", 500)
      }

      return NextResponse.json({ data })
    }

    const { data, error } = await scopedClient
      .from("quality_reports")
      .insert({
        report_type: reportType,
        target_type: targetType,
        target_id: targetId,
        created_by: profile.id,
        created_by_name: profile.name || null,
        ...commonPayload,
      })
      .select(QUALITY_REPORT_SELECT)
      .single()

    if (error) {
      logger.error("创建质检报告失败", { error_summary: summarizeError(error) })
      return qualityReportError("生成质检报告失败", 500)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    logger.error("生成质检报告异常", { error_summary: summarizeError(error) })
    return qualityReportError("生成质检报告失败", 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return qualityReportError("未登录", 401)
    }

    const scopedClient = getScopedClient(request)
    if (!scopedClient) {
      return qualityReportError("未登录", 401)
    }

    const body = await request.json()
    const id = normalizedString(body.id)
    if (!id) {
      return qualityReportError("缺少质检报告ID", 400)
    }

    const payload: Record<string, any> = {
      updated_by: profile.id,
      updated_by_name: profile.name || null,
    }

    const status = normalizedString(body.status)
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return qualityReportError("无效的质检报告状态", 400)
      }
      payload.status = status
      payload.resolved_at = status === "resolved" ? new Date().toISOString() : null
    }

    if (body.quality_score !== undefined) {
      const qualityScore = Number(body.quality_score)
      if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 100) {
        return qualityReportError("评分无效", 400)
      }
      payload.quality_score = Math.round(qualityScore)
      payload.score_level = getScoreLevel(Math.round(qualityScore))
    }

    if (body.issues !== undefined) {
      payload.issues = normalizeIssues(body.issues)
    }

    if (body.improvement_suggestions !== undefined) {
      payload.improvement_suggestions = normalizedString(body.improvement_suggestions) || null
    }

    if (body.metadata !== undefined) {
      payload.metadata = normalizeMetadata(body.metadata)
    }

    const { data, error } = await scopedClient
      .from("quality_reports")
      .update(payload)
      .eq("id", id)
      .select(QUALITY_REPORT_SELECT)
      .single()

    if (error) {
      logger.error("更新质检报告失败", { id, error_summary: summarizeError(error) })
      return qualityReportError("更新质检报告失败", 500)
    }

    return NextResponse.json({ data })
  } catch (error) {
    logger.error("更新质检报告异常", { error_summary: summarizeError(error) })
    return qualityReportError("更新质检报告失败", 500)
  }
}
