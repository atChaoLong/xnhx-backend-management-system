"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { WeeklySchedulePicker, type WeeklySchedule } from "@/components/ui/weekly-schedule-picker"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { TimePicker } from "@/components/ui/time-picker"
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw, Trash2, Calendar, Clock, User, GraduationCap } from "lucide-react"
import { FormalOrdersService } from "@/lib/services/formalOrders"
import { StudentsService } from "@/lib/services/students"
import { TeachersService } from "@/lib/services/teachers"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { format, getDay } from "date-fns"
import { cn } from "@/lib/utils"
import { api } from "@/lib/fetch"
import { summarizeError } from "@/lib/safe-error"

// 星期几映射
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 获取日期的星期几显示
const getWeekdayDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    const dayIndex = getDay(date)
    return WEEKDAY_NAMES[dayIndex]
  } catch {
    return ''
  }
}

const getOrderStudentName = (order: any): string => {
  return order?.student_name || order?.students?.student_name || ""
}

const withOrderStudentName = (order: any) => ({
  ...order,
  student_name: getOrderStudentName(order),
})

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

interface SchedulePrecheckIssue {
  index: number
  type: "error" | "warning"
  message: string
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
  const [precheckIssues, setPrecheckIssues] = useState<SchedulePrecheckIssue[]>([])
  const [isPrechecking, setIsPrechecking] = useState(false)
  const [precheckCheckedAt, setPrecheckCheckedAt] = useState<string | null>(null)

  // 已扣课时（小时）
  const [existingHoursCount, setExistingHoursCount] = useState(0)

  // 全选
  const [selectAll, setSelectAll] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // 排课模式：单节课 vs 班级课
  const [scheduleMode, setScheduleMode] = useState<'single' | 'class'>('single')

  // 班级名称
  const [className, setClassName] = useState('')

  // 每周重复规则：每周开课时间一样 vs 每周开课时间自定义
  const [repeatMode, setRepeatMode] = useState<'same' | 'custom'>('same')

