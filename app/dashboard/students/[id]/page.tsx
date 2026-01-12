"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, FileText, BookOpen, Video, User, Phone, Mail, School, Calendar, DollarSign, Clock } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

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
  classrooms: Classroom[]
  stats: {
    formalOrdersCount: number
    trialLessonsCount: number
    classroomsCount: number
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

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (params.id) {
      fetchStudentDetail(params.id as string)
    }
  }, [params.id])

  const fetchStudentDetail = async (id: string) => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('supabase.auth.token')
      const response = await fetch(`/api/students/detail?id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('获取学生详情失败')
      }

      const { data } = await response.json()
      setDetail(data)
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

  const { student, orders, trialLessons, classrooms, stats } = detail

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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="orders">订单 ({stats.formalOrdersCount})</TabsTrigger>
            <TabsTrigger value="trials">试听课 ({stats.trialLessonsCount})</TabsTrigger>
            <TabsTrigger value="classrooms">课堂 ({stats.classroomsCount})</TabsTrigger>
          </TabsList>

          {/* 概览标签 */}
          <TabsContent value="overview" className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </Tabs>
      </div>
    </div>
  )
}
