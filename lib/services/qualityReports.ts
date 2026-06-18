import { api } from "@/lib/fetch"

export type QualityReportType = "trial_conversion" | "service_quality"
export type QualityReportTargetType = "trial_lesson" | "student"
export type QualityReportStatus = "open" | "resolved"
export type QualityReportLevel = "excellent" | "good" | "warning" | "risk"

export interface QualityReport {
  id: string
  report_type: QualityReportType
  target_type: QualityReportTargetType
  target_id: string
  target_label: string | null
  quality_score: number
  score_level: QualityReportLevel
  issues: string[]
  improvement_suggestions: string | null
  status: QualityReportStatus
  generated_at: string
  resolved_at: string | null
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface QualityReportPayload {
  report_type: QualityReportType
  target_type: QualityReportTargetType
  target_id: string
  target_label?: string | null
  quality_score: number
  issues: string[]
  improvement_suggestions?: string | null
  metadata?: Record<string, any>
}

export interface QualityReportStats {
  total: number
  open: number
  resolved: number
  excellent: number
  good: number
  warning: number
  risk: number
  risk_open: number
  average_score: number | null
}

export interface QualityReportsResult {
  data: QualityReport[]
  count: number
  from: number
  to: number
  stats?: QualityReportStats
}

export interface QualityReportExportResult {
  blob: Blob
  filename: string
  rowCount: number
  limited: boolean
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  return search.toString()
}

async function parseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({ error: fallback }))
  return new Error(payload.error || fallback)
}

function parseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") || ""
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
  return filenameMatch?.[1] || fallback
}

export async function getQualityReports(params: {
  report_type: QualityReportType
  target_ids?: string[]
  status?: QualityReportStatus
  generated_from?: string
  generated_to?: string
}): Promise<QualityReport[]> {
  const result = await getQualityReportsResult(params)
  return result.data
}

export async function getQualityReportsResult(params: {
  report_type: QualityReportType
  target_ids?: string[]
  status?: QualityReportStatus
  generated_from?: string
  generated_to?: string
  include_stats?: boolean
}): Promise<QualityReportsResult> {
  const query = buildQuery({
    report_type: params.report_type,
    target_ids: params.target_ids?.filter(Boolean).join(","),
    status: params.status,
    generated_from: params.generated_from,
    generated_to: params.generated_to,
    include_stats: params.include_stats ? "true" : undefined,
  })
  const response = await api.get(`/api/quality-reports?${query}`)

  if (!response.ok) {
    throw await parseError(response, "获取质检报告失败")
  }

  const result = await response.json()
  return {
    data: (result.data || []) as QualityReport[],
    count: Number(result.count || 0),
    from: Number(result.from || 0),
    to: Number(result.to || 0),
    stats: result.stats as QualityReportStats | undefined,
  }
}

export async function createQualityReport(payload: QualityReportPayload): Promise<QualityReport> {
  const response = await api.post("/api/quality-reports", payload)

  if (!response.ok) {
    throw await parseError(response, "生成质检报告失败")
  }

  const result = await response.json()
  return result.data as QualityReport
}

export async function updateQualityReport(payload: {
  id: string
  status?: QualityReportStatus
  quality_score?: number
  issues?: string[]
  improvement_suggestions?: string | null
  metadata?: Record<string, any>
}): Promise<QualityReport> {
  const response = await api.put("/api/quality-reports", payload)

  if (!response.ok) {
    throw await parseError(response, "更新质检报告失败")
  }

  const result = await response.json()
  return result.data as QualityReport
}

export async function exportQualityReports(params: {
  report_type?: QualityReportType
  status?: QualityReportStatus | "all"
  generated_from?: string
  generated_to?: string
}): Promise<QualityReportExportResult> {
  const query = buildQuery({
    report_type: params.report_type,
    status: params.status,
    generated_from: params.generated_from,
    generated_to: params.generated_to,
  })
  const response = await api.get(`/api/quality-reports/export?${query}`)

  if (!response.ok) {
    throw await parseError(response, "导出质检报告失败")
  }

  return {
    blob: await response.blob(),
    filename: parseFilename(response, "quality-reports.csv"),
    rowCount: Number(response.headers.get("X-Export-Row-Count") || 0),
    limited: response.headers.get("X-Export-Limited") === "true",
  }
}

export const QualityReportsService = {
  getQualityReports,
  getQualityReportsResult,
  createQualityReport,
  updateQualityReport,
  exportQualityReports,
}
