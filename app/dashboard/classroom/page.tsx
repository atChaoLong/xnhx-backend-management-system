"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/fetch"
import { usePermission } from "@/lib/hooks/usePermission"
import { summarizeError } from "@/lib/safe-error"

interface Course {
  id: string
  course_name?: string
  subject?: string
  grade?: string
  session_count: number
  total_hours: number
  course_status: string
  course_consumption_info?: string
  created_at: string
  teacher?: {
    id: string
    name?: string
  }
  student?: {
    id: string
    student_name?: string
  }
  formal_orders?: {
    id: string
    order_number?: string
  }
}

const COURSE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  'active': { label: '进行中', color: 'bg-blue-100 text-blue-800' },
  'completed': { label: '已完成', color: 'bg-green-100 text-green-800' },
  'suspended': { label: '已暂停', color: 'bg-yellow-100 text-yellow-800' },
  'cancelled': { label: '已取消', color: 'bg-red-100 text-red-800' },
}

const CLASS_SESSION_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "scheduled", label: "未开始" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "missed", label: "缺课" },
  { value: "no-show", label: "未到课" },
]

function formatDateInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function getDefaultExportRange() {
  const now = new Date()
  return {
    startDate: formatDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: formatDateInputValue(now),
    status: "all",
  }
}

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return fallback
    }
  }
  const quotedMatch = disposition.match(/filename="?([^";]+)"?/i)
  return quotedMatch?.[1] || fallback
}

// 解析课程消耗信息
const parseConsumptionInfo = (info: string | null | undefined): { totalSessions: number; completedSessions: number; progress: number } => {
  if (!info) return { totalSessions: 0, completedSessions: 0, progress: 0 }
  try {
    return JSON.parse(info)
  } catch {
    return { totalSessions: 0, completedSessions: 0, progress: 0 }
  }
}

