"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, Calendar, Clock, User, BookOpen, Play, CheckCircle, XCircle, Plus, Trash2, Edit, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { zhCN } from "date-fns/locale"

// 类型定义
interface CourseDetail {
  id: string
  order_id: string
  classin_course_id?: number
  course_name?: string
  subject?: string
  grade?: string
  teacher_name?: string
  session_count: number
  total_hours: number
  course_status: string
  course_consumption_info?: string
  notes?: string
  created_at: string
  updated_at: string
  order_number?: string
  student_id?: string
  student?: {
    student_name: string
  }
}

interface ClassSession {
  id: string
  course_id: string
  classroom_id?: number
  session_number: number
  session_name?: string
  scheduled_date: string
  scheduled_time_start: string
  scheduled_time_end: string
  scheduled_duration_minutes: number
  actual_start_time?: string
  actual_end_time?: string
  actual_duration_minutes?: number
  status: string
  teacher_name?: string
  notes?: string
  created_at: string
}

// 状态映射
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'active': {
    label: '进行中',
    color: 'bg-blue-100 text-blue-800',
    icon: <Play className="h-4 w-4" />
  },
  'completed': {
    label: '已完成',
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle className="h-4 w-4" />
  },
  'suspended': {
    label: '已暂停',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <Clock className="h-4 w-4" />
  },
  'cancelled': {
    label: '已取消',
    color: 'bg-red-100 text-red-800',
    icon: <XCircle className="h-4 w-4" />
  },
  // 课节状态
  'scheduled': {
    label: '未开始',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <Clock className="h-4 w-4" />
  },
  'missed': {
    label: '缺课',
    color: 'bg-gray-100 text-gray-800',
    icon: <XCircle className="h-4 w-4" />
  },
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

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null)
  const [isOperating, setIsOperating] = useState(false)

  // 编辑表单
  const [editForm, setEditForm] = useState({
    scheduled_date: '',
    scheduled_time_start: '',
    scheduled_time_end: '',
  })

  // 添加表单
  const [addForm, setAddForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
  })

  useEffect(() => {
    if (params.id) {
      fetchCourseDetail()
      fetchSessions()
    }
  }, [params.id])

  const fetchCourseDetail = async () => {
    try {
      const token = localStorage.getItem('supabase.auth.token')
      const response = await fetch(`/api/courses?id=${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('获取课程详情失败')
      const result = await response.json()
      setCourse(result.data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message,
      })
    }
  }

  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('supabase.auth.token')
      const response = await fetch(`/api/courses/${params.id}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('获取课节列表失败')
      const result = await response.json()
      setSessions(result.data || [])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 打开删除对话框
  const openDeleteDialog = (session: ClassSession) => {
    setSelectedSession(session)
    setDeleteDialogOpen(true)
  }

  // 确认删除
  const handleDelete = async (deleteClassIn: boolean) => {
    if (!selectedSession) return

    try {
      setIsOperating(true)
      const token = localStorage.getItem('supabase.auth.token')

      const response = await fetch(
        `/api/class-sessions?id=${selectedSession.id}&delete_classin=${deleteClassIn}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      )

      if (!response.ok) throw new Error('删除课节失败')

      const result = await response.json()

      // 使用后端返回的消息（包含 ClassIn 删除状态）
      toast({
        title: "删除成功",
        description: result.data?.message || '课节已删除',
        variant: result.data?.classInError ? 'default' : 'default',
      })

      setDeleteDialogOpen(false)
      fetchSessions()
      fetchCourseDetail() // 刷新课程统计
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message,
      })
    } finally {
      setIsOperating(false)
    }
  }

  // 打开编辑对话框
  const openEditDialog = (session: ClassSession) => {
    setSelectedSession(session)
    setEditForm({
      scheduled_date: session.scheduled_date,
      scheduled_time_start: session.scheduled_time_start,
      scheduled_time_end: session.scheduled_time_end,
    })
    setEditDialogOpen(true)
  }

  // 提交编辑
  const handleEdit = async () => {
    if (!selectedSession) return

    try {
      setIsOperating(true)
      const token = localStorage.getItem('supabase.auth.token')

      const response = await fetch('/api/class-sessions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedSession.id,
          ...editForm,
        }),
      })

      if (!response.ok) throw new Error('更新课节失败')

      toast({
        title: "更新成功",
        description: "课节时间已修改",
      })

      setEditDialogOpen(false)
      fetchSessions()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message,
      })
    } finally {
      setIsOperating(false)
    }
  }

  // 添加新课节
  const handleAdd = async () => {
    if (!course?.student?.student_name || !course.teacher_name) {
      toast({
        variant: "destructive",
        title: "信息不完整",
        description: "缺少学生或教师信息",
      })
      return
    }

    try {
      setIsOperating(true)
      const token = localStorage.getItem('supabase.auth.token')

      const response = await fetch('/api/class-sessions/recreate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: params.id,
          items: [
            {
              studentName: course.student.student_name,
              teacherName: course.teacher_name,
              subject: course.subject,
              date: addForm.date,
              startTime: addForm.startTime,
              endTime: addForm.endTime,
            }
          ],
          skipExisting: true,
        }),
      })

      if (!response.ok) throw new Error('添加课节失败')
      const result = await response.json()

      toast({
        title: "添加成功",
        description: `已添加 ${result.data.created} 个新课节`,
      })

      setAddDialogOpen(false)
      setAddForm({ date: '', startTime: '', endTime: '' })
      fetchSessions()
      fetchCourseDetail()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "添加失败",
        description: error.message,
      })
    } finally {
      setIsOperating(false)
    }
  }

  // 同步课节状态
  const handleSync = async () => {
    try {
      setIsOperating(true)
      const token = localStorage.getItem('supabase.auth.token')

      const response = await fetch('/api/class-sessions/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId: params.id }),
      })

      if (!response.ok) throw new Error('同步失败')
      const result = await response.json()

      toast({
        title: "同步成功",
        description: `已更新 ${result.data.updated} 个课节`,
      })

      fetchSessions()
      fetchCourseDetail()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "同步失败",
        description: error.message,
      })
    } finally {
      setIsOperating(false)
    }
  }

  if (isLoading || !course) {
    return (
      <div className="flex flex-col h-full">
        <Header title="课程详情" description="查看和管理课程课节" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const consumption = parseConsumptionInfo(course.course_consumption_info)
  const statusInfo = STATUS_MAP[course.course_status || 'active'] || STATUS_MAP['active']

  return (
    <div className="flex flex-col h-full">
      <Header title="课程详情" description={course.course_name || '课程管理'} />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 返回按钮 */}
        <div>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>

        {/* 课程基本信息 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">课程名称</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium truncate">{course.course_name || '-'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">学科</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">{course.subject || '-'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">授课教师</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">{course.teacher_name || '-'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">课程状态</CardTitle>
              {statusInfo.icon}
            </CardHeader>
            <CardContent>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总课时</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{consumption.totalSessions || course.session_count || 0}</div>
              <p className="text-xs text-muted-foreground">
                已完成 {consumption.completedSessions || 0} 节
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总时长</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{course.total_hours || 0} 小时</div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">课程进度</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {consumption.totalSessions > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${consumption.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{consumption.progress}%</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无进度信息</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 课节管理 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>课节列表</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                共 {sessions.length} 节课
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSync} variant="outline" size="sm" disabled={isOperating}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isOperating ? 'animate-spin' : ''}`} />
                同步状态
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} size="sm" disabled={isOperating}>
                <Plus className="mr-2 h-4 w-4" />
                添加课节
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无课节</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">序号</TableHead>
                      <TableHead>课节名称</TableHead>
                      <TableHead>上课日期</TableHead>
                      <TableHead>上课时间</TableHead>
                      <TableHead>时长</TableHead>
                      <TableHead>教师</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const sessionStatus = STATUS_MAP[session.status] || STATUS_MAP['scheduled']
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">第{session.session_number}节</TableCell>
                          <TableCell>{session.session_name || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(session.scheduled_date), 'yyyy-MM-dd', { locale: zhCN })}
                          </TableCell>
                          <TableCell>
                            {session.scheduled_time_start} - {session.scheduled_time_end}
                          </TableCell>
                          <TableCell>{session.scheduled_duration_minutes} 分钟</TableCell>
                          <TableCell>{session.teacher_name || '-'}</TableCell>
                          <TableCell>
                            <Badge className={sessionStatus.color}>
                              <span className="flex items-center gap-1">
                                {sessionStatus.icon}
                                {sessionStatus.label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {session.status === 'scheduled' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(session)}
                                    disabled={isOperating}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(session)}
                                    disabled={isOperating}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除课节</DialogTitle>
            <DialogDescription>
              确定要删除第{selectedSession?.session_number}节课吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleDelete(false)}
              disabled={isOperating}
            >
              仅删除本地记录
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(true)}
              disabled={isOperating}
            >
              同时删除 ClassIn 课堂
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改课节时间</DialogTitle>
            <DialogDescription>
              修改第{selectedSession?.session_number}节课的上课时间
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">上课日期 *</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.scheduled_date}
                onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-start">开始时间 *</Label>
              <Input
                id="edit-start"
                type="time"
                value={editForm.scheduled_time_start}
                onChange={(e) => setEditForm({ ...editForm, scheduled_time_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">结束时间 *</Label>
              <Input
                id="edit-end"
                type="time"
                value={editForm.scheduled_time_end}
                onChange={(e) => setEditForm({ ...editForm, scheduled_time_end: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isOperating}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={isOperating}>
              {isOperating ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加课节对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新课节</DialogTitle>
            <DialogDescription>
              为课程 <span className="font-semibold">{course.course_name}</span> 添加新课节
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-date">上课日期 *</Label>
              <Input
                id="add-date"
                type="date"
                value={addForm.date}
                onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-start">开始时间 *</Label>
              <Input
                id="add-start"
                type="time"
                value={addForm.startTime}
                onChange={(e) => setAddForm({ ...addForm, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-end">结束时间 *</Label>
              <Input
                id="add-end"
                type="time"
                value={addForm.endTime}
                onChange={(e) => setAddForm({ ...addForm, endTime: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={isOperating}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={isOperating}>
              {isOperating ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
