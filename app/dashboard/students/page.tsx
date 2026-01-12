"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, UserCheck } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { StudentsService, Student } from "@/lib/services/students"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

// 班主任类型
interface HeadTeacher {
  id: string
  name: string
  role: string
}

export default function StudentsPage() {
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


  // 加载学生列表
  const fetchStudents = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await StudentsService.getStudents(from, to)
      setStudents(data)
      setTotalCount(count)
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
      const token = localStorage.getItem('supabase.auth.token')
      const response = await fetch('/api/users?role=head_teacher', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error('获取班主任列表失败')
      }
      const { data } = await response.json()
      setHeadTeachers(data || [])
    } catch (error: any) {
      console.error('获取班主任列表失败:', error)
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
  }, [])

  // 删除学生
  const handleDeleteClick = (id: string) => {
    setStudentToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return

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
      const token = localStorage.getItem('supabase.auth.token')
      const response = await fetch('/api/students/assign-head-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: studentToAssign.id,
          headTeacherId: selectedHeadTeacher,
        }),
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

  const handleConfirmEntry = async (student: Student) => {
    const code = prompt(`为学生 ${student.student_name} 设置学生编号：`)
    if (code === null || !code.trim()) return
    const password = prompt(`为学生 ${student.student_name} 设置 ClassIn 初始密码：`, "123456")
    if (password === null || !password.trim()) return
    if (!student.parent_phone) {
      toast({
        variant: "destructive",
        title: "无法入库",
        description: "该学生没有填写手机号（家长电话）",
      })
      return
    }
    try {
      const resp = await fetch("/api/student-entries/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: student.student_name,
          student_code: code.trim(),
          parent_phone: student.parent_phone,
          initial_password: password.trim(),
          status: student.status || "active",
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "学生入库失败" }))
        throw new Error(err.error || "学生入库失败")
      }
      toast({
        title: "入库成功",
        description: "学生已注册 ClassIn 并写入 students",
      })
      fetchStudents(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "入库失败",
        description: error.message || "无法入库该学生",
      })
    }
  }


  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="学生管理" description="管理和查看所有学生信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="学生管理"
        description="管理和查看所有学生信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">学生列表</h3>
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
                <Link href="/dashboard/students/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增学生
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学生编号</TableHead>
                    <TableHead>学生姓名</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>ClassIn初始密码</TableHead>
                    <TableHead>ClassIn UID</TableHead>
                    <TableHead>班主任</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增学生"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.student_code || "-"}</TableCell>
                        <TableCell>{student.student_name || "-"}</TableCell>
                        <TableCell>{student.parent_phone || "-"}</TableCell>
                        <TableCell>{student.classin_initial_password || "-"}</TableCell>
                        <TableCell>{student.classin_uid ?? "-"}</TableCell>
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
                          {student.status === 'active' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              正常
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {student.status || '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!student.classin_uid && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleConfirmEntry(student)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                入库
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignDialog(student)}
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              分配班主任
                            </Button>
                            <Link href={`/dashboard/students/${student.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex items-center justify-between">
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
    </div>
  )
}