export default function ClassroomPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const { toast } = useToast()
  const { classSessions: classSessionsPermission, isLoading: isPermissionLoading } = usePermission()
  const canExportClassSessions = !isPermissionLoading && classSessionsPermission.edit()

  // 筛选条件
  const [filters, setFilters] = useState({
    studentId: '',
  })
  const [exportFilters, setExportFilters] = useState(getDefaultExportRange)

  const fetchCourses = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filters.studentId) {
        params.append('studentId', filters.studentId)
      }

      const response = await api.get(`/api/classrooms/scheduled?${params.toString()}`)

      if (!response.ok) {
        throw new Error('获取课程列表失败')
      }

      const result = await response.json()
      setCourses(result.data || [])
      setTotalCount(result.data?.length || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课程列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 加载学生列表
  const fetchStudents = async () => {
    try {
      const response = await api.get('/api/students')

      if (response.ok) {
        const result = await response.json()
        // 转换为 { id, name } 格式
        const formattedStudents = (result.data || []).map((s: any) => ({
          id: s.id,
          name: s.student_name,
        }))
        setStudents(formattedStudents)
      }
    } catch (error) {
      console.error('加载学生列表失败:', summarizeError(error))
    }
  }

  const exportClassSessions = async () => {
    if (!canExportClassSessions) {
      toast({
        variant: "destructive",
        title: "权限不足",
        description: "当前账号无权导出课节",
      })
      return
    }

    if (!exportFilters.startDate || !exportFilters.endDate) {
      toast({
        variant: "destructive",
        title: "请选择日期范围",
        description: "开始日期和结束日期都不能为空",
      })
      return
    }

    if (exportFilters.startDate > exportFilters.endDate) {
      toast({
        variant: "destructive",
        title: "日期范围无效",
        description: "开始日期不能晚于结束日期",
      })
      return
    }

    try {
      setIsExporting(true)
      const params = new URLSearchParams({
        start_date: exportFilters.startDate,
        end_date: exportFilters.endDate,
      })

      if (exportFilters.status !== "all") {
        params.set("status", exportFilters.status)
      }

      const response = await api.get(`/api/class-sessions/export?${params.toString()}`)

      if (!response.ok) {
        let message = "导出课节失败"
        try {
          const result = await response.clone().json()
          message = result.error || message
        } catch {
          // CSV endpoint may not return JSON on unexpected infrastructure errors.
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = getFilenameFromDisposition(
        response.headers.get("Content-Disposition"),
        `class-sessions-${exportFilters.startDate}-to-${exportFilters.endDate}.csv`
      )
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const rowCount = response.headers.get("X-Export-Row-Count") || "0"
      const limited = response.headers.get("X-Export-Limited") === "true"
      toast({
        title: "导出完成",
        description: limited
          ? `已导出前 ${rowCount} 条课节，请缩小日期范围获取完整数据`
          : `已导出 ${rowCount} 条课节`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "导出失败",
        description: error.message || "无法导出课节",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // 筛选条件变化时，重新获取数据
  useEffect(() => {
    if (students.length > 0 || !filters.studentId) {
      fetchCourses()
    }
  }, [filters, students.length])

  useEffect(() => {
    fetchCourses()
    fetchStudents()
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="课堂管理" description="展示所有课程" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="课堂管理" description="展示所有课程" />
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* 筛选条件 */}
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    id="student-filter"
                    label="学生"
                    placeholder="搜索学生姓名..."
                    value={filters.studentId}
                    onChange={(value) => setFilters(prev => ({ ...prev, studentId: value }))}
                    options={students}
                  />
                </div>
                {filters.studentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, studentId: '' }))}
                    className="mt-6"
                  >
                    清除
                  </Button>
                )}
              </div>

              {canExportClassSessions && (
                <div className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(160px,200px)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="export-start-date">导出开始日期</Label>
                    <Input
                      id="export-start-date"
                      type="date"
                      value={exportFilters.startDate}
                      onChange={(event) => setExportFilters(prev => ({ ...prev, startDate: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="export-end-date">导出结束日期</Label>
                    <Input
                      id="export-end-date"
                      type="date"
                      value={exportFilters.endDate}
                      onChange={(event) => setExportFilters(prev => ({ ...prev, endDate: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>课节状态</Label>
                    <Select
                      value={exportFilters.status}
                      onValueChange={(value) => setExportFilters(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASS_SESSION_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={exportClassSessions}
                    disabled={isExporting}
                    className="w-full md:w-auto"
                  >
                    {isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    导出课节
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">课程列表</h3>
                <p className="text-sm text-muted-foreground">共 {totalCount} 个课程</p>
              </div>
              <div>
                <Button variant="outline" onClick={() => fetchCourses()} disabled={isLoading}>刷新</Button>
              </div>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[200px] min-w-[200px]">课程名称</TableHead>
                    <TableHead>学科</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>学生</TableHead>
                    <TableHead>教师</TableHead>
                    <TableHead>课时数</TableHead>
                    <TableHead>总时长</TableHead>
                    <TableHead>进度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">暂无数据</TableCell>
                    </TableRow>
                  ) : (
                    courses.map((course) => {
                      const consumption = parseConsumptionInfo(course.course_consumption_info)
                      return (
                        <TableRow key={course.id}>
                          <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[200px] min-w-[200px]">{course.course_name || '-'}</TableCell>
                          <TableCell>{course.subject || '-'}</TableCell>
                          <TableCell>{course.formal_orders?.order_number || '-'}</TableCell>
                          <TableCell>{course.student?.student_name || '-'}</TableCell>
                          <TableCell>{course.teacher?.name || '-'}</TableCell>
                          <TableCell>{consumption.totalSessions || course.session_count || 0}</TableCell>
                          <TableCell>{course.total_hours || 0} 小时</TableCell>
                          <TableCell>
                            {consumption.totalSessions > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${consumption.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{consumption.progress}%</span>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={COURSE_STATUS_MAP[course.course_status]?.color || ''}>
                              {COURSE_STATUS_MAP[course.course_status]?.label || course.course_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(course.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                            >
                              管理课节
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
              <div className="text-sm text-muted-foreground">
                共 {totalCount} 个课程
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
