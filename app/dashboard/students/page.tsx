"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationPageSize,
  PaginationInfo,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Loader2, AlertTriangle, UserCheck, MoreHorizontal, DollarSign, Search, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { StudentsService, Student } from "@/lib/services/students"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { getStudentStatusLabel, getStudentStatusBadgeClass } from "@/lib/utils"
import { api } from "@/lib/fetch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { summarizeError } from "@/lib/safe-error"

// 班主任类型
interface HeadTeacher {
  id: string
  name: string
  role: string
}

interface ClassInEntryFormState {
  studentCode: string
  initialPassword: string
}

type FormalRiskFilter = "all" | "low_hours" | "no_head_teacher" | "no_course" | "inactive"

interface FormalStudentRisk {
  key: Exclude<FormalRiskFilter, "all">
  label: string
  className: string
}

const FORMAL_RISK_FILTERS: Array<{ value: FormalRiskFilter; label: string }> = [
  { value: "all", label: "全部预警" },
  { value: "low_hours", label: "课时预警" },
  { value: "no_head_teacher", label: "未分配班主任" },
  { value: "no_course", label: "缺少授课信息" },
  { value: "inactive", label: "非在读状态" },
]

const formatHours = (value?: number | null) => `${(value ?? 0).toFixed(1)} 小时`

const formatCurrency = (value?: number | null) => `¥${Math.max(0, value ?? 0).toFixed(2)}`

const getFormalStudentRisks = (student: Student): FormalStudentRisk[] => {
  const summary = student.formal_summary
  const remainingHours = summary?.remaining_formal_hours ?? 0
  const totalHours = summary?.total_formal_hours ?? 0
  const subjects = summary?.formal_subjects ?? []
  const teachers = summary?.formal_teachers ?? []
  const risks: FormalStudentRisk[] = []

  if (!student.head_teacher_id) {
    risks.push({
      key: "no_head_teacher",
      label: "未分配班主任",
      className: "bg-amber-100 text-amber-800",
    })
  }

  if (totalHours > 0 && remainingHours <= 3) {
    risks.push({
      key: "low_hours",
      label: "课时预警",
      className: "bg-red-100 text-red-800",
    })
  }

  if (subjects.length === 0 || teachers.length === 0) {
    risks.push({
      key: "no_course",
      label: "授课信息缺失",
      className: "bg-slate-100 text-slate-700",
    })
  }

  if (student.status && !["active", "studying"].includes(student.status)) {
    risks.push({
      key: "inactive",
      label: getStudentStatusLabel(student.status),
      className: "bg-purple-100 text-purple-800",
    })
  }

  return risks
}

