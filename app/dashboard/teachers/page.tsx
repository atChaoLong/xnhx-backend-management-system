"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, Upload, Eye, Users } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TeachersService, Teacher } from "@/lib/services/teachers"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null)
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
    onPageChange: (page, size) => fetchTeachers(page, size),
  })

  // 加载老师列表
  const fetchTeachers = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TeachersService.getTeachers(from, to)
      setTeachers(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载老师列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTeachers(1, pageSize)
  }, [])

  // 删除老师
  const handleDeleteClick = (id: string) => {
    setTeacherToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!teacherToDelete) return

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
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除老师",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setTeacherToDelete(null)
  }

  // 入库到 ClassIn（基于简化字段）
  const handleRegisterToClassIn = async (teacher: Teacher) => {
    if (!teacher.classin_phone) {
      toast({
        variant: "destructive",
        title: "无法入库",
        description: "该老师没有填写手机号，请先编辑老师信息",
      })
      return
    }

    if (teacher.classin_uid) {
      toast({
        variant: "destructive",
        title: "已经入库",
        description: "该老师已经入库到 ClassIn 系统",
      })
      return
    }

    const password = prompt(`正在将老师 ${teacher.name || '-'} 入库到 ClassIn 系统\n\n手机号: ${teacher.classin_phone}\n\n请输入 ClassIn 登录密码：`)
    if (password === null) {
      return
    }
    if (password.trim() === "") {
      toast({
        variant: "destructive",
        title: "密码不能为空",
        description: "请输入 ClassIn 登录密码",
      })
      return
    }

    try {
      setIsRegistering(teacher.id)

      const response = await fetch('/api/teachers/register-classin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacher.id,
          telephone: teacher.classin_phone,
          nickname: teacher.name,
          password: password.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '入库失败' }))
        throw new Error(error.error || '入库失败')
      }

      const result = await response.json()

      toast({
        title: "入库成功",
        description: `老师已入库到 ClassIn 系统，UID: ${result.data.uid}`,
      })

      fetchTeachers(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "入库失败",
        description: error.message || "无法入库到 ClassIn",
      })
    } finally {
      setIsRegistering(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师管理" description="管理已入库老师信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="老师管理"
        description="管理已入库老师信息"
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">老师列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchTeachers(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/teachers/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增老师
                  </Button>
                </Link>
              </div>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">姓名</TableHead>
                    <TableHead className="sticky left-[140px] z-30 bg-background w-[140px] min-w-[140px]">学科</TableHead>
                    <TableHead>微信</TableHead>
                    <TableHead>ClassIn手机号</TableHead>
                    <TableHead>年级段</TableHead>
                    <TableHead>是否用过ClassIn</TableHead>
                    <TableHead>ClassIn UID</TableHead>
                    <TableHead>所在地</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击&quot;新增老师&quot;开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[140px] min-w-[140px]">{teacher.name || "-"}</TableCell>
                        <TableCell className="sticky left-[140px] z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                          {Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : '-'}
                        </TableCell>
                        <TableCell>{teacher.wechat || "-"}</TableCell>
                        <TableCell>{teacher.classin_phone || "-"}</TableCell>
                        <TableCell>{Array.isArray(teacher.grade_levels) ? teacher.grade_levels.join(', ') : '-'}</TableCell>
                        <TableCell>{teacher.used_classin ? '是' : '否'}</TableCell>
                        <TableCell>{teacher.classin_uid ?? "-"}</TableCell>
                        <TableCell>{teacher.location || "-"}</TableCell>
                        <TableCell>{teacher.created_at ? format(new Date(teacher.created_at), "yyyy-MM-dd HH:mm") : "-"}</TableCell>
                        <TableCell>{teacher.updated_at ? format(new Date(teacher.updated_at), "yyyy-MM-dd HH:mm") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/teachers/${teacher.id}`}>
                              <Button variant="ghost" size="icon" title="查看详情">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/students?teacher_id=${teacher.id}&teacher_name=${encodeURIComponent(teacher.name)}`}>
                              <Button variant="ghost" size="icon" title="查看学员">
                                <Users className="h-4 w-4" />
                              </Button>
                            </Link>
                            {!teacher.classin_uid && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleRegisterToClassIn(teacher)}
                                disabled={isRegistering === teacher.id}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                {isRegistering === teacher.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    入库中...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    入库
                                  </>
                                )}
                              </Button>
                            )}
                            <Link href={`/dashboard/teachers/${teacher.id}/edit`}>
                              <Button variant="ghost" size="icon" title="编辑">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
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
                <div className="w-auto"></div>
                    </div>
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
    </div>
  )
}
