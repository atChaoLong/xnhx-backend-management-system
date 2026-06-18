"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { AlertTriangle, Edit, Eye, Loader2, Plus, Trash2, Users } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  PaginationInfo,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPageSize,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Teacher, TeachersService } from "@/lib/services/teachers"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { useToast } from "@/hooks/use-toast"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

type TeacherLibraryVariant = "management" | "teaching" | "sales"

interface TeacherLibraryViewProps {
  variant?: TeacherLibraryVariant
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const TEACHER_LEVEL_LABELS: Record<string, string> = {
  ungraded: "未定级",
  junior: "初级教师",
  intermediate: "中级教师",
  senior: "高级教师",
  expert: "专家教师",
}

const TEACHER_STATUS_LABELS: Record<string, string> = {
  active: "正常",
  full: "满课",
  paused: "暂停排课",
  disabled: "停用",
}

const TEACHER_STATUS_CLASSES: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  full: "bg-blue-50 text-blue-700 border-blue-200",
  paused: "bg-yellow-50 text-yellow-700 border-yellow-200",
  disabled: "bg-gray-100 text-gray-700 border-gray-200",
}

const VIEW_COPY: Record<TeacherLibraryVariant, { title: string; description: string; listTitle: string }> = {
  management: {
    title: "老师管理",
    description: "管理已入库老师信息",
    listTitle: "老师列表",
  },
  teaching: {
    title: "老师库（教学版）",
    description: "查看老师授课能力、排课状态和 ClassIn 绑定情况",
    listTitle: "教学老师库",
  },
  sales: {
    title: "老师库（销售版）",
    description: "只读查看老师展示信息，便于销售匹配和介绍老师",
    listTitle: "销售老师库",
  },
}

function getTeacherLevelLabel(level?: string | null) {
  if (!level) return "未定级"
  return TEACHER_LEVEL_LABELS[level] || level
}

function getTeacherStatusLabel(status?: string | null) {
  if (!status) return "正常"
  return TEACHER_STATUS_LABELS[status] || status
}

function getTeacherStatusClass(status?: string | null) {
  return TEACHER_STATUS_CLASSES[status || "active"] || "bg-gray-100 text-gray-700 border-gray-200"
}

function joinList(value?: string[] | null) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "-"
}

function formatDate(value?: string | null) {
  return value ? format(new Date(value), "yyyy-MM-dd HH:mm") : "-"
}

