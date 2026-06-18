"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { AlertTriangle, ClipboardCheck, Edit, Eye, Loader2, RefreshCw, Search } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/fetch"

type Severity = "high" | "medium" | "low"
type ExceptionStatus = "open" | "in_progress" | "resolved" | "ignored"

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

interface TeacherExceptionIssue {
  code: string
  label: string
  severity: Severity
  suggestion: string
  record?: TeacherExceptionRecord | null
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
  issues: TeacherExceptionIssue[]
}

interface ExceptionSummary {
  total: number
  high: number
  medium: number
  low: number
}

const severityCopy: Record<Severity, { label: string; className: string; badge: "destructive" | "secondary" | "outline" }> = {
  high: {
    label: "高风险",
    className: "text-red-700 bg-red-50 border-red-200",
    badge: "destructive",
  },
  medium: {
    label: "中风险",
    className: "text-amber-700 bg-amber-50 border-amber-200",
    badge: "secondary",
  },
  low: {
    label: "低风险",
    className: "text-slate-700 bg-slate-50 border-slate-200",
    badge: "outline",
  },
}

const statusCopy: Record<ExceptionStatus, { label: string; className: string }> = {
  open: { label: "待处理", className: "border-red-200 bg-red-50 text-red-700" },
  in_progress: { label: "处理中", className: "border-blue-200 bg-blue-50 text-blue-700" },
  resolved: { label: "已解决", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ignored: { label: "已忽略", className: "border-slate-200 bg-slate-50 text-slate-700" },
}

function formatDate(value?: string | null) {
  return value ? format(new Date(value), "yyyy-MM-dd HH:mm") : "-"
}

function primarySuggestion(item: TeacherException) {
  const highIssue = item.issues.find((issue) => issue.severity === "high")
  return (highIssue || item.issues[0])?.suggestion || "打开老师资料补齐异常信息"
}

function primaryIssue(item: TeacherException) {
  return item.issues.find((issue) => issue.severity === "high") || item.issues[0]
}

function primaryRecord(item: TeacherException) {
  return primaryIssue(item)?.record || null
}

function formatEventAction(event: TeacherExceptionEvent) {
  if (event.action === "created") return "创建记录"
  if (event.action === "status_changed") return "更新状态"
  if (event.action === "note_added") return "补充备注"
  return "更新记录"
}

export default function TeacherExceptionsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<TeacherException[]>([])
  const [summary, setSummary] = useState<ExceptionSummary>({ total: 0, high: 0, medium: 0, low: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRecord, setIsSavingRecord] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all")
  const [recordDialogItem, setRecordDialogItem] = useState<TeacherException | null>(null)
  const [recordIssueCode, setRecordIssueCode] = useState("")
  const [recordStatus, setRecordStatus] = useState<ExceptionStatus>("in_progress")
  const [recordReason, setRecordReason] = useState("")
  const [recordNote, setRecordNote] = useState("")

  const fetchExceptions = async () => {
    try {
      setIsLoading(true)
      const response = await api.get("/api/teachers/exceptions")

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "获取新入库异常失败" }))
        throw new Error(error.error || "获取新入库异常失败")
      }

      const result = await response.json()
      setItems(result.data || [])
      setSummary(result.summary || { total: 0, high: 0, medium: 0, low: 0 })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载新入库异常",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchExceptions()
  }, [])

  const openRecordDialog = (item: TeacherException) => {
    const issue = primaryIssue(item)
    const record = issue?.record

    setRecordDialogItem(item)
    setRecordIssueCode(issue?.code || "")
    setRecordStatus(record?.status || "in_progress")
    setRecordReason(record?.reason || "")
    setRecordNote("")
  }

  const selectedRecordIssue = useMemo(() => {
    if (!recordDialogItem) return null
    return recordDialogItem.issues.find((issue) => issue.code === recordIssueCode) || primaryIssue(recordDialogItem)
  }, [recordDialogItem, recordIssueCode])

  const selectedRecord = selectedRecordIssue?.record || null

  useEffect(() => {
    if (!selectedRecordIssue) return

    setRecordStatus(selectedRecordIssue.record?.status || "in_progress")
    setRecordReason(selectedRecordIssue.record?.reason || "")
    setRecordNote("")
  }, [selectedRecordIssue?.code])

  const handleSaveRecord = async () => {
    if (!recordDialogItem || !selectedRecordIssue) return

    try {
      setIsSavingRecord(true)
      const response = await api.post("/api/teachers/exceptions", {
        teacher_id: recordDialogItem.teacher.id,
        issue_code: selectedRecordIssue.code,
        issue_label: selectedRecordIssue.label,
        severity: selectedRecordIssue.severity,
        current_suggestion: selectedRecordIssue.suggestion,
        status: recordStatus,
        reason: recordReason,
        note: recordNote,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "保存异常处理记录失败" }))
        throw new Error(error.error || "保存异常处理记录失败")
      }

      toast({
        title: "已保存处理记录",
        description: `${recordDialogItem.teacher.name || "未命名老师"}的异常处理进度已更新`,
      })
      setRecordDialogItem(null)
      await fetchExceptions()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法保存异常处理记录",
      })
    } finally {
      setIsSavingRecord(false)
    }
  }

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSeverity = severityFilter === "all" || item.severity === severityFilter
      const matchesKeyword = !normalizedKeyword || [
        item.teacher.name,
        item.teacher.teacher_code,
        item.teacher.mobile,
        item.teacher.classin_phone,
        item.teacher.classin_uid,
        ...item.issues.map((issue) => issue.label),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword))

      return matchesSeverity && matchesKeyword
    })
  }, [items, keyword, severityFilter])

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="新入库异常" description="自动识别老师入库后的关键资料缺口" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header title="新入库异常" description="自动识别老师入库后的关键资料缺口" />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="flex h-full flex-col">
          <CardContent className="flex flex-1 flex-col overflow-hidden p-6">
            <div className="mb-6 grid flex-shrink-0 gap-3 md:grid-cols-4">
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">异常老师</div>
                <div className="mt-2 text-2xl font-semibold">{summary.total}</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <div className="text-sm text-red-700">高风险</div>
                <div className="mt-2 text-2xl font-semibold text-red-700">{summary.high}</div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm text-amber-700">中风险</div>
                <div className="mt-2 text-2xl font-semibold text-amber-700">{summary.medium}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-700">低风险</div>
                <div className="mt-2 text-2xl font-semibold text-slate-700">{summary.low}</div>
              </div>
            </div>

            <div className="mb-4 flex flex-shrink-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold">异常队列</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  当前显示 {filteredItems.length} 条，按更新时间倒序排列
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索老师、编号、异常项"
                    className="h-9 w-full pl-9 sm:w-64"
                  />
                </div>
                <select
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value as Severity | "all")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">全部风险</option>
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </select>
                <Button variant="outline" onClick={fetchExceptions} disabled={isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
              </div>
            </div>

            <ScrollableTable className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">老师</TableHead>
                    <TableHead className="min-w-24">风险</TableHead>
                    <TableHead className="min-w-72">异常项</TableHead>
                    <TableHead className="min-w-80">建议处理</TableHead>
                    <TableHead className="min-w-40">ClassIn/手机</TableHead>
                    <TableHead className="min-w-40">更新时间</TableHead>
                    <TableHead className="min-w-32 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                        当前没有符合条件的新入库异常
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.teacher.id}>
                        <TableCell>
                          <div className="font-medium">{item.teacher.name || "未命名老师"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{item.teacher.teacher_code || "无编号"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={severityCopy[item.severity].badge} className={severityCopy[item.severity].className}>
                            <AlertTriangle className="h-3 w-3" />
                            {severityCopy[item.severity].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[520px] flex-wrap gap-1.5">
                            {item.issues.map((issue) => (
                              <div key={issue.code} className="flex items-center gap-1">
                                <Badge variant="outline" className="whitespace-normal text-left leading-5">
                                  {issue.label}
                                </Badge>
                                {issue.record ? (
                                  <Badge variant="outline" className={statusCopy[issue.record.status].className}>
                                    {statusCopy[issue.record.status].label}
                                  </Badge>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[420px] text-sm text-muted-foreground">
                          <div>{primarySuggestion(item)}</div>
                          {primaryRecord(item)?.reason ? (
                            <div className="mt-2 rounded-md border bg-muted/30 px-2 py-1 text-xs text-foreground">
                              {primaryRecord(item)?.reason}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{item.teacher.classin_phone || item.teacher.mobile || "-"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">UID：{item.teacher.classin_uid || "-"}</div>
                        </TableCell>
                        <TableCell>{formatDate(item.teacher.updated_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="记录处理"
                              onClick={() => openRecordDialog(item)}
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                            <Link href={`/dashboard/teachers/${item.teacher.id}`}>
                              <Button variant="outline" size="sm" aria-label="查看老师详情">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/teachers/${item.teacher.id}/edit`}>
                              <Button size="sm" aria-label="处理异常">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollableTable>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(recordDialogItem)} onOpenChange={(open) => !open && setRecordDialogItem(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>记录异常处理</DialogTitle>
            <DialogDescription>
              {recordDialogItem?.teacher.name || "未命名老师"} · {recordDialogItem?.teacher.teacher_code || "无编号"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="issue_code">异常项</Label>
              <select
                id="issue_code"
                value={recordIssueCode}
                onChange={(event) => setRecordIssueCode(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {recordDialogItem?.issues.map((issue) => (
                  <option key={issue.code} value={issue.code}>
                    {issue.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedRecordIssue ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{selectedRecordIssue.suggestion}</div>
                {selectedRecord ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    最近更新：{formatDate(selectedRecord.updated_at)}
                    {selectedRecord.updated_by_name ? ` · ${selectedRecord.updated_by_name}` : ""}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="exception_status">处理状态</Label>
                <select
                  id="exception_status"
                  value={recordStatus}
                  onChange={(event) => setRecordStatus(event.target.value as ExceptionStatus)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="open">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="ignored">已忽略</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>最近流水</Label>
                <div className="min-h-10 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {selectedRecord?.events?.[0] ? (
                    <>
                      {formatEventAction(selectedRecord.events[0])} · {formatDate(selectedRecord.events[0].created_at)}
                    </>
                  ) : (
                    "暂无处理流水"
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exception_reason">异常原因/处理说明</Label>
              <Textarea
                id="exception_reason"
                value={recordReason}
                onChange={(event) => setRecordReason(event.target.value)}
                rows={4}
                placeholder="例如：老师已提交资料，待教务核对 ClassIn UID"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exception_note">本次备注</Label>
              <Textarea
                id="exception_note"
                value={recordNote}
                onChange={(event) => setRecordNote(event.target.value)}
                rows={3}
                placeholder="记录这次跟进动作，可留空"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogItem(null)} disabled={isSavingRecord}>
              取消
            </Button>
            <Button onClick={handleSaveRecord} disabled={isSavingRecord || !selectedRecordIssue}>
              {isSavingRecord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
