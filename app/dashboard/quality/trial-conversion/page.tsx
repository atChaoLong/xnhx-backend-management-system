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
import { buildQualityDraftScore, TRIAL_CONVERSION_QUALITY_METRICS } from "@/lib/quality-standards"
import { QualityReportsService, type QualityReport, type QualityReportStats } from "@/lib/services/qualityReports"
import { TrialLessonsService, type TrialLesson } from "@/lib/services/trialLessons"

const FETCH_LIMIT = 100

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : format(date, "yyyy-MM-dd HH:mm")
}

function getRisk(lesson: TrialLesson) {
  if (lesson.is_converted || lesson.is_converted_calculated || lesson.lesson_status === "converted") {
    return { label: "已转化", className: "bg-green-100 text-green-800", priority: 3 }
  }
  if (lesson.status === "cancelled" || lesson.lesson_status === "cancelled") {
    return { label: "已取消", className: "bg-gray-100 text-gray-800", priority: 2 }
  }
  if (lesson.status === "completed" || lesson.lesson_status === "completed") {
    return { label: "待复盘", className: "bg-red-100 text-red-800", priority: 0 }
  }
  return { label: "跟进中", className: "bg-yellow-100 text-yellow-800", priority: 1 }
}

function getQualityDraft(lesson: TrialLesson) {
  const risk = getRisk(lesson)
  const draftScore = buildQualityDraftScore(TRIAL_CONVERSION_QUALITY_METRICS, {
    trial_result_closed: risk.label !== "待复盘",
    teacher_confirmed: Boolean(lesson.confirmed_teacher || lesson.matched_teacher),
    schedule_recorded: Boolean(lesson.trial_time),
    follow_up_action: risk.label !== "待复盘",
  })
  const issues = draftScore.issues.length > 0
    ? draftScore.issues
    : ["试听链路基础记录完整，建议复核转化动作和家长反馈质量"]

  return {
    report_type: "trial_conversion" as const,
    target_type: "trial_lesson" as const,
    target_id: lesson.id,
    target_label: lesson.child_name || lesson.phone || "试听记录",
    quality_score: draftScore.quality_score,
    issues,
    improvement_suggestions: risk.label === "已转化"
      ? "核对支付、正式生建档和首课安排是否完整，沉淀有效转化动作。"
      : "补齐沟通记录、老师反馈和家长异议处理，明确下一次跟进责任人与截止时间。",
    metadata: {
      risk_label: risk.label,
      score_level: draftScore.score_level,
      checked_items: draftScore.checked_items,
      lesson_status: lesson.lesson_status || lesson.status || null,
      trial_subject: lesson.trial_subject || null,
      trial_time: lesson.trial_time || null,
      teacher: lesson.confirmed_teacher || lesson.matched_teacher || null,
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

export default function TrialConversionQualityPage() {
  const { toast } = useToast()
  const { isLoading: isPermissionLoading, trialLessons, students } = usePermission()
  const canView = !isPermissionLoading && trialLessons.view()
  const canManageReports = !isPermissionLoading && students.edit()
  const [lessons, setLessons] = useState<TrialLesson[]>([])
  const [reports, setReports] = useState<QualityReport[]>([])
  const [reportStats, setReportStats] = useState<QualityReportStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [savingReportId, setSavingReportId] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!canView) return

    const loadLessons = async () => {
      try {
        setIsLoading(true)
        const { data } = await TrialLessonsService.getTrialLessons(0, FETCH_LIMIT - 1)
        setLessons(data)
        const reportResult = await QualityReportsService.getQualityReportsResult({
          report_type: "trial_conversion",
          target_ids: data.map((lesson) => lesson.id),
          include_stats: true,
        })
        setReports(reportResult.data)
        setReportStats(reportResult.stats || null)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载试听转化质检数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadLessons()
  }, [canView, toast])

  const reportByTargetId = useMemo(() => {
    return new Map(reports.map((report) => [report.target_id, report]))
  }, [reports])

  const updateReportState = (report: QualityReport) => {
    setReports((current) => [report, ...current.filter((item) => item.id !== report.id)])
    setReportStats(null)
  }

  const handleGenerateReport = async (lesson: TrialLesson) => {
    try {
      setSavingReportId(lesson.id)
      const report = await QualityReportsService.createQualityReport(getQualityDraft(lesson))
      updateReportState(report)
      toast({ title: "质检报告已生成", description: `${report.target_label || "该记录"}：${report.quality_score} 分` })
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
      const result = await QualityReportsService.exportQualityReports({ report_type: "trial_conversion" })
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
    return lessons
      .filter((lesson) => {
        if (!keyword) return true
        return [
          lesson.child_name,
          lesson.phone,
          lesson.trial_subject,
          lesson.matched_teacher,
          lesson.confirmed_teacher,
          lesson.lesson_status_name,
        ].some((value) => String(value || "").toLowerCase().includes(keyword))
      })
      .sort((a, b) => getRisk(a).priority - getRisk(b).priority)
  }, [lessons, query])

  const stats = {
    total: lessons.length,
    review: lessons.filter((lesson) => getRisk(lesson).label === "待复盘").length,
    converted: lessons.filter((lesson) => getRisk(lesson).label === "已转化").length,
    following: lessons.filter((lesson) => getRisk(lesson).label === "跟进中").length,
  }
  const visibleReportStats = reportStats || buildReportStats(reports)

  if (!isPermissionLoading && !canView) {
    return (
      <div className="flex flex-col h-full">
        <Header title="试听转化质检" description="按权限查看试听转化复盘数据" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">无权访问</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="试听转化质检" description="按试听状态识别待复盘、跟进中和已转化记录" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">样本数</div><div className="text-2xl font-semibold">{stats.total}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">待复盘</div><div className="text-2xl font-semibold text-red-600">{stats.review}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">质检报告</div><div className="text-2xl font-semibold">{visibleReportStats.total}</div><div className="text-xs text-muted-foreground">均分 {visibleReportStats.average_score ?? "-"}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">待处理报告</div><div className="text-2xl font-semibold text-yellow-700">{visibleReportStats.open}</div><div className="text-xs text-muted-foreground">已处理 {visibleReportStats.resolved}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">风险报告</div><div className="text-2xl font-semibold text-red-600">{visibleReportStats.risk_open}</div><div className="text-xs text-muted-foreground">预警 {visibleReportStats.warning} / 风险 {visibleReportStats.risk}</div></CardContent></Card>
        </div>

        <QualityStandardPanel title="试听转化质检评分标准" metrics={TRIAL_CONVERSION_QUALITY_METRICS} />

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 p-4 border-b">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学生、电话、科目、老师" className="pl-9" />
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
                        <TableHead>试听时间</TableHead>
                      <TableHead>老师</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无质检数据</TableCell></TableRow>
                    ) : rows.map((lesson) => {
                      const risk = getRisk(lesson)
                      const report = reportByTargetId.get(lesson.id)
                      return (
                        <TableRow key={lesson.id}>
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
                          <TableCell>{lesson.child_name}</TableCell>
                          <TableCell>{lesson.trial_subject || "-"}</TableCell>
                          <TableCell>{formatDate(lesson.trial_time)}</TableCell>
                          <TableCell>{lesson.confirmed_teacher || lesson.matched_teacher || "-"}</TableCell>
                          <TableCell>{lesson.lesson_status_name || lesson.status || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canManageReports && (
                                report?.status === "open" ? (
                                  <Button variant="outline" size="sm" disabled={savingReportId === lesson.id} onClick={() => handleResolveReport(report)}>
                                    {savingReportId === lesson.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}处理
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" disabled={savingReportId === lesson.id} onClick={() => handleGenerateReport(lesson)}>
                                    {savingReportId === lesson.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}生成
                                  </Button>
                                )
                              )}
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/trial-lessons/${lesson.id}`}>{risk.priority === 0 ? <AlertTriangle className="h-4 w-4 mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}查看</Link>
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