export default function StudentsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const teacherId = searchParams.get('teacher_id')
  const teacherName = searchParams.get('teacher_name')
  const { user } = useCurrentUser()
  const isFormalStudentsPage = pathname.includes('/dashboard/formal-students')
  const isAcademicStudentsPage = pathname.includes('/dashboard/academic/students')
  const isFormalStudentView = isFormalStudentsPage || isAcademicStudentsPage
  const pageTitle = teacherId ? `${teacherName || '老师'}的学员` : isAcademicStudentsPage ? "学生库（教务版）" : isFormalStudentView ? "正式生管理" : "学生管理"
  const pageDescription = teacherId ? `查看该老师所带的所有学生` : isAcademicStudentsPage ? "按教务口径查看正式生订单、课时、退费与回访入口" : isFormalStudentView ? "集中查看正式生订单、剩余课时、退费与回访入口" : "管理和查看所有学生信息"
  const canCreateStudent = !isFormalStudentView && (user?.role === 'admin' || user?.role === 'academic_affairs')
  const canAssignHeadTeacher = user?.role === 'admin' || user?.role === 'academic_affairs'
  const canEditStudent = !isFormalStudentView && (user?.role === 'admin' || user?.role === 'academic_affairs')
  const canDeleteStudent = user?.role === 'admin'
  const canUpdateStatus = user?.role === 'admin' || user?.role === 'academic_affairs' || user?.role === 'head_teacher'
  const canViewClassInSecrets = user?.role === 'admin' || user?.role === 'academic_affairs'
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null)
  const [studentToAssign, setStudentToAssign] = useState<Student | null>(null)
  const [headTeachers, setHeadTeachers] = useState<HeadTeacher[]>([])
  const [selectedHeadTeacher, setSelectedHeadTeacher] = useState<string>("")
  const [isLoadingHeadTeachers, setIsLoadingHeadTeachers] = useState(false)

  // 状态更新相关
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [studentToUpdateStatus, setStudentToUpdateStatus] = useState<Student | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [statusReason, setStatusReason] = useState<string>("")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [classInEntryDialogOpen, setClassInEntryDialogOpen] = useState(false)
  const [studentToConfirmEntry, setStudentToConfirmEntry] = useState<Student | null>(null)
  const [classInEntryForm, setClassInEntryForm] = useState<ClassInEntryFormState>({
    studentCode: "",
    initialPassword: "",
  })
  const [isConfirmingEntry, setIsConfirmingEntry] = useState(false)
  const [formalSearch, setFormalSearch] = useState("")
  const [formalRiskFilter, setFormalRiskFilter] = useState<FormalRiskFilter>("all")
  const [formalSubjectFilter, setFormalSubjectFilter] = useState("all")

  const { toast } = useToast()

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

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
    onPageChange: (page, size) => fetchStudents(page, size),
  })


  // 加载学生列表（根据用户角色自动过滤）
  const fetchStudents = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1

      // 根据用户角色构建 URL
      let url = `/api/students?from=${from}&to=${to}`
      if (isFormalStudentView) {
        url += '&formal=true&include_summary=true'
      }
      // 如果是班主任，只获取自己管理的学生
      if (user?.role === 'head_teacher') {
        url += `&head_teacher_id=${user.id}`
      }
      // 如果指定了老师ID，按老师筛选（用于查看某老师的学员）
      if (teacherId) {
        url += `&teacher_id=${teacherId}`
      }

      const response = await api.get(url)

      if (!response.ok) {
        throw new Error('获取学生列表失败')
      }

      const { data, count } = await response.json()
      setStudents(data || [])
      setTotalCount(count || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载学生列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 加载班主任列表
  const fetchHeadTeachers = async () => {
    try {
      setIsLoadingHeadTeachers(true)
      const response = await api.get('/api/users?role=head_teacher')
      if (!response.ok) {
        throw new Error('获取班主任列表失败')
      }
      const { data } = await response.json()
      setHeadTeachers(data || [])
    } catch (error: any) {
      console.error('获取班主任列表失败:', summarizeError(error))
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载班主任列表",
      })
    } finally {
      setIsLoadingHeadTeachers(false)
    }
  }


  useEffect(() => {
    fetchStudents(1, pageSize)
  }, [teacherId, isFormalStudentView])

  // 删除学生
  const handleDeleteClick = (id: string) => {
    if (!canDeleteStudent) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "当前角色无权删除学生",
      })
      return
    }

    setStudentToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return
    if (!canDeleteStudent) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "当前角色无权删除学生",
      })
      setDeleteDialogOpen(false)
      setStudentToDelete(null)
      return
    }

    try {
      setIsDeleting(studentToDelete)
      await StudentsService.deleteStudent(studentToDelete)
      toast({
        title: "删除成功",
        description: "学生已删除",
      })
      fetchStudents(currentPage, pageSize)
      setDeleteDialogOpen(false)
      setStudentToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除学生",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setStudentToDelete(null)
  }

  // 分配班主任
  const openAssignDialog = async (student: Student) => {
    setStudentToAssign(student)
    setSelectedHeadTeacher(student.head_teacher_id || "")
    setAssignDialogOpen(true)
    // 加载班主任列表
    await fetchHeadTeachers()
  }

  const handleAssignHeadTeacher = async () => {
    if (!studentToAssign || !selectedHeadTeacher) {
      toast({
        variant: "destructive",
        title: "请选择班主任",
        description: "请从下拉列表中选择一个班主任",
      })
      return
    }

    try {
      setIsAssigning(studentToAssign.id)
      const response = await api.post('/api/students/assign-head-teacher', {
        studentId: studentToAssign.id,
        headTeacherId: selectedHeadTeacher,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '分配班主任失败' }))
        throw new Error(error.error || '分配班主任失败')
      }

      const selectedTeacher = headTeachers.find(t => t.id === selectedHeadTeacher)

      toast({
        title: "分配成功",
        description: `已将学生分配给班主任：${selectedTeacher?.name || '未知'}`,
      })

      fetchStudents(currentPage, pageSize)
      setAssignDialogOpen(false)
      setStudentToAssign(null)
      setSelectedHeadTeacher("")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "分配失败",
        description: error.message || "无法分配班主任",
      })
    } finally {
      setIsAssigning(null)
    }
  }

  const handleAssignCancel = () => {
    setAssignDialogOpen(false)
    setStudentToAssign(null)
    setSelectedHeadTeacher("")
  }

  // 更新学生状态
  const openStatusDialog = (student: Student) => {
    setStudentToUpdateStatus(student)
    setSelectedStatus(student.status || 'studying')
    setStatusReason('')
    setStatusDialogOpen(true)
  }

  const handleStatusUpdate = async () => {
    if (!studentToUpdateStatus || !selectedStatus) return

    try {
      setIsUpdatingStatus(true)
      const response = await api.put('/api/students/update-status', {
        studentId: studentToUpdateStatus.id,
        status: selectedStatus,
        reason: statusReason,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '更新失败' }))
        throw new Error(error.error || '更新失败')
      }

      toast({
        title: '状态更新成功',
        description: `学生 ${studentToUpdateStatus.student_name} 的状态已更新为 ${getStudentStatusLabel(selectedStatus)}`,
      })

      setStatusDialogOpen(false)
      setStudentToUpdateStatus(null)
      setSelectedStatus('')
      setStatusReason('')
      fetchStudents(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error.message,
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleStatusCancel = () => {
    setStatusDialogOpen(false)
    setStudentToUpdateStatus(null)
    setSelectedStatus('')
    setStatusReason('')
  }

  const openClassInEntryDialog = (student: Student) => {
    if (!student.parent_phone) {
      toast({
        variant: "destructive",
        title: "无法入库",
        description: "该学生没有填写手机号（家长电话）",
      })
      return
    }

    setStudentToConfirmEntry(student)
    setClassInEntryForm({
      studentCode: student.student_code || "",
      initialPassword: "",
    })
    setClassInEntryDialogOpen(true)
  }

  const resetClassInEntryDialog = () => {
    setClassInEntryDialogOpen(false)
    setStudentToConfirmEntry(null)
    setClassInEntryForm({
      studentCode: "",
      initialPassword: "",
    })
  }

  const closeClassInEntryDialog = () => {
    if (isConfirmingEntry) return
    resetClassInEntryDialog()
  }

  const handleConfirmEntry = async () => {
    if (!studentToConfirmEntry) return

    const studentCode = classInEntryForm.studentCode.trim()
    const initialPassword = classInEntryForm.initialPassword.trim()

    if (!studentCode) {
      toast({
        variant: "destructive",
        title: "请输入学生编号",
        description: "学生编号用于写入本地学生档案",
      })
      return
    }

    if (!initialPassword) {
      toast({
        variant: "destructive",
        title: "请输入 ClassIn 初始密码",
        description: "初始密码只会随本次入库请求提交",
      })
      return
    }

    try {
      setIsConfirmingEntry(true)
      const resp = await api.post("/api/student-entries/confirm", {
        student_name: studentToConfirmEntry.student_name,
        student_code: studentCode,
        parent_phone: studentToConfirmEntry.parent_phone,
        initial_password: initialPassword,
        status: studentToConfirmEntry.status || "active",
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "学生入库失败" }))
        throw new Error(err.error || "学生入库失败")
      }
      toast({
        title: "入库成功",
        description: `学生 ${studentToConfirmEntry.student_name} 已注册 ClassIn`,
      })
      resetClassInEntryDialog()
      fetchStudents(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "入库失败",
        description: error.message || "无法入库该学生",
      })
    } finally {
      setIsConfirmingEntry(false)
    }
  }

  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>()
    students.forEach((student) => {
      student.formal_summary?.formal_subjects?.forEach((subject) => {
        if (subject) subjects.add(subject)
      })
    })
    return Array.from(subjects).sort((a, b) => a.localeCompare(b, "zh-CN"))
  }, [students])

  const formalViewStats = useMemo(() => {
    const base = {
      currentPageCount: students.length,
      lowHoursCount: 0,
      unassignedCount: 0,
      remainingHours: 0,
      remainingAmount: 0,
      subjectCount: subjectOptions.length,
    }

    students.forEach((student) => {
      const summary = student.formal_summary
      const risks = getFormalStudentRisks(student)
      if (risks.some((risk) => risk.key === "low_hours")) base.lowHoursCount += 1
      if (risks.some((risk) => risk.key === "no_head_teacher")) base.unassignedCount += 1
      base.remainingHours += summary?.remaining_formal_hours ?? 0
      base.remainingAmount += summary?.remaining_formal_amount ?? 0
    })

    return base
  }, [students, subjectOptions.length])

  const displayedStudents = useMemo(() => {
    if (!isFormalStudentView) return students

    const keyword = formalSearch.trim().toLowerCase()
    return students.filter((student) => {
      const summary = student.formal_summary
      const risks = getFormalStudentRisks(student)
      const matchesKeyword = !keyword || [
        student.student_name,
        student.student_code,
        student.parent_phone,
        student.head_teacher_name,
        ...(summary?.formal_subjects ?? []),
        ...(summary?.formal_teachers ?? []),
      ].some((value) => String(value ?? "").toLowerCase().includes(keyword))
      const matchesRisk = formalRiskFilter === "all" || risks.some((risk) => risk.key === formalRiskFilter)
      const matchesSubject = formalSubjectFilter === "all" || summary?.formal_subjects?.includes(formalSubjectFilter)

      return matchesKeyword && matchesRisk && matchesSubject
    })
  }, [formalRiskFilter, formalSearch, formalSubjectFilter, isFormalStudentView, students])


  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title={pageTitle}
          description={pageDescription}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={pageTitle}
        description={pageDescription}
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">{isFormalStudentView ? "正式生列表" : "学生列表"}</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchStudents(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
                {canCreateStudent && (
                  <Link href="/dashboard/students/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      新增学生
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {isFormalStudentView && (
              <div className="mb-6 space-y-4 flex-shrink-0">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border px-4 py-3">
                    <div className="text-xs text-muted-foreground">当前页正式生</div>
                    <div className="mt-1 text-2xl font-semibold">{formalViewStats.currentPageCount}</div>
                    <div className="mt-1 text-xs text-muted-foreground">筛选后 {displayedStudents.length} 人</div>
                  </div>
                  <div className="rounded-md border px-4 py-3">
                    <div className="text-xs text-muted-foreground">课时预警</div>
                    <div className="mt-1 text-2xl font-semibold text-red-700">{formalViewStats.lowHoursCount}</div>
                    <div className="mt-1 text-xs text-muted-foreground">剩余课时不超过 3 小时</div>
                  </div>
                  <div className="rounded-md border px-4 py-3">
                    <div className="text-xs text-muted-foreground">未分配班主任</div>
                    <div className="mt-1 text-2xl font-semibold text-amber-700">{formalViewStats.unassignedCount}</div>
                    <div className="mt-1 text-xs text-muted-foreground">需要教务补归属</div>
                  </div>
                  <div className="rounded-md border px-4 py-3">
                    <div className="text-xs text-muted-foreground">剩余课时 / 金额</div>
                    <div className="mt-1 text-xl font-semibold">{formatHours(formalViewStats.remainingHours)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatCurrency(formalViewStats.remainingAmount)} · {formalViewStats.subjectCount} 个科目</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative min-w-0 flex-1 lg:max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={formalSearch}
                      onChange={(event) => setFormalSearch(event.target.value)}
                      placeholder="搜索学生、手机号、班主任、科目或老师"
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Select value={formalRiskFilter} onValueChange={(value) => setFormalRiskFilter(value as FormalRiskFilter)}>
                      <SelectTrigger className="w-full sm:w-[170px]">
                        <SelectValue placeholder="预警筛选" />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAL_RISK_FILTERS.map((filter) => (
                          <SelectItem key={filter.value} value={filter.value}>
                            {filter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={formalSubjectFilter} onValueChange={setFormalSubjectFilter}>
                      <SelectTrigger className="w-full sm:w-[170px]">
                        <SelectValue placeholder="科目筛选" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部科目</SelectItem>
                        {subjectOptions.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => fetchStudents(currentPage, pageSize)} disabled={isLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      刷新数据
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[180px] min-w-[180px]">学生姓名</TableHead>
                    <TableHead className="sticky left-[180px] z-30 bg-background w-[140px] min-w-[140px]">学生编号</TableHead>
                    <TableHead>手机号</TableHead>
                    {!isFormalStudentView && canViewClassInSecrets && <TableHead>ClassIn初始密码</TableHead>}
                    {!isFormalStudentView && canViewClassInSecrets && <TableHead>ClassIn UID</TableHead>}
                    <TableHead>班主任</TableHead>
                    <TableHead>状态</TableHead>
                    {isFormalStudentView && <TableHead>教务预警</TableHead>}
                    {isFormalStudentView && <TableHead>科目</TableHead>}
                    {isFormalStudentView && <TableHead>老师</TableHead>}
                    {isFormalStudentView && <TableHead>订单数</TableHead>}
                    {isFormalStudentView && <TableHead>总课时</TableHead>}
                    {isFormalStudentView && <TableHead>剩余课时</TableHead>}
                    {isFormalStudentView && <TableHead>剩余金额</TableHead>}
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {displayedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isFormalStudentView ? 13 : canViewClassInSecrets ? 8 : 6} className="text-center py-8 text-muted-foreground">
                        {isFormalStudentView && students.length > 0 ? "当前筛选条件下暂无正式生" : isFormalStudentView ? "暂无正式生" : "暂无数据"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedStudents.map((student) => {
                      const formalRisks = getFormalStudentRisks(student)

                      return (
                      <TableRow key={student.id}>
                        <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[180px] min-w-[180px]">
                          <Link href={`/dashboard/students/${student.id}`} className="hover:underline font-medium text-primary">
                            {student.student_name || "-"}
                          </Link>
                        </TableCell>
                        <TableCell className="sticky left-[180px] z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                          {student.student_code || "-"}
                        </TableCell>
                        <TableCell>{student.parent_phone || "-"}</TableCell>
                        {!isFormalStudentView && canViewClassInSecrets && <TableCell>{student.classin_initial_password || "-"}</TableCell>}
                        {!isFormalStudentView && canViewClassInSecrets && <TableCell>{student.classin_uid ?? "-"}</TableCell>}
                        <TableCell>
                          {student.head_teacher_name ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {student.head_teacher_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">未分配</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStudentStatusBadgeClass(student.status)}`}>
                            {getStudentStatusLabel(student.status)}
                          </span>
                        </TableCell>
                        {isFormalStudentView && (
                          <TableCell>
                            {formalRisks.length === 0 ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                                正常
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {formalRisks.slice(0, 2).map((risk) => (
                                  <span key={risk.key} className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${risk.className}`}>
                                    {risk.label}
                                  </span>
                                ))}
                                {formalRisks.length > 2 && (
                                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                    +{formalRisks.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        )}
                        {isFormalStudentView && (
                          <TableCell>{student.formal_summary?.formal_subjects?.join(', ') || '-'}</TableCell>
                        )}
                        {isFormalStudentView && (
                          <TableCell>{student.formal_summary?.formal_teachers?.join(', ') || '-'}</TableCell>
                        )}
                        {isFormalStudentView && (
                          <TableCell>{student.formal_summary?.formal_order_count ?? 0}</TableCell>
                        )}
                        {isFormalStudentView && (
                          <TableCell>{formatHours(student.formal_summary?.total_formal_hours)}</TableCell>
                        )}
                        {isFormalStudentView && (
                          <TableCell>{formatHours(student.formal_summary?.remaining_formal_hours)}</TableCell>
                        )}
                        {isFormalStudentView && (
                          <TableCell>{formatCurrency(student.formal_summary?.remaining_formal_amount)}</TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!isFormalStudentView && !student.classin_uid && canEditStudent && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openClassInEntryDialog(student)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                入库
                              </Button>
                            )}
                            {canAssignHeadTeacher && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAssignDialog(student)}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                分配班主任
                              </Button>
                            )}
                            {isFormalStudentView && student.formal_summary?.latest_order_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/formal-orders/new?previousOrderId=${student.formal_summary?.latest_order_id}&studentId=${student.id}&mode=renew`)}
                              >
                                续费
                              </Button>
                            )}
                            {isFormalStudentView && student.formal_summary?.latest_order_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/formal-orders/new?previousOrderId=${student.formal_summary?.latest_order_id}&studentId=${student.id}&mode=extend`)}
                              >
                                扩科
                              </Button>
                            )}
                            {isFormalStudentView && student.formal_summary?.latest_order_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/transactions/new?student_id=${student.id}&order_id=${student.formal_summary?.latest_order_id}`)}
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                退费
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUpdateStatus && (
                                  <DropdownMenuItem onClick={() => openStatusDialog(student)}>
                                    更新状态
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/transactions/new?student_id=${student.id}${student.formal_summary?.latest_order_id ? `&order_id=${student.formal_summary.latest_order_id}` : ''}`)}>
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  退费
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {canEditStudent && (
                              <Link href={`/dashboard/students/${student.id}/edit`}>
                                <Button variant="ghost" size="icon">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {canDeleteStudent && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(student.id)}
                                disabled={isDeleting === student.id}
                              >
                                {isDeleting === student.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollableTable>

            <div className="mt-6 flex items-center justify-between flex-shrink-0">
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
                <div className="flex items-center gap-4">
                  <PaginationPageSize
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    options={PAGE_SIZE_OPTIONS}
                  />
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                <PaginationPrevious
                  onClick={goToPreviousPage}
                  className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  disabled={!canGoPrevious}
                />
                      </PaginationItem>
                      {getPageRange().map((page, index) => {
                        if (page === -1) {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return (
                          <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => goToPage(page)}
                  isActive={page === currentPage}
                  className="cursor-pointer"
                  disabled={false}
                >
                  {page}
                </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      <PaginationItem>
                <PaginationNext
                  onClick={goToNextPage}
                  className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  disabled={!canGoNext}
                />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
                <div className="w-auto"></div>
                    </div>
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={canDeleteStudent && deleteDialogOpen} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个学生吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeleting !== null}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting !== null}>
              {isDeleting ? (
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

      {/* 分配班主任对话框 */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配班主任</DialogTitle>
            <DialogDescription>
              为学生 <span className="font-semibold">{studentToAssign?.student_name}</span> 分配班主任
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="head-teacher">选择班主任</Label>
              <Select
                value={selectedHeadTeacher}
                onValueChange={setSelectedHeadTeacher}
                disabled={isLoadingHeadTeachers || isAssigning !== null}
              >
                <SelectTrigger id="head-teacher">
                  <SelectValue placeholder={isLoadingHeadTeachers ? "加载中..." : "请选择班主任"} />
                </SelectTrigger>
                <SelectContent>
                  {headTeachers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      暂无可用的班主任
                    </div>
                  ) : (
                    headTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {studentToAssign?.head_teacher_id && (
                <p className="text-xs text-muted-foreground">
                  当前班主任: {studentToAssign.head_teacher_name || '未知'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleAssignCancel} disabled={isAssigning !== null}>
              取消
            </Button>
            <Button onClick={handleAssignHeadTeacher} disabled={!selectedHeadTeacher || isAssigning !== null}>
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分配中...
                </>
              ) : (
                "确认分配"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ClassIn 入库对话框 */}
      <Dialog open={classInEntryDialogOpen} onOpenChange={(open) => {
        if (open) {
          setClassInEntryDialogOpen(true)
          return
        }
        closeClassInEntryDialog()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>学生入库 ClassIn</DialogTitle>
            <DialogDescription>
              为学生 <span className="font-semibold">{studentToConfirmEntry?.student_name}</span> 注册 ClassIn 并同步写入学生档案
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="classin-entry-student-code">学生编号</Label>
              <Input
                id="classin-entry-student-code"
                value={classInEntryForm.studentCode}
                onChange={(event) => setClassInEntryForm((current) => ({
                  ...current,
                  studentCode: event.target.value,
                }))}
                disabled={isConfirmingEntry || Boolean(studentToConfirmEntry?.student_code)}
                placeholder="请输入学生编号"
              />
              {studentToConfirmEntry?.student_code && (
                <p className="text-xs text-muted-foreground">
                  已有编号: {studentToConfirmEntry.student_code}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="classin-entry-initial-password">ClassIn 初始密码</Label>
              <Input
                id="classin-entry-initial-password"
                type="password"
                autoComplete="new-password"
                value={classInEntryForm.initialPassword}
                onChange={(event) => setClassInEntryForm((current) => ({
                  ...current,
                  initialPassword: event.target.value,
                }))}
                disabled={isConfirmingEntry}
                placeholder="请输入初始密码"
              />
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              家长手机号: {studentToConfirmEntry?.parent_phone || "-"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeClassInEntryDialog} disabled={isConfirmingEntry}>
              取消
            </Button>
            <Button
              onClick={handleConfirmEntry}
              disabled={
                isConfirmingEntry ||
                !classInEntryForm.studentCode.trim() ||
                !classInEntryForm.initialPassword.trim()
              }
            >
              {isConfirmingEntry ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  入库中...
                </>
              ) : (
                "确认入库"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 更新学生状态对话框 */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新学生状态</DialogTitle>
            <DialogDescription>
              更新学生 <span className="font-semibold">{studentToUpdateStatus?.student_name}</span> 的状态
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">选择状态</Label>
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="请选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="studying">在读</SelectItem>
                  <SelectItem value="suspended">停课</SelectItem>
                  <SelectItem value="completed">结课</SelectItem>
                  <SelectItem value="refunded">退费</SelectItem>
                </SelectContent>
              </Select>
              {studentToUpdateStatus?.status && (
                <p className="text-xs text-muted-foreground">
                  当前状态: {getStudentStatusLabel(studentToUpdateStatus.status)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">变更原因（可选）</Label>
              <Textarea
                id="reason"
                placeholder="请输入状态变更原因"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                disabled={isUpdatingStatus}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleStatusCancel} disabled={isUpdatingStatus}>
              取消
            </Button>
            <Button onClick={handleStatusUpdate} disabled={!selectedStatus || isUpdatingStatus}>
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                "确认更新"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
