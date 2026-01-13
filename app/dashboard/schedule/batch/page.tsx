"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2, Calendar, Clock, User, GraduationCap } from "lucide-react"
import { FormalOrdersService } from "@/lib/services/formalOrders"
import { StudentsService } from "@/lib/services/students"
import { TeachersService } from "@/lib/services/teachers"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { api } from "@/lib/fetch"

interface ScheduleItem {
  id: string
  studentId: string
  studentName: string
  teacherId: string
  teacherName: string
  subject: string
  date: string
  startTime: string
  endTime: string
  classroom?: string
}

export default function BatchSchedulePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 订单数据
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [orders, setOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  // 可编辑的排课参数
  const [editableParams, setEditableParams] = useState({
    totalSessions: 0,
    sessionDuration: 60,
    frequency: '1_per_week',
    startDate: '', // 开课日期 YYYY-MM-DD
    startTime: '14:00', // 开课时间 HH:mm
  })

  // 字典数据
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')
  const { items: frequencies } = useDictionary('class_frequency')

  // 排课列表
  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>([])

  // 全选
  const [selectAll, setSelectAll] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // 加载订单数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const orderData = await FormalOrdersService.getAllFormalOrders()
        // 只显示进行中的订单
        setOrders(orderData.filter((order: any) => order.status === 'active'))
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载数据",
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // 根据频次计算日期间隔
  const getDaysBetweenSessions = (frequency: string): number => {
    switch (frequency) {
      case 'workdays': return 1  // 工作日每天
      case '1_per_week': return 7  // 一周一次
      case '2_per_week': return 3.5  // 一周两次
      case '3_per_week': return 7 / 3  // 一周三约
      case '4_per_week': return 1.75  // 一周四约
      case '5_per_week': return 1.4  // 一周五约
      case '6_per_week': return 7 / 6  // 一周六约
      case '7_per_week': return 1  // 一周七次（每天）
      case 'other': return 7  // 其他，默认一周一次
      default: return 7
    }
  }

  // 选择订单时预览排课信息
  const handleOrderChange = async (orderId: string) => {
    setSelectedOrderId(orderId)
    setScheduleList([])
    setSelectedItems(new Set())

    if (!orderId) {
      setSelectedOrder(null)
      return
    }

    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        throw new Error("订单不存在")
      }

      // 获取学生信息
      const student = await StudentsService.getStudentById(order.student_id)

      const orderWithStudent = { ...order, student_name: student.student_name }
      setSelectedOrder(orderWithStudent)

      // 将订单的 frequency 转换为字典 code
      const frequencyItem = frequencies.find(f => f.label === order.frequency)
      const frequencyCode = frequencyItem?.code || '1_per_week'

      // 解析开课日期和时间，如果订单没有 official_start_time，默认下周
      let startDate = ''
      let startTime = '14:00'
      if (order.official_start_time) {
        const datetime = new Date(order.official_start_time)
        startDate = format(datetime, 'yyyy-MM-dd')
        startTime = format(datetime, 'HH:mm')
      } else {
        // 默认下周今天 14:00
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        startDate = format(nextWeek, 'yyyy-MM-dd')
      }

      // 初始化可编辑参数
      const params = {
        totalSessions: order.total_sessions || 1,
        sessionDuration: order.session_duration || 60,
        frequency: frequencyCode,
        startDate: startDate,
        startTime: startTime,
      }
      setEditableParams(params)

      // 加载已有的课节
      try {
        const courseResp = await api.get(`/api/courses/by-order/${orderId}`)
        if (courseResp.ok) {
          const courseData = await courseResp.json()
          if (courseData.data) {
            const course = courseData.data
            // 获取该课程的所有课节（按日期排序）
            const sessionsResp = await api.get(`/api/class-sessions?course_id=${course.id}`)
            if (sessionsResp.ok) {
              const sessionsData = await sessionsResp.json()
              if (sessionsData.data && sessionsData.data.length > 0) {
                // 按日期排序已有课节
                const sortedSessions = sessionsData.data.sort((a: any, b: any) =>
                  new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
                )

                // 将已有课节转换为 scheduleItem 格式
                const existingSessions: ScheduleItem[] = sortedSessions.map((session: any) => ({
                  id: session.id,
                  studentId: order.student_id,
                  studentName: student.student_name || "未知学生",
                  teacherId: session.teacher_id || "",
                  teacherName: session.teacher_name || "未分配",
                  subject: order.subjects?.[0] || "",
                  date: session.scheduled_date,
                  startTime: session.scheduled_time_start || "",
                  endTime: session.scheduled_time_end || "",
                  classroom: session.classroom_id || "",
                }))

                // 获取最后一节课的日期
                const lastSession = sortedSessions[sortedSessions.length - 1]
                const lastDate = lastSession.scheduled_date

                // 从最后一节课的日期开始，根据频次生成后续课程
                const { totalSessions, sessionDuration, frequency } = params
                const daysBetween = getDaysBetweenSessions(frequency)

                // 计算还需要生成多少节课（总共 - 已有）
                const remainingSessions = totalSessions - existingSessions.length
                const newSessions: ScheduleItem[] = []

                for (let i = 0; i < remainingSessions; i++) {
                  const scheduleDate = new Date(lastDate)
                  scheduleDate.setDate(scheduleDate.getDate() + Math.floor((i + 1) * daysBetween))

                  const sessionStartTime = startTime
                  const [hour, minute] = startTime.split(':').map(Number)
                  const totalMinutes = hour * 60 + minute + sessionDuration
                  const endHour = Math.floor(totalMinutes / 60)
                  const endMinute = totalMinutes % 60
                  const sessionEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

                  newSessions.push({
                    id: `preview-${order.id}-${i}`,
                    studentId: order.student_id,
                    studentName: student.student_name || "未知学生",
                    teacherId: order.teacher_names?.[0] || "",
                    teacherName: order.teacher_names?.[0] || "未分配",
                    subject: order.subjects?.[0] || "",
                    date: format(scheduleDate, 'yyyy-MM-dd'),
                    startTime: sessionStartTime,
                    endTime: sessionEndTime,
                    classroom: "",
                  })
                }

                // 合并已有课节和新课节，已有课节在前
                setScheduleList([...existingSessions, ...newSessions])

                toast({
                  title: "已加载课节列表",
                  description: `已有 ${existingSessions.length} 节，新增 ${newSessions.length} 节`,
                })
                return
              }
            }
          }
        }
      } catch (error) {
        // 忽略加载已有课节的错误，继续生成
        console.warn("加载已有课节失败:", error)
      }

      // 如果没有已有课节，生成所有课程
      const newSessions: ScheduleItem[] = []
      const { totalSessions, sessionDuration, frequency } = params
      const daysBetween = getDaysBetweenSessions(frequency)

      for (let i = 0; i < totalSessions; i++) {
        const scheduleDate = new Date(startDate)
        scheduleDate.setDate(scheduleDate.getDate() + Math.floor(i * daysBetween))

        const sessionStartTime = startTime
        const [hour, minute] = startTime.split(':').map(Number)
        const totalMinutes = hour * 60 + minute + sessionDuration
        const endHour = Math.floor(totalMinutes / 60)
        const endMinute = totalMinutes % 60
        const sessionEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

        newSessions.push({
          id: `preview-${order.id}-${i}`,
          studentId: order.student_id,
          studentName: student.student_name || "未知学生",
          teacherId: order.teacher_names?.[0] || "",
          teacherName: order.teacher_names?.[0] || "未分配",
          subject: order.subjects?.[0] || "",
          date: format(scheduleDate, 'yyyy-MM-dd'),
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          classroom: "",
        })
      }

      setScheduleList(newSessions)

      toast({
        title: "已生成排课列表",
        description: `共 ${newSessions.length} 节课程`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载订单信息",
      })
    }
  }

  // 更新排课项
  const updateScheduleItem = (id: string, field: keyof ScheduleItem, value: string) => {
    setScheduleList(scheduleList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  // 根据当前参数重新生成课表
  const regenerateSchedule = async () => {
    if (!selectedOrder || !selectedOrderId) return

    try {
      // 加载已有的课节
      let existingSessions: ScheduleItem[] = []
      let lastDate = editableParams.startDate

      try {
        const courseResp = await api.get(`/api/courses/by-order/${selectedOrderId}`)
        if (courseResp.ok) {
          const courseData = await courseResp.json()
          if (courseData.data) {
            const course = courseData.data
            const sessionsResp = await api.get(`/api/class-sessions?course_id=${course.id}`)
            if (sessionsResp.ok) {
              const sessionsData = await sessionsResp.json()
              if (sessionsData.data && sessionsData.data.length > 0) {
                const sortedSessions = sessionsData.data.sort((a: any, b: any) =>
                  new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
                )

                existingSessions = sortedSessions.map((session: any) => ({
                  id: session.id,
                  studentId: selectedOrder.student_id,
                  studentName: selectedOrder.student_name || "未知学生",
                  teacherId: session.teacher_id || "",
                  teacherName: session.teacher_name || "未分配",
                  subject: selectedOrder.subjects?.[0] || "",
                  date: session.scheduled_date,
                  startTime: session.scheduled_time_start || "",
                  endTime: session.scheduled_time_end || "",
                  classroom: session.classroom_id || "",
                }))

                const lastSession = sortedSessions[sortedSessions.length - 1]
                lastDate = lastSession.scheduled_date
              }
            }
          }
        }
      } catch (error) {
        console.warn("加载已有课节失败:", error)
      }

      // 根据当前参数生成新课节
      const { totalSessions, sessionDuration, frequency, startDate, startTime } = editableParams
      const daysBetween = getDaysBetweenSessions(frequency)
      const remainingSessions = totalSessions - existingSessions.length
      const newSessions: ScheduleItem[] = []

      // 从最后一节课（或开始日期）开始生成
      const baseDate = existingSessions.length > 0 ? lastDate : startDate

      for (let i = 0; i < remainingSessions; i++) {
        const scheduleDate = new Date(baseDate)
        scheduleDate.setDate(scheduleDate.getDate() + Math.floor((i + 1) * daysBetween))

        const sessionStartTime = startTime
        const [hour, minute] = startTime.split(':').map(Number)
        const totalMinutes = hour * 60 + minute + sessionDuration
        const endHour = Math.floor(totalMinutes / 60)
        const endMinute = totalMinutes % 60
        const sessionEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

        newSessions.push({
          id: `preview-${selectedOrder.id}-${Date.now()}-${i}`,
          studentId: selectedOrder.student_id,
          studentName: selectedOrder.student_name || "未知学生",
          teacherId: selectedOrder.teacher_names?.[0] || "",
          teacherName: selectedOrder.teacher_names?.[0] || "未分配",
          subject: selectedOrder.subjects?.[0] || "",
          date: format(scheduleDate, 'yyyy-MM-dd'),
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          classroom: "",
        })
      }

      // 合并已有课节和新课节
      setScheduleList([...existingSessions, ...newSessions])

      toast({
        title: "已重新生成排课列表",
        description: existingSessions.length > 0
          ? `保留 ${existingSessions.length} 节已有课节，新增 ${newSessions.length} 节课`
          : `已生成 ${newSessions.length} 节新课`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "重新生成失败",
        description: error.message || "无法重新生成排课列表",
      })
    }
  }

  // 删除排课项
  const removeScheduleItem = (id: string) => {
    setScheduleList(scheduleList.filter(item => item.id !== id))
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  // 批量删除选中的项
  const removeSelectedItems = () => {
    setScheduleList(scheduleList.filter(item => !selectedItems.has(item.id)))
    setSelectedItems(new Set())
    setSelectAll(false)
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(scheduleList.map(item => item.id)))
    }
    setSelectAll(!selectAll)
  }

  // 选择单个项
  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 批量提交排课
  const handleSubmit = async () => {
    if (!selectedOrderId) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请先选择订单",
      })
      return
    }

    if (scheduleList.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请先添加排课信息",
      })
      return
    }

    // 区分已有课节和新课节
    const existingSessions = scheduleList.filter(item =>
      !item.id.startsWith('preview-') &&
      !item.id.startsWith('schedule-') &&
      !item.id.startsWith('manual-')
    )
    const newSessions = scheduleList.filter(item =>
      item.id.startsWith('preview-') ||
      item.id.startsWith('schedule-') ||
      item.id.startsWith('manual-')
    )

    // 如果全部是已有课节，提示用户
    if (newSessions.length === 0) {
      toast({
        variant: "destructive",
        title: "没有新课节需要创建",
        description: `该订单已创建 ${existingSessions.length} 节课程，请添加新课节后再提交`,
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        orderId: selectedOrderId,
        items: newSessions.map(item => ({
          studentName: item.studentName,
          teacherName: item.teacherName,
          subject: item.subject,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
        }))
      }
      const resp = await api.post("/api/schedule/batch/create-classin", payload)
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "批量排课失败" }))
        throw new Error(err.error || "批量排课失败")
      }
      const result = await resp.json()

      toast({
        title: "排课成功",
        description: existingSessions.length > 0
          ? `已跳过 ${existingSessions.length} 节已有课程，成功创建 ${result.success}/${result.total} 节新课`
          : `已成功创建 ${result.success}/${result.total} 节课程`,
      })

      router.push("/dashboard/classroom")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "排课失败",
        description: error.message || "无法创建课程",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="批量排课" description="从正式订单批量创建课程" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="批量排课" description="从正式订单批量创建课程" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 订单选择区 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">1. 选择正式订单</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order">选择订单</Label>
                  <select
                    id="order"
                    value={selectedOrderId}
                    onChange={(e) => handleOrderChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">请选择正式订单</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} - {order.student_name} ({order.subjects?.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOrder && (
                  <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">订单信息</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={regenerateSchedule}
                      >
                        重新生成
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">学生姓名：</span>
                        <span className="font-medium">{selectedOrder.student_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">科目：</span>
                        <span className="font-medium">{selectedOrder.subjects?.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">老师：</span>
                        <span className="font-medium">{selectedOrder.teacher_names?.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">排课模式：</span>
                        <span className="font-medium">{selectedOrder.fixed_mode}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">开课日期：</span>
                        <Input
                          type="date"
                          value={editableParams.startDate}
                          onChange={(e) => setEditableParams(p => ({ ...p, startDate: e.target.value }))}
                          className="h-7 w-32 inline-block align-middle ml-1"
                        />
                      </div>
                      <div>
                        <span className="text-muted-foreground">开课时间：</span>
                        <Input
                          type="time"
                          value={editableParams.startTime}
                          onChange={(e) => setEditableParams(p => ({ ...p, startTime: e.target.value }))}
                          className="h-7 w-24 inline-block align-middle ml-1"
                        />
                      </div>
                      <div>
                        <span className="text-muted-foreground">总课时：</span>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={editableParams.totalSessions}
                          onChange={(e) => setEditableParams(p => ({ ...p, totalSessions: parseInt(e.target.value) || 1 }))}
                          className="h-7 w-20 inline-block align-middle ml-1"
                        />
                      </div>
                      <div>
                        <span className="text-muted-foreground">课时时长：</span>
                        <Input
                          type="number"
                          min={15}
                          max={300}
                          step={15}
                          value={editableParams.sessionDuration}
                          onChange={(e) => setEditableParams(p => ({ ...p, sessionDuration: parseInt(e.target.value) || 60 }))}
                          className="h-7 w-20 inline-block align-middle ml-1"
                        />
                        <span className="text-muted-foreground ml-1">分钟</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">课程频次：</span>
                        <Select
                          value={editableParams.frequency}
                          onValueChange={(value) => setEditableParams(p => ({ ...p, frequency: value }))}
                        >
                          <SelectTrigger className="h-7 w-28 inline-block ml-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {frequencies.map((freq) => (
                              <SelectItem key={freq.code} value={freq.code}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 排课列表区 */}
          {scheduleList.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">2. 排课列表</h3>
                    <div className="flex gap-3 mt-1">
                      {scheduleList.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          共 {scheduleList.length} 节课
                        </span>
                      )}
                      {/* 统计已有课节数量 */}
                      {scheduleList.some(item =>
                        !item.id.startsWith('preview-') &&
                        !item.id.startsWith('schedule-') &&
                        !item.id.startsWith('manual-')
                      ) && (
                        <span className="text-sm font-normal text-green-600">
                          已创建 {
                            scheduleList.filter(item =>
                              !item.id.startsWith('preview-') &&
                              !item.id.startsWith('schedule-') &&
                              !item.id.startsWith('manual-')
                            ).length
                          } 节
                        </span>
                      )}
                      {/* 统计新课节数量 */}
                      {scheduleList.some(item =>
                        item.id.startsWith('preview-') ||
                        item.id.startsWith('schedule-') ||
                        item.id.startsWith('manual-')
                      ) && (
                        <span className="text-sm font-normal text-blue-600">
                          待创建 {
                            scheduleList.filter(item =>
                              item.id.startsWith('preview-') ||
                              item.id.startsWith('schedule-') ||
                              item.id.startsWith('manual-')
                            ).length
                          } 节
                        </span>
                      )}
                    </div>
                  </div>
                <div className="flex gap-2">
                  {selectedItems.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeSelectedItems}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除选中 ({selectedItems.size})
                    </Button>
                  )}
                </div>
              </div>

              {scheduleList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无排课信息</p>
                  <p className="text-sm mt-2">请选择订单，系统将自动生成排课列表</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="w-16">序号</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>时间段</TableHead>
                        <TableHead>学生</TableHead>
                        <TableHead>老师</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead>教室</TableHead>
                        <TableHead className="w-24 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleList.map((item, index) => {
                        const isExisting = !item.id.startsWith('preview-') &&
                          !item.id.startsWith('schedule-') &&
                          !item.id.startsWith('manual-')

                        return (
                          <TableRow
                            key={item.id}
                            className={isExisting ? "bg-green-50" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedItems.has(item.id)}
                                onCheckedChange={() => !isExisting && handleSelectItem(item.id)}
                                disabled={isExisting}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {index + 1}
                              {isExisting && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  已创建
                                </span>
                              )}
                            </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateScheduleItem(item.id, 'date', e.target.value)}
                              className="h-9"
                              disabled={isExisting}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={item.startTime}
                                onChange={(e) => updateScheduleItem(item.id, 'startTime', e.target.value)}
                                className="h-9 w-24"
                                disabled={isExisting}
                              />
                              <span>-</span>
                              <Input
                                type="time"
                                value={item.endTime}
                                onChange={(e) => updateScheduleItem(item.id, 'endTime', e.target.value)}
                                className="h-9 w-24"
                                disabled={isExisting}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{item.studentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{item.teacherName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <select
                              value={item.subject}
                              onChange={(e) => updateScheduleItem(item.id, 'subject', e.target.value)}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              disabled={isExisting}
                            >
                              <option value="">请选择</option>
                              {subjects.map((subject) => (
                                <option key={subject.code} value={subject.label}>
                                  {subject.label}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="教室号"
                              value={item.classroom}
                              onChange={(e) => updateScheduleItem(item.id, 'classroom', e.target.value)}
                              className="h-9"
                              disabled={isExisting}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {!isExisting && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeScheduleItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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
          )}

          {/* 提交按钮区 */}
          {scheduleList.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <p>已选择 {selectedItems.size} 项，共 {scheduleList.length} 节课</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.back()}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || scheduleList.length === 0}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        <>
                          <Calendar className="mr-2 h-4 w-4" />
                          确认排课
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
