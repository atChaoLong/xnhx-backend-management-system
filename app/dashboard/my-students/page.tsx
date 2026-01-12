"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { usePermission } from "@/lib/hooks/usePermission"
import { Loader2, Search, Phone, Mail, Calendar, BookOpen, TrendingUp, Users, Clock } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

interface Student {
  id: string
  student_code?: string
  student_name: string
  parent_phone?: string
  grade?: string
  region?: string
  head_teacher_id?: string
  head_teacher_name?: string
  status?: string
  classin_uid?: number
  created_at: string
}

interface StudentStats {
  totalStudents: number
  activeStudents: number
  totalOrders: number
  totalClassHours?: number
  renewalCount?: number
}

export default function MyStudentsPage() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const { students: studentsPermissions } = usePermission()
  const [students, setStudents] = useState<Student[]>([])
  const [stats, setStats] = useState<StudentStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const totalCount = 0

  const PAGE_SIZE_OPTIONS = [10, 20, 50]

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

  // 权限检查
  const canViewStudents = studentsPermissions.view()

  useEffect(() => {
    if (user && !userLoading) {
      // 检查是否为班主任或管理员
      if (user.role !== 'head_teacher' && user.role !== 'admin') {
        // TODO: 显示权限不足提示
        return
      }
      fetchStudents(1, pageSize)
      fetchStats()
    }
  }, [user, userLoading])

  // 获取班主任的学生列表
  const fetchStudents = async (page: number = 1, size: number = pageSize) => {
    if (!user) return

    try {
      setIsLoading(true)
      const token = localStorage.getItem('supabase.auth.token')

      // 根据角色过滤
      let url = `/api/students?from=${(page - 1) * size}&to=${(page - 1) * size + size - 1}`
      if (user.role === 'head_teacher') {
        url += `&head_teacher_id=${user.id}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('获取学生列表失败')
      }

      const { data, count } = await response.json()
      setStudents(data || [])
      // TODO: 更新 totalCount
    } catch (error: any) {
      console.error('获取学生列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 获取统计数据
  const fetchStats = async () => {
    if (!user) return

    try {
      const token = localStorage.getItem('supabase.auth.token')

      // 根据角色获取统计
      let url = '/api/students/stats'
      if (user.role === 'head_teacher') {
        url += `?head_teacher_id=${user.id}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  // 过滤学生
  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.parent_phone?.includes(searchTerm)

    const matchesStatus = statusFilter === 'all' || student.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (userLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="我的学生" description="查看和管理我管理的学生" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!canViewStudents) {
    return (
      <div className="flex flex-col h-full">
        <Header title="我的学生" description="查看和管理我管理的学生" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">您没有权限查看学生列表</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="我的学生"
        description={`查看和管理我管理的学生 ${user?.role === 'head_teacher' ? '(班主任)' : ''}`}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">学生总数</p>
                    <p className="text-3xl font-bold mt-2">{stats.totalStudents}</p>
                  </div>
                  <Users className="h-10 w-10 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">在读学生</p>
                    <p className="text-3xl font-bold mt-2 text-green-600">{stats.activeStudents}</p>
                  </div>
                  <BookOpen className="h-10 w-10 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">订单总数</p>
                    <p className="text-3xl font-bold mt-2 text-blue-600">{stats.totalOrders}</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">总课时</p>
                    <p className="text-3xl font-bold mt-2 text-purple-600">{stats.totalClassHours || 0}h</p>
                  </div>
                  <Clock className="h-10 w-10 text-purple-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 筛选和搜索 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索学生姓名、学号或手机号..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="学生状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">在读</SelectItem>
                  <SelectItem value="paused">暂停</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => fetchStudents(currentPage, pageSize)}>
                刷新
              </Button>

              <Link href="/dashboard/students/new">
                <Button>
                  新增学生
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 学生列表 */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">学生列表</h3>
              <p className="text-sm text-muted-foreground">
                共 {filteredStudents.length} 名学生
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || statusFilter !== 'all' ? '没有找到匹配的学生' : '暂无学生数据'}
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>学号</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>年级</TableHead>
                        <TableHead>地域</TableHead>
                        <TableHead>家长电话</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.student_code || '-'}</TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/students/${student.id}`}
                              className="font-medium hover:underline text-blue-600"
                            >
                              {student.student_name || '-'}
                            </Link>
                          </TableCell>
                          <TableCell>{student.grade || '-'}</TableCell>
                          <TableCell>{student.region || '-'}</TableCell>
                          <TableCell>
                            {student.parent_phone && (
                              <a
                                href={`tel:${student.parent_phone}`}
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <Phone className="h-3 w-3" />
                                {student.parent_phone}
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.status === 'active' ? (
                              <Badge className="bg-green-500">在读</Badge>
                            ) : student.status === 'paused' ? (
                              <Badge variant="secondary">暂停</Badge>
                            ) : (
                              <Badge variant="outline">{student.status || '-'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link href={`/dashboard/students/${student.id}`}>
                                <Button variant="ghost" size="sm">
                                  详情
                                </Button>
                              </Link>
                              <Link href={`/dashboard/students/${student.id}/orders`}>
                                <Button variant="ghost" size="sm">
                                  订单
                                </Button>
                              </Link>
                              <Link href={`/dashboard/students/${student.id}/visits`}>
                                <Button variant="ghost" size="sm">
                                  回访
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                <div className="mt-6 flex items-center justify-between">
                  <PaginationInfo
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={filteredStudents.length}
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
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