export function TeacherLibraryView({ variant = "management" }: TeacherLibraryViewProps) {
  const copy = VIEW_COPY[variant]
  const isSalesView = variant === "sales"
  const isTeachingView = variant === "teaching"
  const isReadOnlyView = isSalesView
  const { teachers: teachersPerm } = usePermission()
  const { toast } = useToast()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null)
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

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
    onPageChange: (page, size) => fetchTeachers(page, size),
  })

  const fetchTeachers = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TeachersService.getTeachers(from, to)
      setTeachers(data)
      setTotalCount(count)
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: getClientSafeErrorMessage(error, "无法加载老师列表"),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTeachers(1, pageSize)
  }, [])

  const filteredTeachers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return teachers.filter((teacher) => {
      const matchesKeyword = !normalizedKeyword || [
        teacher.name,
        teacher.teacher_code,
        teacher.university,
        teacher.teaching_style,
        ...(teacher.subjects || []),
        ...(teacher.grade_levels || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword))

      const matchesStatus = statusFilter === "all" || (teacher.status || "active") === statusFilter
      return matchesKeyword && matchesStatus
    })
  }, [teachers, keyword, statusFilter])

  const handleDeleteClick = (id: string) => {
    if (isReadOnlyView || !teachersPerm.delete()) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "当前角色无权删除老师",
      })
      return
    }

    setTeacherToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!teacherToDelete) return
    if (isReadOnlyView || !teachersPerm.delete()) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "当前角色无权删除老师",
      })
      setDeleteDialogOpen(false)
      setTeacherToDelete(null)
      return
    }

    try {
      setIsDeleting(teacherToDelete)
      await TeachersService.deleteTeacher(teacherToDelete)
      toast({
        title: "删除成功",
        description: "老师已删除",
      })
      fetchTeachers(currentPage, pageSize)
      setDeleteDialogOpen(false)
      setTeacherToDelete(null)
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: getClientSafeErrorMessage(error, "无法删除老师"),
      })
    } finally {
      setIsDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title={copy.title} description={copy.description} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={copy.title} description={copy.description} />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex flex-col gap-4 mb-6 flex-shrink-0 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold">{copy.listTitle}</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索姓名、编号、学科"
                  className="h-9 w-full sm:w-56"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">全部状态</option>
                  <option value="active">正常</option>
                  <option value="full">满课</option>
                  <option value="paused">暂停排课</option>
                  <option value="disabled">停用</option>
                </select>
                <Button variant="outline" onClick={() => fetchTeachers(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
                {!isReadOnlyView && teachersPerm.create() && (
                  <Link href="/dashboard/teachers/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      新增老师
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">姓名</TableHead>
                    <TableHead className="sticky left-[140px] z-30 bg-background w-[140px] min-w-[140px]">学科</TableHead>
                    <TableHead>老师编号</TableHead>
                    <TableHead>等级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>年级段</TableHead>
                    {isTeachingView && <TableHead>ClassIn手机号</TableHead>}
                    {isTeachingView && <TableHead>ClassIn UID</TableHead>}
                    {isSalesView && <TableHead>学历/学校</TableHead>}
                    {isSalesView && <TableHead>教龄</TableHead>}
                    {isSalesView && <TableHead>教学风格</TableHead>}
                    {isSalesView && <TableHead>成功案例</TableHead>}
                    {!isSalesView && <TableHead>微信</TableHead>}
                    {!isSalesView && <TableHead>是否用过ClassIn</TableHead>}
                    <TableHead>所在地</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSalesView ? 13 : isTeachingView ? 13 : 11} className="text-center py-8 text-muted-foreground">
                        暂无符合条件的老师
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[140px] min-w-[140px]">
                          {teacher.name || "-"}
                        </TableCell>
                        <TableCell className="sticky left-[140px] z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                          {joinList(teacher.subjects)}
                        </TableCell>
                        <TableCell>{teacher.teacher_code || "-"}</TableCell>
                        <TableCell>{getTeacherLevelLabel(teacher.teacher_level)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getTeacherStatusClass(teacher.status)}`}>
                            {getTeacherStatusLabel(teacher.status)}
                          </span>
                        </TableCell>
                        <TableCell>{joinList(teacher.grade_levels)}</TableCell>
                        {isTeachingView && <TableCell>{teacher.classin_phone || "-"}</TableCell>}
                        {isTeachingView && <TableCell>{teacher.classin_uid ?? "-"}</TableCell>}
                        {isSalesView && <TableCell>{[teacher.education, teacher.university].filter(Boolean).join(" / ") || "-"}</TableCell>}
                        {isSalesView && <TableCell>{teacher.teaching_years ? `${teacher.teaching_years}年` : "-"}</TableCell>}
                        {isSalesView && <TableCell className="max-w-[220px] truncate">{teacher.teaching_style || "-"}</TableCell>}
                        {isSalesView && <TableCell className="max-w-[260px] truncate">{teacher.success_cases || "-"}</TableCell>}
                        {!isSalesView && <TableCell>{teacher.wechat || "-"}</TableCell>}
                        {!isSalesView && <TableCell>{teacher.used_classin ? "是" : "否"}</TableCell>}
                        <TableCell>{teacher.location || "-"}</TableCell>
                        <TableCell>{formatDate(teacher.updated_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/teachers/${teacher.id}`}>
                              <Button variant="ghost" size="icon" title="查看详情">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {!isSalesView && (
                              <Link href={`/dashboard/students?teacher_id=${teacher.id}&teacher_name=${encodeURIComponent(teacher.name)}`}>
                                <Button variant="ghost" size="icon" title="查看学员">
                                  <Users className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {!isReadOnlyView && teachersPerm.edit() && (
                              <Link href={`/dashboard/teachers/${teacher.id}/edit`}>
                                <Button variant="ghost" size="icon" title="编辑">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {!isReadOnlyView && teachersPerm.delete() && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(teacher.id)}
                                disabled={isDeleting === teacher.id}
                                title="删除"
                              >
                                {isDeleting === teacher.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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
              <div className="w-auto" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!isReadOnlyView && teachersPerm.delete() && deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false)
            setTeacherToDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个老师吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setTeacherToDelete(null)
              }}
              disabled={isDeleting !== null}
            >
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
    </div>
  )
}
