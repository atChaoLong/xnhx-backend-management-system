"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
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
import { Loader2, Search, RefreshCw, FileText } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StudentsService, Student } from "@/lib/services/students"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"

const formatHours = (value?: number | null) => `${(value ?? 0).toFixed(1)} 小时`
const formatCurrency = (value?: number | null) => `¥${Math.max(0, value ?? 0).toFixed(2)}`

export default function FeedbackStudentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { students: studentsPerm, formalOrders: formalOrdersPerm, trialLessons: trialLessonsPerm, transactions: transactionsPerm } = usePermission()
  const canCreateFormalOrder = formalOrdersPerm.create()
  const canCreateTrialLesson = trialLessonsPerm.create()
  const canCreateTransaction = transactionsPerm.create()
  const canVisit = studentsPerm.visit()

  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("all")

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

  const fetchStudents = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await StudentsService.getFormalStudents(from, to)
      setStudents(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载正式生列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
    onPageChange: (page, size) => {
      fetchStudents(page, size)
    },
  })

  useEffect(() => {
    fetchStudents(1, pageSize)
  }, [])

  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>()
    students.forEach((student) => {
      student.formal_summary?.formal_subjects?.forEach((subject) => {
        if (subject) subjects.add(subject)
      })
    })
    return Array.from(subjects).sort((a, b) => a.localeCompare(b, "zh-CN"))
  }, [students])

  const displayedStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return students.filter((student) => {
      const summary = student.formal_summary
      const matchesKeyword = !keyword || [
        student.student_name,
        student.student_code,
        student.parent_phone,
        student.head_teacher_name,
        ...(summary?.formal_subjects ?? []),
        ...(summary?.formal_teachers ?? []),
      ].some((value) => String(value ?? "").toLowerCase().includes(keyword))
      const matchesSubject = subjectFilter === "all" || summary?.formal_subjects?.includes(subjectFilter)
      return matchesKeyword && matchesSubject
    })
  }, [search, subjectFilter, students])

  const totalRemainingHours = displayedStudents.reduce((sum, s) => sum + (s.formal_summary?.remaining_formal_hours ?? 0), 0)
  const totalRemainingAmount = displayedStudents.reduce((sum, s) => sum + (s.formal_summary?.remaining_formal_amount ?? 0), 0)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="正式生管理" description="查看所有正式生并进行管理操作" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="正式生管理"
        description="查看所有正式生并进行管理操作"
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">正式生列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchStudents(currentPage, pageSize)} disabled={isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
                <Link href="/dashboard/feedback">
                  <Button variant="outline">
                    回访记录
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mb-6 space-y-4 flex-shrink-0">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border px-4 py-3">
                  <div className="text-xs text-muted-foreground">当前页正式生</div>
                  <div className="mt-1 text-2xl font-semibold">{displayedStudents.length}</div>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <div className="text-xs text-muted-foreground">剩余总课时</div>
                  <div className="mt-1 text-xl font-semibold">{formatHours(totalRemainingHours)}</div>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <div className="text-xs text-muted-foreground">剩余总金额</div>
                  <div className="mt-1 text-xl font-semibold">{formatCurrency(totalRemainingAmount)}</div>
                </div>
                <div className="rounded-md border px-4 py-3">
                  <div className="text-xs text-muted-foreground">科目数</div>
                  <div className="mt-1 text-2xl font-semibold">{subjectOptions.length}</div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative min-w-0 flex-1 lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索学生、手机号、班主任、科目或老师"
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger className="w-[170px]">
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
                </div>
              </div>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">学生姓名</TableHead>
                    <TableHead>科目</TableHead>
                    <TableHead>老师</TableHead>
                    <TableHead>总课时</TableHead>
                    <TableHead>剩余课时</TableHead>
                    <TableHead>剩余金额</TableHead>
                    <TableHead>开课日期</TableHead>
                    <TableHead>班主任</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无正式生数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedStudents.map((student) => {
                      const summary = student.formal_summary
                      const firstClassTime = summary?.latest_order_time || student.created_at
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[140px] min-w-[140px]">
                            <Link href={`/dashboard/students/${student.id}`} className="hover:underline font-medium text-primary">
                              {student.student_name || "-"}
                            </Link>
                          </TableCell>
                          <TableCell>{summary?.formal_subjects?.join(', ') || '-'}</TableCell>
                          <TableCell>{summary?.formal_teachers?.join(', ') || '-'}</TableCell>
                          <TableCell>{formatHours(summary?.total_formal_hours)}</TableCell>
                          <TableCell>{formatHours(summary?.remaining_formal_hours)}</TableCell>
                          <TableCell>{formatCurrency(summary?.remaining_formal_amount)}</TableCell>
                          <TableCell>
                            {firstClassTime ? format(new Date(firstClassTime), 'yyyy-MM-dd') : '-'}
                          </TableCell>
                          <TableCell>
                            {student.head_teacher_name || (
                              <span className="text-muted-foreground text-sm">未分配</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/students/${student.id}`)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              详情管理
                            </Button>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
