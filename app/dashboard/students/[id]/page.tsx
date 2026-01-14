"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, FileText, BookOpen, Video, User, Phone, Mail, School, Calendar, DollarSign, Clock, MessageCircle, Plus, History } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getDictionaryItems, DictionaryItem } from "@/lib/services/dictionary"
import { getStudentStatusLabel, getStudentStatusBadgeClass } from "@/lib/utils"

// 学生数据类型
interface StudentDetail {
  student: {
    id: string
    student_code?: string
    student_name: string
    grade_code?: string
    region?: string
    school?: string
    parent_phone?: string
    head_teacher_id?: string
    status: string
    classin_initial_password?: string
    classin_uid?: number
    created_at: string
    head_teacher?: {
      id: string
      name: string
      email?: string
      phone?: string
    }
  }
  orders: FormalOrder[]
  trialLessons: TrialLesson[]
  courses: Course[]
  classrooms: Classroom[]
  visitRecords: VisitRecord[]
  statusHistory: StatusHistory[]
  stats: {
    formalOrdersCount: number
    trialLessonsCount: number
    coursesCount: number
    classroomsCount: number
    visitRecordsCount: number
    statusHistoryCount: number
    totalFormalHours: number
    totalFormalAmount: number
  }
}

interface FormalOrder {
  id: string
  order_number?: string
  order_type: string
  consultant_teacher: string
  teacher_names: string[]
  subjects: string[]
  total_sessions: number
  session_duration: number
  total_hours: number
  payment_amount: number
  payment_channel: string
  payment_time: string
  first_class_time: string
  status: string
  created_at: string
}

interface TrialLesson {
  id: string
  child_name: string
  region: string
  grade: string
  trial_subject: string
  trial_time: string
  trial_duration: number
  trial_amount?: number
  payment_proof: string
  status: string
  lesson_status?: string
  lesson_status_name?: string
  is_converted_calculated?: boolean
  matched_teacher?: string
  confirmed_teacher?: string
  created_at: string
}

interface Classroom {
  class_id: number
  name: string
  class_status?: number
  class_type?: number
  start_time?: number
  end_time?: number
  course_id?: number
  course_name?: string
  created_at: string
}

interface VisitRecord {
  id: string
  student_id: string
  visit_date: string
  visit_method: string
  parent_attitude?: string
  visit_notes: string
  visit_personnel: string
  next_visit_date?: string
  created_at: string
  visit_personnel_name?: string
}

interface Course {
  id: string
  order_id: string
  classin_course_id?: number
  course_name?: string
  subject?: string
  grade?: string
  teacher_id?: string
  teacher_name?: string
  session_count: number
  total_hours: number
  course_status: string
  course_consumption_info?: string
  notes?: string
  created_at: string
  updated_at: string
  order_number?: string
}

interface StatusHistory {
  id: string
  student_id: string
  old_status: string | null
  new_status: string
  reason: string | null
  changed_by: string | null
  changed_at: string
  operator_name?: string
}

// 订单类型映射
const ORDER_TYPE_MAP: Record<string, string> = {
  'new': '新签',
  'renew': '续费',
  'extend': '扩课',
}

// 订单状态映射
const ORDER_STATUS_MAP: Record<string, string> = {
  'active': '有效',
  'paused': '暂停',
  'completed': '完成',
  'cancelled': '取消',
}

// 课堂状态映射
const CLASS_STATUS_MAP: Record<number, string> = {
  0: '未开始',
  1: '进行中',
  2: '已结束',
}

// 家长态度颜色映射
const PARENT_ATTITUDE_COLORS: Record<string, string> = {
  'very_satisfied': 'bg-green-100 text-green-800',
  'satisfied': 'bg-blue-100 text-blue-800',
  'neutral': 'bg-yellow-100 text-yellow-800',
  'dissatisfied': 'bg-red-100 text-red-800',
}