  // 每周时间配置（用于班级课自定义模式）
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  })

  // 加载订单数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const orderData = await FormalOrdersService.getAllFormalOrders()
        // 只显示进行中的订单
        const activeOrders = orderData.filter((order: any) => order.status === 'active')

        const ordersWithStudentNames = activeOrders.map(withOrderStudentName)

        setOrders(ordersWithStudentNames)

        // 检查 URL 参数，自动选择订单
        const params = new URLSearchParams(window.location.search)
        const orderId = params.get('order_id')

        if (orderId) {
          const targetOrder = ordersWithStudentNames.find((o: any) => o.id === orderId)
          if (targetOrder) {
            setSelectedOrderId(orderId)
            setSelectedOrder(targetOrder)

            // 自动填充参数
            setEditableParams((prev) => ({
              ...prev,
              totalSessions: targetOrder.total_hours || 0,
            }))

            toast({
              title: "已自动选择订单",
              description: `订单：${targetOrder.order_number}`,
            })
          }
        }
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

  // 计算课程结束时间
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hour, minute] = startTime.split(':').map(Number)
    const totalMinutes = hour * 60 + minute + durationMinutes
    const endHour = Math.floor(totalMinutes / 60)
    const endMinute = totalMinutes % 60
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
  }

  // 统一时间格式为 HH:mm（去掉秒数）
  const normalizeTimeFormat = (time: string): string => {
    if (!time) return time
    // 如果包含秒数，去掉秒数
    const parts = time.split(':')
    if (parts.length >= 3) {
      return `${parts[0]}:${parts[1]}`
    }
    return time
  }

  const isNewScheduleItem = (item: ScheduleItem): boolean => {
    return item.id.startsWith('preview-') ||
      item.id.startsWith('schedule-') ||
      item.id.startsWith('manual-')
  }

  const isExistingScheduleItem = (item: ScheduleItem): boolean => !isNewScheduleItem(item)

  const buildPrecheckPayloadItems = (items: ScheduleItem[]) => {
    return items.map(item => ({
      studentName: item.studentName,
      teacherName: item.teacherName,
      subject: item.subject,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
    }))
  }

  const getScheduleDurationMinutes = (item: ScheduleItem): number => {
    const startParts = normalizeTimeFormat(item.startTime).split(':').map(Number)
    const endParts = normalizeTimeFormat(item.endTime).split(':').map(Number)

    if (startParts.length < 2 || endParts.length < 2) {
      return 0
    }

    const start = (startParts[0] || 0) * 60 + (startParts[1] || 0)
    const end = (endParts[0] || 0) * 60 + (endParts[1] || 0)
    return Math.max(end - start, 0)
  }

  const getLocalPrecheckIssues = (items: ScheduleItem[]): SchedulePrecheckIssue[] => {
    if (!selectedOrder?.total_hours) {
      return []
    }

    const newItems = items.filter(isNewScheduleItem)
    const newHours = newItems.reduce((sum, item) => sum + getScheduleDurationMinutes(item), 0) / 60
    const remainingHours = Math.max(Number(selectedOrder.total_hours) - existingHoursCount, 0)

    if (newHours > remainingHours) {
      return [{
        index: 1,
        type: "error",
        message: `待创建课时 ${newHours.toFixed(2)} 小时超过订单剩余课时 ${remainingHours.toFixed(2)} 小时`,
      }]
    }

    return []
  }

  const hasBlockingPrecheckIssue = precheckIssues.some(issue => issue.type === "error")
  const precheckErrorCount = precheckIssues.filter(issue => issue.type === "error").length
  const precheckWarningCount = precheckIssues.filter(issue => issue.type === "warning").length
  const newScheduleCount = scheduleList.filter(isNewScheduleItem).length

  // 生成班级课"每周一样"模式的课表
  const generateSameWeeklySchedule = (
    startDate: string,
    startTime: string,
    totalSessions: number,
    sessionDuration: number
  ): { date: string; startTime: string; endTime: string }[] => {
    const sessions: { date: string; startTime: string; endTime: string }[] = []
    const currentDate = new Date(startDate)

    // 从开始日期开始，每周同一时间
    for (let i = 0; i < totalSessions; i++) {
      const scheduleDate = new Date(currentDate)
      scheduleDate.setDate(scheduleDate.getDate() + i * 7)

      const endTime = calculateEndTime(startTime, sessionDuration)
      sessions.push({
        date: format(scheduleDate, 'yyyy-MM-dd'),
        startTime: startTime,
        endTime: endTime,
      })
    }

    return sessions
  }

  // 找到从指定日期开始，第一个匹配目标星期几的日期
  const findFirstMatchingDay = (startDate: string, targetDayOfWeek: number): string => {
    const currentDate = new Date(startDate)
    const currentDayOfWeek = currentDate.getDay()

    // 计算需要增加的天数
    let daysToAdd = (targetDayOfWeek - currentDayOfWeek + 7) % 7
    if (daysToAdd === 0 && currentDate.getHours() === 0) {
      // 如果刚好是目标星期几且是当天，检查是否需要推迟到下周
      // 这里简化处理，如果时间已过则推迟
    }

    currentDate.setDate(currentDate.getDate() + daysToAdd)
    return format(currentDate, 'yyyy-MM-dd')
  }

  // 生成班级课"每周自定义"模式的课表
  const generateCustomWeeklySchedule = (
    startDate: string,
    weeklySchedule: WeeklySchedule,
    totalSessions: number,
    sessionDuration: number
  ): { date: string; startTime: string; endTime: string }[] => {
    const sessions: { date: string; startTime: string; endTime: string }[] = []
    const currentDate = new Date(startDate)

    // 星期几映射（0=周日, 1=周一, ..., 6=周六）
    const dayMap: Record<keyof WeeklySchedule, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    }

    // 防止无限循环
    let daysChecked = 0
    const maxDays = 365

    while (sessions.length < totalSessions && daysChecked < maxDays) {
      const dayOfWeek = currentDate.getDay()

      // 检查当天是否有排课
      for (const [dayKey, time] of Object.entries(weeklySchedule)) {
        if (time && dayMap[dayKey as keyof WeeklySchedule] === dayOfWeek) {
          const endTime = calculateEndTime(time, sessionDuration)
          sessions.push({
            date: format(currentDate, 'yyyy-MM-dd'),
            startTime: time,
            endTime: endTime,
          })

          // 如果已生成足够的课程，提前退出
          if (sessions.length >= totalSessions) {
            break
          }
        }
      }

      // 移动到下一天
      currentDate.setDate(currentDate.getDate() + 1)
      daysChecked++
    }

    return sessions
  }

  // 选择订单时预览排课信息
  const handleOrderChange = async (orderId: string) => {
    setSelectedOrderId(orderId)
    setScheduleList([])
    setExistingHoursCount(0)
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

      const studentNameFromOrder = getOrderStudentName(order)
      let studentName = studentNameFromOrder

      if (!studentName && order.student_id) {
        try {
          const student = await StudentsService.getStudentById(order.student_id)
          studentName = student.student_name
        } catch {
          studentName = "未知学生"
        }
      }

      const orderWithStudent = { ...order, student_name: studentName }
      setSelectedOrder(orderWithStudent)

      // 自动生成班级名称：学生-老师科目课
      const teacherName = order.teacher_names?.[0] || ''
      const subject = order.subjects?.[0] || ''
      const autoClassName = `${studentName || "未知学生"}-${teacherName}${subject}课`
      setClassName(autoClassName)

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
        totalSessions: order.total_hours || 1,
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
                  studentName: studentName || "未知学生",
                  teacherId: session.teacher_id || "",
                  teacherName: session.teacher_name || "未分配",
                  subject: order.subjects?.[0] || "",
                  date: session.scheduled_date,
                  startTime: normalizeTimeFormat(session.scheduled_time_start || ""),
                  endTime: normalizeTimeFormat(session.scheduled_time_end || ""),
                  classroom: session.classroom_id || "",
                }))

                // 计算已扣课时（累加所有课节的时长，分钟转小时）
                const totalExistingMinutes = sortedSessions.reduce((sum: number, session: any) => {
                  return sum + (session.scheduled_duration_minutes || 0)
                }, 0)
                const totalExistingHours = Math.round((totalExistingMinutes / 60) * 100) / 100 // 保留两位小数

                // 获取最后一节课的日期
                const lastSession = sortedSessions[sortedSessions.length - 1]
                const lastDate = lastSession.scheduled_date

                // 从最后一节课的日期开始，根据当前模式和频次生成后续课程
                const { totalSessions, sessionDuration, frequency } = params
                const newSessions: ScheduleItem[] = []

                if (scheduleMode === 'single') {
                  // 排1节课模式：已有课节就不再生成新的
                  setScheduleList(existingSessions)
                  setExistingHoursCount(totalExistingHours)
                  toast({
                    title: "已加载课节列表",
                    description: `已有 ${existingSessions.length} 节课，共 ${totalExistingHours} 小时`,
                  })
                  return
                } else {
                  // 班级课模式：生成剩余课时
                  const daysBetween = getDaysBetweenSessions(frequency)
                  const remainingSessions = totalSessions - existingSessions.length

                  for (let i = 0; i < remainingSessions; i++) {
                    const scheduleDate = new Date(lastDate)
                    scheduleDate.setDate(scheduleDate.getDate() + Math.floor((i + 1) * daysBetween))

                    const endTime = calculateEndTime(startTime, sessionDuration)
                    newSessions.push({
                      id: `preview-${order.id}-${i}`,
                      studentId: order.student_id,
                      studentName: studentName || "未知学生",
                      teacherId: order.teacher_names?.[0] || "",
                      teacherName: order.teacher_names?.[0] || "未分配",
                      subject: order.subjects?.[0] || "",
                      date: format(scheduleDate, 'yyyy-MM-dd'),
                      startTime: startTime,
                      endTime: endTime,
                      classroom: "",
                    })
                  }

                  // 合并已有课节和新课节，已有课节在前
                  setScheduleList([...existingSessions, ...newSessions])
                  setExistingHoursCount(totalExistingHours)

                  toast({
                    title: "已加载课节列表",
                    description: `已有 ${existingSessions.length} 节，共 ${totalExistingHours} 小时，新增 ${newSessions.length} 节`,
                  })
                  return
                }
              }
            }
          }
        }
      } catch (error) {
        // 忽略加载已有课节的错误，继续生成
        console.warn("加载已有课节失败:", summarizeError(error))
      }

      // 如果没有已有课节，根据当前模式生成课程
      const newSessions: ScheduleItem[] = []
      const { totalSessions, sessionDuration, frequency } = params

      if (scheduleMode === 'single') {
        // 排1节课模式：只生成一节课
        const endTime = calculateEndTime(startTime, sessionDuration)
        newSessions.push({
          id: `preview-${order.id}-0`,
          studentId: order.student_id,
          studentName: studentName || "未知学生",
          teacherId: order.teacher_names?.[0] || "",
          teacherName: order.teacher_names?.[0] || "未分配",
          subject: order.subjects?.[0] || "",
          date: startDate,
          startTime: startTime,
          endTime: endTime,
          classroom: "",
        })
      } else {
        // 班级课模式：生成所有课程
        const daysBetween = getDaysBetweenSessions(frequency)

        for (let i = 0; i < totalSessions; i++) {
          const scheduleDate = new Date(startDate)
          scheduleDate.setDate(scheduleDate.getDate() + Math.floor(i * daysBetween))

          const endTime = calculateEndTime(startTime, sessionDuration)
          newSessions.push({
            id: `preview-${order.id}-${i}`,
            studentId: order.student_id,
            studentName: studentName || "未知学生",
            teacherId: order.teacher_names?.[0] || "",
            teacherName: order.teacher_names?.[0] || "未分配",
            subject: order.subjects?.[0] || "",
            date: format(scheduleDate, 'yyyy-MM-dd'),
            startTime: startTime,
            endTime: endTime,
            classroom: "",
          })
        }
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
      // 班级课模式验证
      if (scheduleMode === 'class') {
        if (repeatMode === 'custom') {
          const selectedDays = Object.values(weeklySchedule).filter((v): v is string => v !== null)
          if (selectedDays.length === 0) {
            toast({
              variant: "destructive",
              title: "请选择上课时间",
              description: "请至少选择一天的课程时间",
            })
            return
          }
        }
      }

      // 加载已有的课节
      let existingSessions: ScheduleItem[] = []
      let lastDate = editableParams.startDate
      let totalExistingHours = 0 // 已扣课时（小时）

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
                  startTime: normalizeTimeFormat(session.scheduled_time_start || ""),
                  endTime: normalizeTimeFormat(session.scheduled_time_end || ""),
                  classroom: session.classroom_id || "",
                }))

                // 计算已扣课时（累加所有课节的时长，分钟转小时）
                if (sortedSessions.length > 0) {
                  const totalExistingMinutes = sortedSessions.reduce((sum: number, session: any) => {
                    return sum + (session.scheduled_duration_minutes || 0)
                  }, 0)
                  totalExistingHours = Math.round((totalExistingMinutes / 60) * 100) / 100
                }

                const lastSession = sortedSessions[sortedSessions.length - 1]
                lastDate = lastSession.scheduled_date
              }
            }
          }
        }
      } catch (error) {
        console.warn("加载已有课节失败:", summarizeError(error))
      }

      const { totalSessions, sessionDuration, startDate, startTime } = editableParams
      let newSessions: ScheduleItem[] = []

      // 根据排课模式生成新课节
      if (scheduleMode === 'single') {
        // 排1节课模式：只生成一节课
        const baseDate = existingSessions.length > 0 ? lastDate : startDate

        const endTime = calculateEndTime(startTime, sessionDuration)
        newSessions.push({
          id: `preview-${selectedOrder.id}-${Date.now()}`,
          studentId: selectedOrder.student_id,
          studentName: selectedOrder.student_name || "未知学生",
          teacherId: selectedOrder.teacher_names?.[0] || "",
          teacherName: selectedOrder.teacher_names?.[0] || "未分配",
          subject: selectedOrder.subjects?.[0] || "",
          date: baseDate,
          startTime: startTime,
          endTime: endTime,
          classroom: "",
        })
      } else {
        // 班级课模式：生成用户输入数量的新课节
        const baseDate = existingSessions.length > 0 ? lastDate : startDate
        const remainingSessions = Math.max(totalSessions - existingSessions.length, 0)

        if (repeatMode === 'same') {
          // 每周开课时间一样
          const scheduleData = generateSameWeeklySchedule(baseDate, startTime, remainingSessions, sessionDuration)
          newSessions = scheduleData.map((session, i) => ({
            id: `preview-${selectedOrder.id}-${Date.now()}-${i}`,
            studentId: selectedOrder.student_id,
            studentName: selectedOrder.student_name || "未知学生",
            teacherId: selectedOrder.teacher_names?.[0] || "",
            teacherName: selectedOrder.teacher_names?.[0] || "未分配",
            subject: selectedOrder.subjects?.[0] || "",
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            classroom: "",
          }))
        } else {
          // 每周开课时间自定义
          const scheduleData = generateCustomWeeklySchedule(baseDate, weeklySchedule, remainingSessions, sessionDuration)
          newSessions = scheduleData.map((session, i) => ({
            id: `preview-${selectedOrder.id}-${Date.now()}-${i}`,
            studentId: selectedOrder.student_id,
            studentName: selectedOrder.student_name || "未知学生",
            teacherId: selectedOrder.teacher_names?.[0] || "",
            teacherName: selectedOrder.teacher_names?.[0] || "未分配",
            subject: selectedOrder.subjects?.[0] || "",
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            classroom: "",
          }))
        }
      }

      // 合并已有课节和新课节
      setScheduleList([...existingSessions, ...newSessions])
      setExistingHoursCount(totalExistingHours)

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
    const item = scheduleList.find(i => i.id === id)
    const isExisting = item && isExistingScheduleItem(item)

    setScheduleList(scheduleList.filter(item => item.id !== id))

    // 如果删除的是已创建的课节，重新计算已扣课时
    if (isExisting && selectedOrder) {
      // 异步重新计算已扣课时
      recalculateExistingHours()
    }

    setSelectedItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  // 重新计算已扣课时
  const recalculateExistingHours = async () => {
    if (!selectedOrder) return

    try {
      const courseResp = await api.get(`/api/courses/by-order/${selectedOrder.id}`)
      if (courseResp.ok) {
        const courseData = await courseResp.json()
        if (courseData.data) {
          const sessionsResp = await api.get(`/api/class-sessions?course_id=${courseData.data.id}`)
          if (sessionsResp.ok) {
            const sessionsData = await sessionsResp.json()
            if (sessionsData.data && sessionsData.data.length > 0) {
              const totalExistingMinutes = sessionsData.data.reduce((sum: number, session: any) => {
                return sum + (session.scheduled_duration_minutes || 0)
              }, 0)
              const totalExistingHours = Math.round((totalExistingMinutes / 60) * 100) / 100
              setExistingHoursCount(totalExistingHours)
            } else {
              setExistingHoursCount(0)
            }
          }
        }
      }
    } catch (error) {
      console.error('重新计算已扣课时失败:', summarizeError(error))
    }
  }

  // 批量删除选中的项
  const removeSelectedItems = () => {
    // 检查是否删除了已创建的课节
    const hasExisting = scheduleList.some(item =>
      selectedItems.has(item.id) &&
      isExistingScheduleItem(item)
    )

    setScheduleList(scheduleList.filter(item => !selectedItems.has(item.id)))

    // 如果删除了已创建的课节，重新计算已扣课时
    if (hasExisting) {
      recalculateExistingHours()
    }

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

  const runSchedulePrecheck = async (items: ScheduleItem[] = scheduleList): Promise<SchedulePrecheckIssue[]> => {
    const newSessions = items.filter(isNewScheduleItem)

    if (!selectedOrderId || newSessions.length === 0) {
      setPrecheckIssues([])
      setPrecheckCheckedAt(null)
      return []
    }

    const localIssues = getLocalPrecheckIssues(items)
    setIsPrechecking(true)

    try {
      const resp = await api.post("/api/schedule/batch/precheck", {
        orderId: selectedOrderId,
        items: buildPrecheckPayloadItems(newSessions),
      })
      const result = await resp.json().catch(() => ({ issues: [], error: "预检失败" }))
      const serverIssues: SchedulePrecheckIssue[] = Array.isArray(result.issues) ? result.issues : []
      const issues = [
        ...localIssues,
        ...serverIssues,
        ...(!resp.ok && serverIssues.length === 0 ? [{
          index: 1,
          type: "error" as const,
          message: result.error || "预检失败，请稍后重试",
        }] : []),
      ]

      setPrecheckIssues(issues)
      setPrecheckCheckedAt(new Date().toISOString())
      return issues
    } catch (error) {
      const issues = [
        ...localIssues,
        {
          index: 1,
          type: "warning" as const,
          message: `预检接口暂不可用：${summarizeError(error)}`,
        },
      ]

      setPrecheckIssues(issues)
      setPrecheckCheckedAt(new Date().toISOString())
      return issues
    } finally {
      setIsPrechecking(false)
    }
  }

  useEffect(() => {
    if (!selectedOrderId || scheduleList.length === 0) {
      setPrecheckIssues([])
      setPrecheckCheckedAt(null)
      return
    }

    const timer = window.setTimeout(() => {
      void runSchedulePrecheck(scheduleList)
    }, 600)

    return () => window.clearTimeout(timer)
  }, [selectedOrderId, scheduleList, existingHoursCount, selectedOrder?.total_hours])

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
    const existingSessions = scheduleList.filter(isExistingScheduleItem)
    const newSessions = scheduleList.filter(isNewScheduleItem)

    // 如果全部是已有课节，提示用户
    if (newSessions.length === 0) {
      toast({
        variant: "destructive",
        title: "没有新课节需要创建",
        description: `该订单已创建 ${existingSessions.length} 节课程，请添加新课节后再提交`,
      })
      return
    }

    const issues = await runSchedulePrecheck(scheduleList)
    const errorIssues = issues.filter(issue => issue.type === "error")
    if (errorIssues.length > 0) {
      toast({
        variant: "destructive",
        title: "预检未通过",
        description: errorIssues[0]?.message || "请先处理排课冲突后再提交",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        orderId: selectedOrderId,
        className: className,
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
        throw new Error(err.errors?.[0]?.error || err.error || "批量排课失败")
      }
      const result = await resp.json()
      const failedCount = Number(result.failed) || 0
      const firstError = result.errors?.[0]?.error

      toast({
        variant: failedCount > 0 ? "destructive" : "default",
        title: failedCount > 0 ? "排课部分完成" : "排课成功",
        description: failedCount > 0
          ? `成功 ${result.success}/${result.total} 节，失败 ${failedCount} 节：${firstError || "请查看服务端日志"}`
          : existingSessions.length > 0
          ? `已跳过 ${existingSessions.length} 节已有课程，成功创建 ${result.success}/${result.total} 节新课`
          : `已成功创建 ${result.success}/${result.total} 节课程`,
      })

      // 重新加载订单信息和课节列表
      await handleOrderChange(selectedOrderId)
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
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="批量排课" description="从正式订单批量创建课程" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="批量排课" description="从正式订单批量创建课程" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 订单选择区 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">1. 选择正式订单</h3>
              <div className="space-y-4">
                <SearchableSelect
                  id="order"
                  label="选择订单"
                  placeholder="请输入订单号、学生姓名或老师姓名搜索..."
                  value={selectedOrderId}
                  onChange={(value) => handleOrderChange(value)}
                  options={orders.map((order) => ({
                    id: order.id,
                    name: `${order.student_name || '-'} - ${order.teacher_names?.[0] || '-'} - ${order.subjects?.[0] || '-'} - ${order.order_number}`,
                  }))}
                  loading={isLoading}
                />

                {selectedOrder && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium text-sm mb-2">订单信息</h4>
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
                        <span className="text-muted-foreground">开课日期：</span>
                        <span className="font-medium">
                          {selectedOrder.official_start_time
                            ? format(new Date(selectedOrder.official_start_time), 'yyyy-MM-dd')
                            : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">总课时：</span>
                        <span className="font-medium">{selectedOrder.total_hours || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">剩余课时：</span>
                        <span className="font-medium">
                          {selectedOrder.total_hours
                            ? (selectedOrder.total_hours - existingHoursCount).toFixed(2)
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 排课设置 Card */}
          {selectedOrder && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">排课设置</h3>
                </div>

                {/* 排课模式选择 */}
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-3 block">选择排课模式</Label>
                  <RadioGroup value={scheduleMode} onValueChange={(value: 'single' | 'class') => setScheduleMode(value)} className="flex gap-4">
                    <div className="flex items-center space-x-2 border rounded-lg p-4 flex-1 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="single" id="single" className="border-primary" />
                      <div className="flex-1">
                        <Label htmlFor="single" className="cursor-pointer font-medium">排1节课</Label>
                        <p className="text-xs text-muted-foreground mt-1">使用固定频次批量创建课程</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-4 flex-1 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="class" id="class" className="border-primary" />
                      <div className="flex-1">
                        <Label htmlFor="class" className="cursor-pointer font-medium">班级课</Label>
                        <p className="text-xs text-muted-foreground mt-1">自定义每周上课时间</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* 单节课模式配置 */}
                {scheduleMode === 'single' && (
                  <div className="border-t pt-6 space-y-4">
                    {/* 班级名称 */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">班级名称</Label>
                        <Input
                          placeholder="请输入班级名称"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">开课日期</Label>
                        <Input
                          type="date"
                          value={editableParams.startDate}
                          onChange={(e) => setEditableParams(p => ({ ...p, startDate: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">开课时间</Label>
                        <TimePicker
                          value={editableParams.startTime}
                          onChange={(value) => setEditableParams(p => ({ ...p, startTime: value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">课时时长（分钟）</Label>
                        <Input
                          type="number"
                          min={15}
                          max={300}
                          step={15}
                          value={editableParams.sessionDuration}
                          onChange={(e) => setEditableParams(p => ({ ...p, sessionDuration: parseInt(e.target.value) || 60 }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">备注</Label>
                        <Input placeholder="可选" className="h-9" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 班级课模式配置 */}
                {scheduleMode === 'class' && (
                  <div className="border-t pt-6 space-y-6">
                    {/* 班级基本信息 - 按照图片布局 */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">班级名称</Label>
                        <Input
                          placeholder="请输入班级名称"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">开课日期</Label>
                        <Input
                          type="date"
                          value={editableParams.startDate}
                          onChange={(e) => setEditableParams(p => ({ ...p, startDate: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">开课时间</Label>
                        <TimePicker
                          value={editableParams.startTime}
                          onChange={(value) => setEditableParams(p => ({ ...p, startTime: value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">课时时长（分钟）</Label>
                        <Input
                          type="number"
                          min={15}
                          max={300}
                          step={15}
                          value={editableParams.sessionDuration}
                          onChange={(e) => setEditableParams(p => ({ ...p, sessionDuration: parseInt(e.target.value) || 60 }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">课节</Label>
                          {(() => {
                            const remainingHours = selectedOrder?.total_hours
                              ? Math.round((selectedOrder.total_hours - existingHoursCount) * 100) / 100
                              : 0
                            const consumedHours = (editableParams.totalSessions * editableParams.sessionDuration) / 60
                            const isOverLimit = consumedHours > remainingHours && remainingHours > 0
                            const remainingSessions = Math.floor((remainingHours * 60) / editableParams.sessionDuration)
                            return isOverLimit ? (
                              <span className="text-xs text-red-500">
                                剩余约 {remainingSessions} 节 ({remainingHours} 小时)
                              </span>
                            ) : remainingHours > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                剩余约 {remainingSessions} 节 ({remainingHours} 小时)
                              </span>
                            ) : null
                          })()}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={editableParams.totalSessions}
                          onChange={(e) => setEditableParams(p => ({ ...p, totalSessions: parseInt(e.target.value) || 1 }))}
                          className={cn(
                            "h-9",
                            selectedOrder?.total_hours &&
                              ((editableParams.totalSessions * editableParams.sessionDuration) / 60) >
                              Math.round((selectedOrder.total_hours - existingHoursCount) * 100) / 100 &&
                              Math.round((selectedOrder.total_hours - existingHoursCount) * 100) / 100 > 0
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          )}
                          placeholder="请输入课节数"
                        />
                      </div>
                    </div>

                    {/* 每周重复规则 */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">每周重复规则</Label>
                      <RadioGroup value={repeatMode} onValueChange={(value: 'same' | 'custom') => setRepeatMode(value)} className="flex gap-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="same" id="same" />
                          <Label htmlFor="same" className="cursor-pointer">每周开课时间一样</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="custom" />
                          <Label htmlFor="custom" className="cursor-pointer">每周开课时间自定义</Label>
                        </div>
                      </RadioGroup>

                      {repeatMode === 'custom' && (
                        <div className="pt-3">
                          <WeeklySchedulePicker
                            value={weeklySchedule}
                            onChange={setWeeklySchedule}
                            label=""
                            defaultStartTime={editableParams.startTime}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 底部操作按钮 */}
                <div className="mt-6 pt-6 border-t">
                  <Button onClick={regenerateSchedule}>
                    重新生成课表
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                      {scheduleList.some(isExistingScheduleItem) && (
                        <span className="text-sm font-normal text-green-600">
                          已创建 {scheduleList.filter(isExistingScheduleItem).length} 节
                        </span>
                      )}
                      {/* 统计新课节数量 */}
                      {scheduleList.some(isNewScheduleItem) && (
                        <span className="text-sm font-normal text-blue-600">
                          待创建 {newScheduleCount} 节
                        </span>
                      )}
                    </div>
                  </div>
                <div className="flex gap-2">
                  {newScheduleCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runSchedulePrecheck(scheduleList)}
                      disabled={isPrechecking}
                    >
                      {isPrechecking ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      重新预检
                    </Button>
                  )}
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

              {newScheduleCount > 0 && (
                <div className={cn(
                  "mb-4 rounded-md border p-3 text-sm",
                  hasBlockingPrecheckIssue
                    ? "border-red-200 bg-red-50 text-red-800"
                    : precheckWarningCount > 0
                    ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                    : "border-green-200 bg-green-50 text-green-800"
                )}>
                  <div className="flex items-start gap-2">
                    {hasBlockingPrecheckIssue ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : isPrechecking ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {isPrechecking
                          ? "正在预检待创建课节"
                          : hasBlockingPrecheckIssue
                          ? `预检发现 ${precheckErrorCount} 个问题`
                          : precheckWarningCount > 0
                          ? `预检完成，${precheckWarningCount} 个提醒`
                          : "预检通过"}
                      </div>
                      <div className="mt-1 text-xs opacity-80">
                        待创建 {newScheduleCount} 节
                        {precheckCheckedAt ? `，上次检查 ${format(new Date(precheckCheckedAt), 'HH:mm:ss')}` : ""}
                      </div>
                      {precheckIssues.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {precheckIssues.slice(0, 5).map((issue, index) => (
                            <div key={`${issue.index}-${index}`}>
                              第 {issue.index} 条：{issue.message}
                            </div>
                          ))}
                          {precheckIssues.length > 5 && (
                            <div>还有 {precheckIssues.length - 5} 条问题未显示</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {scheduleList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无排课信息</p>
                  <p className="text-sm mt-2">请选择订单，系统将自动生成排课列表</p>
                </div>
              ) : (
                <ScrollableTable flex={false} maxHeight="60vh">
                  <Table className="border-0">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 z-30 bg-background w-12">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="sticky left-12 z-30 bg-background w-16">序号</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>时间段</TableHead>
                        <TableHead>老师</TableHead>
                        <TableHead>教室</TableHead>
                        <TableHead className="w-24 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleList.map((item, index) => {
                        const isExisting = isExistingScheduleItem(item)

                        return (
                          <TableRow
                            key={item.id}
                            className={isExisting ? "bg-green-50" : ""}
                          >
                            <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50">
                              <Checkbox
                                checked={selectedItems.has(item.id)}
                                onCheckedChange={() => !isExisting && handleSelectItem(item.id)}
                                disabled={isExisting}
                              />
                            </TableCell>
                            <TableCell className="sticky left-12 z-20 bg-background group-hover:bg-muted/50 font-medium">
                              {index + 1}
                              {isExisting && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  已创建
                                </span>
                              )}
                            </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={item.date}
                                onChange={(e) => updateScheduleItem(item.id, 'date', e.target.value)}
                                className="h-9 flex-1"
                                disabled={isExisting}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[40px]">
                                {getWeekdayDisplay(item.date)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TimePicker
                                value={item.startTime}
                                onChange={(value) => updateScheduleItem(item.id, 'startTime', value)}
                                className="w-28"
                                disabled={isExisting}
                              />
                              <span>-</span>
                              <TimePicker
                                value={item.endTime}
                                onChange={(value) => updateScheduleItem(item.id, 'endTime', value)}
                                className="w-28"
                                disabled={isExisting}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{item.teacherName}</span>
                            </div>
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
                </ScrollableTable>
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
                      disabled={isSubmitting || isPrechecking || scheduleList.length === 0 || hasBlockingPrecheckIssue}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          提交中...
                        </>
                      ) : isPrechecking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          预检中...
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
