"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Search } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { QualityStandardPanel } from "@/components/quality/QualityStandardPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import { buildQualityDraftScore, SERVICE_QUALITY_METRICS } from "@/lib/quality-standards"
import { QualityReportsService, type QualityReport, type QualityReportStats } from "@/lib/services/qualityReports"
import { StudentsService, type Student } from "@/lib/services/students"

const FETCH_LIMIT = 100

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : format(date, "yyyy-MM-dd")
}

function getServiceRisk(student: Student) {
  const summary = student.formal_summary
  const remainingHours = summary?.remaining_formal_hours ?? 0
  const remainingAmount = summary?.remaining_formal_amount ?? 0

  if (remainingHours <= 0 && remainingAmount <= 0) {
    return { label: "待续费/结课", className: "bg-red-100 text-red-800", priority: 0 }
  }
  if (remainingHours <= 4) {
    return { label: "低课时", className: "bg-yellow-100 text-yellow-800", priority: 1 }
  }
  return { label: "正常", className: "bg-green-100 text-green-800", priority: 2 }
}

function getServiceQualityDraft(student: Student) {
  const risk = getServiceRisk(student)
  const summary = student.formal_summary
  const remainingHours = summary?.remaining_formal_hours ?? 0
  const remainingAmount = summary?.remaining_formal_amount ?? 0
  const draftScore = buildQualityDraftScore(SERVICE_QUALITY_METRICS, {
    balance_safe: remainingHours > 4 || remainingAmount > 0,
    balance_known: Boolean(summary?.latest_order_id),
    service_owner_visible: Boolean(student.head_teacher_name || summary?.formal_teachers?.length),
    latest_order_known: Boolean(summary?.latest_order_time),
  })
  const issues = draftScore.issues.length > 0
    ? draftScore.issues
    : ["服务链路基础记录完整，建议抽查课后反馈和课堂消耗一致性"]

  return {
    report_type: "service_quality" as const,
    target_type: "student" as const,
    target_id: student.id,
    target_label: student.student_name,
    quality_score: draftScore.quality_score,
    issues,
    improvement_suggestions: risk.label === "正常"
      ? "保持课后反馈和课消核对节奏，定期抽查家长满意度。"
      : "补齐最近课堂反馈、回访记录和续费沟通计划，明确负责人及下次触达时间。",
    metadata: {
      risk_label: risk.label,
      score_level: draftScore.score_level,
      checked_items: draftScore.checked_items,
      remaining_formal_hours: summary?.remaining_formal_hours ?? 0,
      remaining_formal_amount: summary?.remaining_formal_amount ?? 0,
      latest_order_id: summary?.latest_order_id || null,
      latest_order_time: summary?.latest_order_time || null,
      formal_subjects: summary?.formal_subjects || [],
      formal_teachers: summary?.formal_teachers || [],
    },
  }
}

function buildReportStats(reports: QualityReport[]): QualityReportStats {
  const scoredReports = reports.filter((report) => Number.isFinite(report.quality_score))
  const scoreSum = scoredReports.reduce((sum, report) => sum + report.quality_score, 0)

  return {
    total: reports.length,
    open: reports.filter((report) => report.status === "open").length,
    resolved: reports.filter((report) => report.status === "resolved").length,
    excellent: reports.filter((report) => report.score_level === "excellent").length,
    good: reports.filter((report) => report.score_level === "good").length,
    warning: reports.filter((report) => report.score_level === "warning").length,
    risk: reports.filter((report) => report.score_level === "risk").length,
    risk_open: reports.filter((report) =>
      report.status === "open" && ["warning", "risk"].includes(report.score_level)
    ).length,
    average_score: scoredReports.length > 0 ? Math.round(scoreSum / scoredReports.length) : null,
  }
}