// 课程状态映射
const COURSE_STATUS_MAP: Record<string, string> = {
  'active': '进行中',
  'completed': '已完成',
  'suspended': '已暂停',
  'cancelled': '已取消',
}

// 辅助函数：解析课程消耗信息
const parseConsumptionInfo = (info: string | null | undefined): { totalSessions: number; completedSessions: number; progress: number } => {
  if (!info) return { totalSessions: 0, completedSessions: 0, progress: 0 }
  try {
    return JSON.parse(info)
  } catch {
    return { totalSessions: 0, completedSessions: 0, progress: 0 }
  }
}

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // 字典数据
  const [visitMethods, setVisitMethods] = useState<DictionaryItem[]>([])
  const [parentAttitudes, setParentAttitudes] = useState<DictionaryItem[]>([])

  // 回访表单状态
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false)
  const [visitForm, setVisitForm] = useState({
    visit_method: '',
    parent_attitude: '',
    visit_notes: '',
  })

  useEffect(() => {
    // 加载字典数据
    const loadDictionaries = async () => {
      try {
        const [methods, attitudes] = await Promise.all([
          getDictionaryItems('visit_method'),
          getDictionaryItems('parent_attitude'),
        ])
        setVisitMethods(methods)
        setParentAttitudes(attitudes)
      } catch (error) {
        console.error('Failed to load dictionaries:', error)
      }
    }

    loadDictionaries()

    if (params.id) {
      fetchStudentDetail(params.id as string)
    }
  }, [params.id])

  // 辅助函数：根据code获取label
  const getLabelByCode = (items: DictionaryItem[], code: string): string => {
    const item = items.find(i => i.code === code)
    return item?.label || code
  }

  const fetchStudentDetail = async (id: string) => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('supabase.auth.token')

      // 获取学生基本信息和订单等数据
      const detailResponse = await fetch(`/api/students/detail?id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!detailResponse.ok) {
        throw new Error('获取学生详情失败')
      }

      const detailResult = await detailResponse.json()

      // 获取回访记录
      const visitResponse = await fetch(`/api/visit-records?student_id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      let visitRecords = []
      if (visitResponse.ok) {
        const visitResult = await visitResponse.json()
        visitRecords = visitResult.data || []
      }

      // 获取状态变更历史
      const statusHistoryResponse = await fetch(`/api/students/status-history?student_id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      let statusHistory = []
      if (statusHistoryResponse.ok) {
        const statusHistoryResult = await statusHistoryResponse.json()
        statusHistory = statusHistoryResult.data || []
      }

      // 获取回访人员信息
      const visitRecordsWithNames = await Promise.all(
        visitRecords.map(async (record: VisitRecord) => {
          try {
            const userResponse = await fetch(`/api/users?id=${record.visit_personnel}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })
            if (userResponse.ok) {
              const userResult = await userResponse.json()
              return {
                ...record,
                visit_personnel_name: userResult.data?.name || '未知',
              }
            }
          } catch (e) {
            // 忽略错误
          }
          return {
            ...record,
            visit_personnel_name: '未知',
          }
        })
      )

      setDetail({
        ...detailResult.data,
        visitRecords: visitRecordsWithNames,
        statusHistory: statusHistory,
        stats: {
          ...detailResult.data.stats,
          visitRecordsCount: visitRecordsWithNames.length,
          statusHistoryCount: statusHistory.length,
        },
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载学生详情",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 打开新建回访对话框
  const openVisitDialog = () => {
    setVisitForm({
      visit_method: '',
      parent_attitude: '',
      visit_notes: '',
    })
    setVisitDialogOpen(true)
  }

  // 提交回访记录
  const handleSubmitVisit = async () => {
    if (!detail) return

    if (!visitForm.visit_method) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择回访方式",
      })
      return
    }

    if (!visitForm.visit_notes.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写回访备注",
      })
      return
    }

    try {
      setIsSubmittingVisit(true)
      const token = localStorage.getItem('supabase.auth.token')

      const response = await fetch('/api/visit-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: detail.student.id,
          visit_date: new Date().toISOString().split('T')[0],
          visit_method: visitForm.visit_method,
          parent_attitude: visitForm.parent_attitude || null,
          visit_notes: visitForm.visit_notes.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '创建回访记录失败' }))
        throw new Error(error.error || '创建回访记录失败')
      }

      toast({
        title: "回访成功",
        description: "回访记录已创建",
      })

      setVisitDialogOpen(false)
      // 重新获取数据
      fetchStudentDetail(params.id as string)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "回访失败",
        description: error.message || "无法创建回访记录",
      })
    } finally {
      setIsSubmittingVisit(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="学生详情" description="查看学生完整信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col h-full">
        <Header title="学生详情" description="查看学生完整信息" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">未找到学生信息</p>
        </div>
      </div>
    )
  }

  const { student, orders, trialLessons, courses, classrooms, visitRecords, statusHistory, stats } = detail

  return (
    <div className="flex flex-col h-full">
      <Header title="学生详情" description={`${student.student_name} ${student.student_code ? `(${student.student_code})` : ''}`} />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="orders">订单 ({stats.formalOrdersCount})</TabsTrigger>
            <TabsTrigger value="courses">课程 ({stats.coursesCount})</TabsTrigger>
            <TabsTrigger value="trials">试听课 ({stats.trialLessonsCount})</TabsTrigger>
            <TabsTrigger value="classrooms">课堂 ({stats.classroomsCount})</TabsTrigger>
            <TabsTrigger value="visits">回访 ({stats.visitRecordsCount})</TabsTrigger>
            <TabsTrigger value="history">状态变更 ({stats.statusHistoryCount})</TabsTrigger>
          </TabsList>

          {/* 概览标签 */}
          <TabsContent value="overview" className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">正式订单</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.formalOrdersCount}</div>
                  <p className="text-xs text-muted-foreground">
                    总计 {stats.totalFormalHours} 小时
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">试听课</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.trialLessonsCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总课消金额</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">¥{stats.totalFormalAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ClassIn 课堂</CardTitle>
                  <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.classroomsCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">回访记录</CardTitle>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.visitRecordsCount}</div>
                </CardContent>
              </Card>
            </div>

            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">学生姓名</p>
                      <p className="font-medium">{student.student_name}</p>
                    </div>
                  </div>
                  {student.student_code && (
                    <div className="flex items-start gap-3">
                      <School className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">学生编号</p>
                        <p className="font-medium">{student.student_code}</p>
                      </div>
                    </div>
                  )}
                  {student.grade_code && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">年级</p>
                        <p className="font-medium">{student.grade_code}</p>
                      </div>
                    </div>
                  )}
                  {student.region && (
                    <div className="flex items-start gap-3">
                      <School className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">地区</p>
                        <p className="font-medium">{student.region}</p>
                      </div>
                    </div>
                  )}
                  {student.school && (
                    <div className="flex items-start gap-3">
                      <School className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">学校</p>
                        <p className="font-medium">{student.school}</p>
                      </div>
                    </div>
                  )}
                  {student.parent_phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">家长电话</p>
                        <p className="font-medium">{student.parent_phone}</p>
                      </div>
                    </div>
                  )}
                  {student.head_teacher && (
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">班主任</p>
                        <p className="font-medium">{student.head_teacher.name}</p>
                      </div>
                    </div>
                  )}
                  {student.classin_uid && (
                    <div className="flex items-start gap-3">
                      <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">ClassIn UID</p>
                        <p className="font-medium">{student.classin_uid}</p>
                      </div>
                    </div>
                  )}
                  {student.classin_initial_password && (
                    <div className="flex items-start gap-3">
                      <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">ClassIn 初始密码</p>
                        <p className="font-medium">{student.classin_initial_password}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground pt-4 border-t">
                  注册时间: {format(new Date(student.created_at), 'yyyy-MM-dd HH:mm')}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 正式订单标签 */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>正式订单列表</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无正式订单</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>订单号</TableHead>
                          <TableHead>订单类型</TableHead>
                          <TableHead>签约顾问</TableHead>
                          <TableHead>老师</TableHead>
                          <TableHead>科目</TableHead>
                          <TableHead>总课时</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>创建时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.order_number || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ORDER_TYPE_MAP[order.order_type] || order.order_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{order.consultant_teacher}</TableCell>
                            <TableCell>{order.teacher_names.join(', ')}</TableCell>
                            <TableCell>{order.subjects.join(', ')}</TableCell>
                            <TableCell>{order.total_hours} 小时</TableCell>
                            <TableCell>¥{order.payment_amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant={order.status === 'active' ? 'default' : 'secondary'}
                              >
                                {ORDER_STATUS_MAP[order.status] || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(order.created_at), 'yyyy-MM-dd')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 课程标签 */}
          <TabsContent value="courses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>课程列表</CardTitle>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无课程记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>订单号</TableHead>
                          <TableHead>课程名称</TableHead>
                          <TableHead>学科</TableHead>
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
                        {courses.map((course) => {
                          const consumption = parseConsumptionInfo(course.course_consumption_info)
                          return (
                            <TableRow key={course.id}>
                              <TableCell className="font-medium">{course.order_number || '-'}</TableCell>
                              <TableCell>{course.course_name || '-'}</TableCell>
                              <TableCell>{course.subject || '-'}</TableCell>
                              <TableCell>{course.teacher_name || '-'}</TableCell>
                              <TableCell>{consumption.totalSessions || course.session_count || 0}</TableCell>
                              <TableCell>{course.total_hours || 0} 小时</TableCell>
                              <TableCell>
                                {consumption.totalSessions > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-blue-600 h-2 rounded-full"
                                        style={{ width: `${consumption.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs">{consumption.progress}%</span>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {COURSE_STATUS_MAP[course.course_status] || course.course_status}
                                </Badge>
                              </TableCell>
                              <TableCell>{format(new Date(course.created_at), 'yyyy-MM-dd')}</TableCell>
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
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 试听课标签 */}
          <TabsContent value="trials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>试听课列表</CardTitle>
              </CardHeader>
              <CardContent>
                {trialLessons.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无试听课记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>孩子称呼</TableHead>
                          <TableHead>地区</TableHead>
                          <TableHead>年级</TableHead>
                          <TableHead>试听科目</TableHead>
                          <TableHead>试听时间</TableHead>
                          <TableHead>时长</TableHead>
                          <TableHead>匹配老师</TableHead>
                          <TableHead>确认老师</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>是否转化</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialLessons.map((lesson) => (
                          <TableRow key={lesson.id}>
                            <TableCell className="font-medium">{lesson.child_name}</TableCell>
                            <TableCell>{lesson.region}</TableCell>
                            <TableCell>{lesson.grade}</TableCell>
                            <TableCell>{lesson.trial_subject}</TableCell>
                            <TableCell>{format(new Date(lesson.trial_time), 'yyyy-MM-dd HH:mm')}</TableCell>
                            <TableCell>{lesson.trial_duration} 分钟</TableCell>
                            <TableCell>{lesson.matched_teacher || '-'}</TableCell>
                            <TableCell>{lesson.confirmed_teacher || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {lesson.lesson_status_name || lesson.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {lesson.is_converted_calculated !== undefined ? (
                                <Badge variant={lesson.is_converted_calculated ? 'default' : 'secondary'}>
                                  {lesson.is_converted_calculated ? '已转化' : '未转化'}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ClassIn 课堂标签 */}
          <TabsContent value="classrooms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ClassIn 课堂记录</CardTitle>
              </CardHeader>
              <CardContent>
                {classrooms.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无课堂记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>课堂名称</TableHead>
                          <TableHead>课程名称</TableHead>
                          <TableHead>开始时间</TableHead>
                          <TableHead>结束时间</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>类型</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classrooms.map((classroom) => (
                          <TableRow key={classroom.class_id}>
                            <TableCell className="font-medium">{classroom.name}</TableCell>
                            <TableCell>{classroom.course_name || '-'}</TableCell>
                            <TableCell>
                              {classroom.start_time
                                ? format(new Date(classroom.start_time * 1000), 'yyyy-MM-dd HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {classroom.end_time
                                ? format(new Date(classroom.end_time * 1000), 'yyyy-MM-dd HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {CLASS_STATUS_MAP[classroom.class_status ?? 0] ?? '未知'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {classroom.class_type === 1 ? '正式课' : '试听课'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 回访记录标签 */}
          <TabsContent value="visits" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>回访记录</CardTitle>
                <Button onClick={openVisitDialog} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  新建回访
                </Button>
              </CardHeader>
              <CardContent>
                {visitRecords.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无回访记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>回访日期</TableHead>
                          <TableHead>回访方式</TableHead>
                          <TableHead>家长态度</TableHead>
                          <TableHead>回访备注</TableHead>
                          <TableHead>回访人员</TableHead>
                          <TableHead>创建时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {format(new Date(record.visit_date), 'yyyy-MM-dd')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {getLabelByCode(visitMethods, record.visit_method)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {record.parent_attitude ? (
                                <Badge className={PARENT_ATTITUDE_COLORS[record.parent_attitude]}>
                                  {getLabelByCode(parentAttitudes, record.parent_attitude)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {record.visit_notes}
                            </TableCell>
                            <TableCell>{record.visit_personnel_name || '未知'}</TableCell>
                            <TableCell>
                              {format(new Date(record.created_at), 'yyyy-MM-dd HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 状态变更历史标签 */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>状态变更历史</CardTitle>
                <History className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statusHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无状态变更记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>变更时间</TableHead>
                          <TableHead>原状态</TableHead>
                          <TableHead>新状态</TableHead>
                          <TableHead>变更原因</TableHead>
                          <TableHead>操作人</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusHistory.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {format(new Date(record.changed_at), 'yyyy-MM-dd HH:mm')}
                            </TableCell>
                            <TableCell>
                              {record.old_status ? (
                                <Badge className={getStudentStatusBadgeClass(record.old_status)}>
                                  {getStudentStatusLabel(record.old_status)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStudentStatusBadgeClass(record.new_status)}>
                                {getStudentStatusLabel(record.new_status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              {record.reason || (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.operator_name || '未知'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 新建回访对话框 */}
      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建回访记录</DialogTitle>
            <DialogDescription>
              为学生 <span className="font-semibold">{student.student_name}</span> 添加回访记录
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="visit_method">回访方式 *</Label>
              <Select
                value={visitForm.visit_method}
                onValueChange={(value) => setVisitForm({ ...visitForm, visit_method: value })}
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
                value={visitForm.parent_attitude}
                onValueChange={(value) => setVisitForm({ ...visitForm, parent_attitude: value })}
              >
                <SelectTrigger id="parent_attitude">
                  <SelectValue placeholder="请选择家长态度" />
                </SelectTrigger>
                <SelectContent>
                  {parentAttitudes.map((attitude) => (
                    <SelectItem key={attitude.code} value={attitude.code}>
                      {attitude.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit_notes">回访备注 *</Label>
              <Textarea
                id="visit_notes"
                placeholder="请输入回访备注内容"
                value={visitForm.visit_notes}
                onChange={(e) => setVisitForm({ ...visitForm, visit_notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitVisit} disabled={isSubmittingVisit}>
              {isSubmittingVisit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交回访"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
