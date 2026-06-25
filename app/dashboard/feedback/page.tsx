"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { AlertTriangle, CalendarCheck2, CalendarClock, CalendarDays, Edit, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationInfo,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPageSize,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/fetch"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { DictionaryItem, getDictionaryItems } from "@/lib/services/dictionary"

interface VisitRecord {
  id: string
  student_id: string
  student_name?: string | null
  student_code?: string | null
  visit_date: string
  visit_method: string
  parent_attitude?: string | null
  visit_notes: string
  visit_personnel?: string | null
  visit_personnel_name?: string | null
  next_visit_date?: string | null
  created_at: string
  updated_at?: string
}

interface StudentOption {
  id: string
  name: string
  student_name: string
  student_code?: string | null
  head_teacher_name?: string | null
}

interface VisitFormState {
  student_id: string
  visit_date: string
  visit_method: string
  parent_attitude: string
  visit_notes: string
  next_visit_date: string
}

interface VisitStats {
  total: number
  month: string
  month_visits: number
  scheduled_follow_ups: number
  due_today: number
  overdue: number
  upcoming_7_days: number
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const EMPTY_ATTITUDE_VALUE = "__none__"
const PARENT_ATTITUDE_COLORS: Record<string, string> = {
  very_satisfied: "bg-green-100 text-green-800",
  satisfied: "bg-blue-100 text-blue-800",
  neutral: "bg-yellow-100 text-yellow-800",
  dissatisfied: "bg-red-100 text-red-800",
}

function todayString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function currentMonthString() {
  return todayString().slice(0, 7)
}

function getLabelByCode(items: DictionaryItem[], code?: string | null): string {
  if (!code) return "-"
  return items.find((item) => item.code === code)?.label || code
}

function formatDate(value?: string | null, pattern = "yyyy-MM-dd") {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return format(date, pattern)
}

function buildStudentName(record: Pick<VisitRecord, "student_name" | "student_code">) {
  if (!record.student_name) return "未知学生"
  return record.student_code ? `${record.student_name}（${record.student_code}）` : record.student_name
}

function emptyVisitForm(): VisitFormState {
  return {
    student_id: "",
    visit_date: todayString(),
    visit_method: "",
    parent_attitude: "",
    visit_notes: "",
    next_visit_date: "",
  }
}

export default function FeedbackPage() {
  const { toast } = useToast()
  const { role, isLoading: isPermissionLoading, students: studentsPerm } = usePermission()
  const canAccessFeedback = studentsPerm.visit()
  const canEditVisitRecord = studentsPerm.visit()
  const canDeleteVisitRecord = studentsPerm.delete()
  const canManageVisitRecords = canEditVisitRecord || canDeleteVisitRecord
  const [records, setRecords] = useState<VisitRecord[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [visitMethods, setVisitMethods] = useState<DictionaryItem[]>([])
  const [parentAttitudes, setParentAttitudes] = useState<DictionaryItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<VisitRecord | null>(null)
  const [visitToDelete, setVisitToDelete] = useState<VisitRecord | null>(null)
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false)
  const [isDeletingVisit, setIsDeletingVisit] = useState(false)
  const [visitForm, setVisitForm] = useState<VisitFormState>(emptyVisitForm)

  const {
    currentPage,
    pageSize,
    totalPages,
    canGoNext,
    canGoPrevious,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    getPageRange,
  } = usePagination({
    totalCount,
    pageSize: 20,
    onPageChange: (page, size) => fetchVisitRecords(page, size),
  })

  const pageRange = useMemo(() => getPageRange(), [getPageRange])

  async function fetchVisitRecords(page = currentPage, size = pageSize) {
    try {
      setIsLoadingRecords(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        include_stats: "true",
        stats_month: currentMonthString(),
      })
      const response = await api.get(`/api/visit-records?${params.toString()}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "获取回访记录失败" }))
        throw new Error(error.error || "获取回访记录失败")
      }

      const { data, count, stats: nextStats } = await response.json()
      setRecords(data || [])
      setTotalCount(count || 0)
      setStats(nextStats || null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载回访记录",
      })
    } finally {
      setIsLoadingRecords(false)
    }
  }

  async function fetchStudents() {
    try {
      setIsLoadingStudents(true)
      const response = await api.get("/api/students?formal=true&from=0&to=199")

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "获取学生列表失败" }))
        throw new Error(error.error || "获取学生列表失败")
      }

      const { data } = await response.json()
      setStudents((data || []).map((student: any) => ({
        id: student.id,
        student_name: student.student_name,
        student_code: student.student_code,
        head_teacher_name: student.head_teacher_name,
        name: student.student_code
          ? `${student.student_name}（${student.student_code}）`
          : student.student_name,
      })))
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "学生加载失败",
        description: error.message || "无法加载正式生列表",
      })
    } finally {
      setIsLoadingStudents(false)
    }
  }

  async function loadDictionaries() {
    const [methods, attitudes] = await Promise.all([
      getDictionaryItems("visit_method"),
      getDictionaryItems("parent_attitude"),
    ])
    setVisitMethods(methods)
    setParentAttitudes(attitudes)
  }

  useEffect(() => {
    if (isPermissionLoading || !canAccessFeedback) return
    fetchVisitRecords(1, pageSize)
    fetchStudents()
    loadDictionaries()
  }, [isPermissionLoading, canAccessFeedback])

  function openVisitDialog(record?: VisitRecord) {
    if (!canEditVisitRecord) {
      toast({
        variant: "destructive",
        title: "无权操作",
        description: "当前账号没有新增或编辑回访记录的权限",
      })
      return
    }

    setEditingVisit(record || null)
    setVisitForm(record ? {
      student_id: record.student_id,
      visit_date: record.visit_date || todayString(),
      visit_method: record.visit_method || "",
      parent_attitude: record.parent_attitude || "",
      visit_notes: record.visit_notes || "",
      next_visit_date: record.next_visit_date || "",
    } : emptyVisitForm())
    setVisitDialogOpen(true)
  }

  async function handleSubmitVisit() {
    if (!visitForm.student_id) {
      toast({ variant: "destructive", title: "请选择学生" })
      return
    }
    if (!visitForm.visit_date) {
      toast({ variant: "destructive", title: "请选择回访日期" })
      return
    }
    if (!visitForm.visit_method) {
      toast({ variant: "destructive", title: "请选择回访方式" })
      return
    }
    if (!visitForm.visit_notes.trim()) {
      toast({ variant: "destructive", title: "请填写回访备注" })
      return
    }

    try {
      setIsSubmittingVisit(true)
      const payload = {
        student_id: visitForm.student_id,
        visit_date: visitForm.visit_date,
        visit_method: visitForm.visit_method,
        parent_attitude: visitForm.parent_attitude || null,
        visit_notes: visitForm.visit_notes.trim(),
        next_visit_date: visitForm.next_visit_date || null,
      }
      const response = editingVisit
        ? await api.put("/api/visit-records", { id: editingVisit.id, ...payload })
        : await api.post("/api/visit-records", payload)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: editingVisit ? "更新回访记录失败" : "创建回访记录失败" }))
        throw new Error(error.error || (editingVisit ? "更新回访记录失败" : "创建回访记录失败"))
      }

      toast({
        title: editingVisit ? "回访已更新" : "回访已创建",
        description: editingVisit ? "回访记录已保存" : "新的回访记录已入库",
      })
      setVisitDialogOpen(false)
      setEditingVisit(null)
      await fetchVisitRecords(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法保存回访记录",
      })
    } finally {
      setIsSubmittingVisit(false)
    }
  }

  async function handleDeleteVisit() {
    if (!visitToDelete) return

    try {
      setIsDeletingVisit(true)
      const response = await api.delete(`/api/visit-records?id=${encodeURIComponent(visitToDelete.id)}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "删除回访记录失败" }))
        throw new Error(error.error || "删除回访记录失败")
      }

      toast({ title: "回访已删除", description: "回访记录已从列表移除" })
      setVisitToDelete(null)
      await fetchVisitRecords(records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除回访记录",
      })
    } finally {
      setIsDeletingVisit(false)
    }
  }

  if (isPermissionLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="回访管理" description="正在加载权限" />
        <div className="p-6 text-sm text-muted-foreground">正在加载...</div>
      </div>
    )
  }

  if (!canAccessFeedback) {
    return (
      <div className="flex flex-col h-full">
        <Header title="无权访问" description="当前账号无权访问回访管理" />
        <div className="p-6 text-sm text-muted-foreground">
          回访记录请在可访问的正式生详情中查看或维护。
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="回访管理" description="统一查看和维护正式生回访记录" />
      <div className="flex-1 space-y-4 p-6 overflow-auto">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                可见回访
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total ?? totalCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
                本月已回访
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.month_visits ?? 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stats?.month || currentMonthString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                待跟进
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.scheduled_follow_ups ?? 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">今日 {stats?.due_today ?? 0}，7天内 {stats?.upcoming_7_days ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                逾期跟进
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.overdue ?? 0}</div>
              <p className="mt-1 text-xs text-muted-foreground">当前角色：{role || "-"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>回访记录</CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/feedback/students">
                <Button variant="outline" size="sm">
                  正式生管理
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => fetchVisitRecords(currentPage, pageSize)} disabled={isLoadingRecords}>
                <RefreshCw className={isLoadingRecords ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                刷新
              </Button>
              {canEditVisitRecord && (
                <Button size="sm" onClick={() => openVisitDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建回访
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollableTable flex={false} maxHeight={520}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>回访日期</TableHead>
                    <TableHead>学生</TableHead>
                    <TableHead>方式</TableHead>
                    <TableHead>家长态度</TableHead>
                    <TableHead>回访人员</TableHead>
                    <TableHead>下次回访</TableHead>
                    <TableHead>备注</TableHead>
                    {canManageVisitRecords && <TableHead>操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingRecords ? (
                    <TableRow>
                      <TableCell colSpan={canManageVisitRecords ? 8 : 7} className="h-28 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        正在加载回访记录
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManageVisitRecords ? 8 : 7} className="h-28 text-center text-muted-foreground">
                        暂无回访记录
                      </TableCell>
                    </TableRow>
                  ) : records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{formatDate(record.visit_date)}</TableCell>
                      <TableCell>
                        <Link className="font-medium hover:underline" href={`/dashboard/students/${record.student_id}`}>
                          {buildStudentName(record)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getLabelByCode(visitMethods, record.visit_method)}</Badge>
                      </TableCell>
                      <TableCell>
                        {record.parent_attitude ? (
                          <Badge className={PARENT_ATTITUDE_COLORS[record.parent_attitude] || ""}>
                            {getLabelByCode(parentAttitudes, record.parent_attitude)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{record.visit_personnel_name || "未知"}</TableCell>
                      <TableCell>
                        {record.next_visit_date ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            {formatDate(record.next_visit_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-sm truncate" title={record.visit_notes || ""}>
                        {record.visit_notes || "-"}
                      </TableCell>
                      {canManageVisitRecords && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canEditVisitRecord && (
                              <Button variant="outline" size="sm" onClick={() => openVisitDialog(record)}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </Button>
                            )}
                            {canDeleteVisitRecord && (
                              <Button variant="destructive" size="sm" onClick={() => setVisitToDelete(record)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <PaginationInfo currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <PaginationPageSize pageSize={pageSize} onPageSizeChange={handlePageSizeChange} options={PAGE_SIZE_OPTIONS} />
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        aria-disabled={!canGoPrevious}
                        className={!canGoPrevious ? "pointer-events-none opacity-50" : ""}
                        onClick={(event) => {
                          event.preventDefault()
                          if (canGoPrevious) goToPreviousPage()
                        }}
                      />
                    </PaginationItem>
                    {pageRange.map((page, index) => (
                      <PaginationItem key={`${page}-${index}`}>
                        {page === -1 ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href="#"
                            isActive={page === currentPage}
                            onClick={(event) => {
                              event.preventDefault()
                              goToPage(page)
                            }}
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        aria-disabled={!canGoNext}
                        className={!canGoNext ? "pointer-events-none opacity-50" : ""}
                        onClick={(event) => {
                          event.preventDefault()
                          if (canGoNext) goToNextPage()
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={canEditVisitRecord && visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVisit ? "编辑回访记录" : "新建回访记录"}</DialogTitle>
            <DialogDescription>
              {editingVisit ? "更新学生回访内容和下次跟进时间" : "为正式生添加一条新的回访记录"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <SearchableSelect
              id="student_id"
              label="学生"
              required
              placeholder="搜索学生姓名或学号"
              value={visitForm.student_id}
              onChange={(value) => setVisitForm((current) => ({ ...current, student_id: value }))}
              options={students}
              loading={isLoadingStudents}
              displayKey="name"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visit_date">回访日期 *</Label>
                <Input
                  id="visit_date"
                  type="date"
                  value={visitForm.visit_date}
                  onChange={(event) => setVisitForm((current) => ({ ...current, visit_date: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_visit_date">下次回访日期</Label>
                <Input
                  id="next_visit_date"
                  type="date"
                  value={visitForm.next_visit_date}
                  onChange={(event) => setVisitForm((current) => ({ ...current, next_visit_date: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visit_method">回访方式 *</Label>
                <Select
                  value={visitForm.visit_method}
                  onValueChange={(value) => setVisitForm((current) => ({ ...current, visit_method: value }))}
                >
                  <SelectTrigger id="visit_method">
                    <SelectValue placeholder="请选择回访方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {visitMethods.map((method) => (
                      <SelectItem key={method.code} value={method.code}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_attitude">家长态度</Label>
                <Select
                  value={visitForm.parent_attitude || EMPTY_ATTITUDE_VALUE}
                  onValueChange={(value) => setVisitForm((current) => ({
                    ...current,
                    parent_attitude: value === EMPTY_ATTITUDE_VALUE ? "" : value,
                  }))}
                >
                  <SelectTrigger id="parent_attitude">
                    <SelectValue placeholder="请选择家长态度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_ATTITUDE_VALUE}>暂不记录</SelectItem>
                    {parentAttitudes.map((attitude) => (
                      <SelectItem key={attitude.code} value={attitude.code}>
                        {attitude.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit_notes">回访备注 *</Label>
              <Textarea
                id="visit_notes"
                rows={4}
                value={visitForm.visit_notes}
                onChange={(event) => setVisitForm((current) => ({ ...current, visit_notes: event.target.value }))}
                placeholder="记录沟通内容、家长反馈和需要继续跟进的问题"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVisitDialogOpen(false)
                setEditingVisit(null)
              }}
              disabled={isSubmittingVisit}
            >
              取消
            </Button>
            <Button onClick={handleSubmitVisit} disabled={isSubmittingVisit}>
              {isSubmittingVisit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                editingVisit ? "保存回访" : "提交回访"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={canDeleteVisitRecord && Boolean(visitToDelete)} onOpenChange={(open) => !open && setVisitToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除回访记录</DialogTitle>
            <DialogDescription>
              删除后该记录将从学生详情和回访管理中移除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitToDelete(null)} disabled={isDeletingVisit}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteVisit} disabled={isDeletingVisit}>
              {isDeletingVisit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
