import { NextRequest, NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getRequestAccessToken } from "@/lib/server-auth-token"
import { createUserScopedServerClient } from "@/lib/supabase"

const logger = createLogger("API:QualityReports:Export")

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_EXPORT_ROWS = 5000
const EXPORT_QUERY_LIMIT = MAX_EXPORT_ROWS + 1
const VALID_REPORT_TYPES = new Set(["trial_conversion", "service_quality"])
const VALID_STATUSES = new Set(["open", "resolved"])

const QUALITY_REPORT_EXPORT_SELECT = `
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
  created_by_name,
  updated_by_name,
  metadata
`

const REPORT_TYPE_LABELS: Record<string, string> = {
  trial_conversion: "试听转化质检",
  service_quality: "课后服务质检",
}

const SCORE_LEVEL_LABELS: Record<string, string> = {
  excellent: "优秀",
  good: "良好",
  warning: "预警",
  risk: "风险",
}

const STATUS_LABELS: Record<string, string> = {
  open: "待处理",
  resolved: "已处理",
}

function exportError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function normalizedString(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isValidDateParam(value: string | undefined) {
  return !value || DATE_PATTERN.test(value)
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

function formatIssues(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join("；") : ""
}

function formatCheckedItems(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return ""
  const items = (metadata as Record<string, any>).checked_items
  if (!Array.isArray(items)) return ""

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return ""
      const title = typeof item.title === "string" ? item.title : ""
      const passed = Boolean(item.passed)
      const weight = Number(item.weight)
      const weightText = Number.isFinite(weight) ? `${weight}分` : ""
      return title ? `${title}:${passed ? "通过" : "扣分"}${weightText ? `(${weightText})` : ""}` : ""
    })
    .filter(Boolean)
    .join("；")
}

function buildCsvResponse(rows: unknown[][], filename: string, rowCount: number, limited = false) {
  const csv = `\uFEFF${toCsv(rows)}`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Export-Row-Count": String(rowCount),
      "X-Export-Limited": limited ? "true" : "false",
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return exportError("未登录", 401)
    }

    const scopedClient = getScopedClient(request)
    if (!scopedClient) {
      return exportError("未登录", 401)
    }

    const { searchParams } = new URL(request.url)
    const reportType = normalizedString(searchParams.get("report_type"))
    const status = normalizedString(searchParams.get("status"))
    const generatedFrom = normalizedString(searchParams.get("generated_from"))
    const generatedTo = normalizedString(searchParams.get("generated_to"))

    if (reportType && !VALID_REPORT_TYPES.has(reportType)) {
      return exportError("无效的质检报告类型", 400)
    }

    if (status && status !== "all" && !VALID_STATUSES.has(status)) {
      return exportError("无效的质检报告状态", 400)
    }

    if (!isValidDateParam(generatedFrom) || !isValidDateParam(generatedTo)) {
      return exportError("无效的质检报告日期", 400)
    }

    if (generatedFrom && generatedTo && generatedFrom > generatedTo) {
      return exportError("开始日期不能晚于结束日期", 400)
    }

    const fileType = reportType || "all"
    const fromPart = generatedFrom || "all"
    const toPart = generatedTo || "now"
    const filename = `quality-reports-${fileType}-${fromPart}-to-${toPart}.csv`

    let query = scopedClient
      .from("quality_reports")
      .select(QUALITY_REPORT_EXPORT_SELECT)
      .order("generated_at", { ascending: false })
      .limit(EXPORT_QUERY_LIMIT)

    if (reportType) query = query.eq("report_type", reportType)
    if (status && status !== "all") query = query.eq("status", status)
    if (generatedFrom) query = query.gte("generated_at", `${generatedFrom}T00:00:00+08:00`)
    if (generatedTo) query = query.lte("generated_at", `${generatedTo}T23:59:59+08:00`)

    const { data, error } = await query

    if (error) {
      if (isQualityReportStorageUnavailable(error)) {
        logger.warn("质检报告存储未就绪，导出空 CSV", { error_summary: summarizeError(error) })
        return buildCsvResponse([[
          "报告类型",
          "对象类型",
          "对象名称",
          "质检分",
          "评分层级",
          "处理状态",
          "问题摘要",
          "改进建议",
          "评分项明细",
          "生成时间",
          "处理时间",
          "创建人",
          "更新人",
          "对象ID",
          "报告ID",
        ]], filename, 0)
      }

      logger.error("导出质检报告失败", { error_summary: summarizeError(error) })
      return exportError("导出质检报告失败", 500)
    }

    const reports = (data || []).slice(0, MAX_EXPORT_ROWS)
    const limited = (data || []).length > MAX_EXPORT_ROWS
    const rows = [
      [
        "报告类型",
        "对象类型",
        "对象名称",
        "质检分",
        "评分层级",
        "处理状态",
        "问题摘要",
        "改进建议",
        "评分项明细",
        "生成时间",
        "处理时间",
        "创建人",
        "更新人",
        "对象ID",
        "报告ID",
      ],
      ...reports.map((report: any) => [
        REPORT_TYPE_LABELS[report.report_type] || report.report_type,
        report.target_type,
        report.target_label || "",
        report.quality_score ?? "",
        SCORE_LEVEL_LABELS[report.score_level] || report.score_level || "",
        STATUS_LABELS[report.status] || report.status || "",
        formatIssues(report.issues),
        report.improvement_suggestions || "",
        formatCheckedItems(report.metadata),
        formatDateTime(report.generated_at),
        formatDateTime(report.resolved_at),
        report.created_by_name || "",
        report.updated_by_name || "",
        report.target_id,
        report.id,
      ]),
    ]

    return buildCsvResponse(rows, filename, reports.length, limited)
  } catch (error) {
    logger.error("导出质检报告异常", { error_summary: summarizeError(error) })
    return exportError("导出质检报告失败", 500)
  }
}