export default function ServiceQualityPage() {
  const { toast } = useToast()
  const { isLoading: isPermissionLoading, students } = usePermission()
  const canView = !isPermissionLoading && students.view()
  const canManageReports = !isPermissionLoading && students.edit()
  const [formalStudents, setFormalStudents] = useState<Student[]>([])
  const [reports, setReports] = useState<QualityReport[]>([])
  const [reportStats, setReportStats] = useState<QualityReportStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [savingReportId, setSavingReportId] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!canView) return

    const loadStudents = async () => {
      try {
        setIsLoading(true)
        const { data } = await StudentsService.getFormalStudents(0, FETCH_LIMIT - 1)
        setFormalStudents(data)
        const reportResult = await QualityReportsService.getQualityReportsResult({
          report_type: "service_quality",
          target_ids: data.map((student) => student.id),
          include_stats: true,
        })
        setReports(reportResult.data)
        setReportStats(reportResult.stats || null)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载课后服务质检数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadStudents()
  }, [canView, toast])

  const reportByTargetId = useMemo(() => {
    return new Map(reports.map((report) => [report.target_id, report]))
  }, [reports])

  const updateReportState = (report: QualityReport) => {
    setReports((current) => [report, ...current.filter((item) => item.id !== report.id)])
    setReportStats(null)
  }

  const handleGenerateReport = async (student: Student) => {
    try {
      setSavingReportId(student.id)
      const report = await QualityReportsService.createQualityReport(getServiceQualityDraft(student))
      updateReportState(report)
      toast({ title: "质检报告已生成", description: `${report.target_label || "该学生"}：${report.quality_score} 分` })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "生成失败",
        description: error.message || "无法生成质检报告",
      })
    } finally {
      setSavingReportId(null)
    }
  }

  const handleResolveReport = async (report: QualityReport) => {
    try {
      setSavingReportId(report.target_id)
      const updated = await QualityReportsService.updateQualityReport({ id: report.id, status: "resolved" })
      updateReportState(updated)
      toast({ title: "已标记处理完成" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新质检报告",
      })
    } finally {
      setSavingReportId(null)
    }
  }

  const handleExportReports = async () => {
    try {
      setIsExporting(true)
      const result = await QualityReportsService.exportQualityReports({ report_type: "service_quality" })
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast({
        title: "导出完成",
        description: result.limited
          ? `已导出前 ${result.rowCount} 条质检报告，更多数据请缩小筛选范围。`
          : `已导出 ${result.rowCount} 条质检报告。`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "导出失败",
        description: error.message || "无法导出质检报告",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return formalStudents
      .filter((student) => {
        if (!keyword) return true
        return [
          student.student_name,
          student.parent_phone,
          student.head_teacher_name,
          ...(student.formal_summary?.formal_subjects || []),
          ...(student.formal_summary?.formal_teachers || []),
        ].some((value) => String(value || "").toLowerCase().includes(keyword))
      })
      .sort((a, b) => getServiceRisk(a).priority - getServiceRisk(b).priority)
  }, [formalStudents, query])

  const stats = {
    total: formalStudents.length,
    urgent: formalStudents.filter((student) => getServiceRisk(student).label === "待续费/结课").length,
    lowHours: formalStudents.filter((student) => getServiceRisk(student).label === "低课时").length,
    healthy: formalStudents.filter((student) => getServiceRisk(student).label === "正常").length,
  }
  const visibleReportStats = reportStats || buildReportStats(reports)

  if (!isPermissionLoading && !canView) {
    return (
      <div className="flex flex-col h-full">
        <Header title="课后服务质检" description="按权限查看正式生服务质量数据" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">无权访问</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="课后服务质检" description="按剩余课时和订单汇总识别续费、结课与服务风险" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">正式生</div><div className="text-2xl font-semibold">{stats.total}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">待续费/结课</div><div className="text-2xl font-semibold text-red-600">{stats.urgent}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">质检报告</div><div className="text-2xl font-semibold">{visibleReportStats.total}</div><div className="text-xs text-muted-foreground">均分 {visibleReportStats.average_score ?? "-"}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">待处理报告</div><div className="text-2xl font-semibold text-yellow-700">{visibleReportStats.open}</div><div className="text-xs text-muted-foreground">已处理 {visibleReportStats.resolved}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">风险报告</div><div className="text-2xl font-semibold text-red-600">{visibleReportStats.risk_open}</div><div className="text-xs text-muted-foreground">预警 {visibleReportStats.warning} / 风险 {visibleReportStats.risk}</div></CardContent></Card>
        </div>

        <QualityStandardPanel title="课后服务质检评分标准" metrics={SERVICE_QUALITY_METRICS} />

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 p-4 border-b">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学生、电话、班主任、科目" className="pl-9" />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleExportReports} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  导出
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>刷新</Button>
              </div>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollableTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>风险</TableHead>
                      <TableHead>报告</TableHead>
                      <TableHead>学生</TableHead>
                      <TableHead>科目</TableHead>
                      <TableHead>老师</TableHead>
                      <TableHead>剩余课时</TableHead>
                      <TableHead>剩余金额</TableHead>
                      <TableHead>最近订单</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">暂无质检数据</TableCell></TableRow>
                    ) : rows.map((student) => {
                      const risk = getServiceRisk(student)
                      const summary = student.formal_summary
                      const report = reportByTargetId.get(student.id)
                      return (
                        <TableRow key={student.id}>
                          <TableCell><Badge className={risk.className}>{risk.label}</Badge></TableCell>
                          <TableCell>
                            {report ? (
                              <Badge variant={report.status === "resolved" ? "secondary" : "outline"}>
                                {report.quality_score}分 · {report.status === "resolved" ? "已处理" : "待处理"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">未生成</span>
                            )}
                          </TableCell>
                          <TableCell>{student.student_name}</TableCell>
                          <TableCell>{summary?.formal_subjects?.join("、") || "-"}</TableCell>
                          <TableCell>{summary?.formal_teachers?.join("、") || student.head_teacher_name || "-"}</TableCell>
                          <TableCell>{summary?.remaining_formal_hours ?? 0}</TableCell>
                          <TableCell>¥{(summary?.remaining_formal_amount ?? 0).toLocaleString()}</TableCell>
                          <TableCell>{formatDate(summary?.latest_order_time)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canManageReports && (
                                report?.status === "open" ? (
                                  <Button variant="outline" size="sm" disabled={savingReportId === student.id} onClick={() => handleResolveReport(report)}>
                                    {savingReportId === student.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}处理
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" disabled={savingReportId === student.id} onClick={() => handleGenerateReport(student)}>
                                    {savingReportId === student.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}生成
                                  </Button>
                                )
                              )}
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/students/${student.id}`}>{risk.priority === 0 ? <AlertTriangle className="h-4 w-4 mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}查看</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollableTable>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
