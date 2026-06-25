"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
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
import { TimePicker } from "@/components/ui/time-picker"
import { Loader2, ArrowLeft, FileText, BookOpen, Video, User, Phone, School, Calendar, DollarSign, Clock, MessageCircle, Plus, History, Edit, Trash2, CalendarPlus, Copy } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getDictionaryItems, DictionaryItem } from "@/lib/services/dictionary"
import { getStudentStatusLabel, getStudentStatusBadgeClass } from "@/lib/utils"
import { TransactionRecord } from "@/lib/services/transactions"
import { api } from "@/lib/fetch"
import { usePermission } from "@/lib/hooks/usePermission"
import { summarizeError } from "@/lib/safe-error"

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
  transactions: TransactionRecord[]
  formalOrderSummaries: FormalOrderSummary[]
  stats: {
    formalOrdersCount: number
    trialLessonsCount: number
    coursesCount: number
    classroomsCount: number
    visitRecordsCount: number
    statusHistoryCount: number
    transactionsCount: number
    totalFormalHours: number
    totalFormalAmount: number
    completedFormalHours: number
    remainingFormalHours: number
    remainingFormalAmount: number
  }
}

interface FormalOrder {
  id: string
  lead_id?: string
  trial_lesson_id?: string
  previous_order_id?: string
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
  computed_status?: string
  computed_status_label?: string
  created_at: string
}

interface FormalOrderSummary {
  order_id: string
  order_number?: string
  total_hours: number
  scheduled_hours: number
  completed_hours: number
  gross_remaining_hours: number
  refunded_hours: number
  remaining_hours: number
  payment_amount: number
  hourly_rate: number
  refunded_amount: number
  gross_remaining_amount: number
  remaining_amount: number
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
  total_sessions?: number
  session_duration?: number
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

// 课程课节统计数据
interface CourseSessionsStats {
  [courseId: string]: {
    totalSessions: number
    completedSessions: number
    scheduledSessions: number
    durations: {
      totalHours: number
      scheduledHours: number
      completedHours: number
      unscheduledHours: number
    }
  }
}

interface BatchScheduleRow {
  id: string
  date: string
  startTime: string
  endTime: string
}

const createBatchScheduleRow = (seed = Date.now()): BatchScheduleRow => ({
  id: `${seed}-${Math.random().toString(36).slice(2, 8)}`,
  date: '',
  startTime: '',
  endTime: '',
})

// 订单类型映射
const ORDER_TYPE_MAP: Record<string, string> = {
  'new': '新签',
  'renew': '续费',
  'extend': '扩课',
}

// 订单状态映射
const ORDER_STATUS_MAP: Record<string, string> = {
  'draft': '草稿',
  'pending_payment': '待付款',
  'active': '有效',
  'suspended': '暂停',
  'paused': '暂停',
  'completed': '完成',
  'refunded': '已退费',
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

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const {
    user,
    students: studentsPerm,
    trialLessons: trialLessonsPerm,
    formalOrders: formalOrdersPerm,
    transactions: transactionsPerm,
    classSessions: classSessionsPerm,
  } = usePermission()
  const canViewClassInSecrets = user?.role === 'admin' || user?.role === 'academic_affairs'
  const canCreateTrialLesson = trialLessonsPerm.create()
  const canCreateFormalOrder = formalOrdersPerm.create()
  const canCreateTransaction = transactionsPerm.create()
  const canCreateSession = classSessionsPerm.create()
  const canManageFormalOrderActions = canCreateFormalOrder || canCreateTransaction
  const canAccessVisitRecords = studentsPerm.visit()
  const canEditVisitRecord = studentsPerm.visit()
  const canDeleteVisitRecord = studentsPerm.delete()
  const canManageVisitRecords = canEditVisitRecord || canDeleteVisitRecord
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // 课程课节统计数据
  const [courseSessionsStats, setCourseSessionsStats] = useState<CourseSessionsStats>({})

  // 字典数据
  const [visitMethods, setVisitMethods] = useState<DictionaryItem[]>([])
  const [parentAttitudes, setParentAttitudes] = useState<DictionaryItem[]>([])
  const [grades, setGrades] = useState<DictionaryItem[]>([])
  const [subjects, setSubjects] = useState<DictionaryItem[]>([])
  const [regions, setRegions] = useState<DictionaryItem[]>([])

  // 回访表单状态
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false)
  const [editingVisit, setEditingVisit] = useState<VisitRecord | null>(null)
  const [visitToDelete, setVisitToDelete] = useState<VisitRecord | null>(null)
  const [isDeletingVisit, setIsDeletingVisit] = useState(false)
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    visit_method: '',
    parent_attitude: '',
    next_visit_date: '',
    visit_notes: '',
  })

  // 批量排课状态
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false)
  const [scheduleCourseId, setScheduleCourseId] = useState('')
  const [scheduleRows, setScheduleRows] = useState<BatchScheduleRow[]>([createBatchScheduleRow()])
  const [scheduleConflictMode, setScheduleConflictMode] = useState('skip')

  useEffect(() => {
    // 加载字典数据
    const loadDictionaries = async () => {
      try {
        const [methods, attitudes, gradeData, subjectData, regionData] = await Promise.all([
          getDictionaryItems('visit_method'),
          getDictionaryItems('parent_attitude'),
          getDictionaryItems('grade'),
          getDictionaryItems('subject'),
          getDictionaryItems('province'),
        ])
        setVisitMethods(methods)
        setParentAttitudes(attitudes)
        setGrades(gradeData)
        setSubjects(subjectData)
        setRegions(regionData)
      } catch (error) {
        console.error('Failed to load dictionaries:', summarizeError(error))
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

  // 辅助函数：获取试听科目标签
  const getTrialSubjectLabel = (code: string): string => {
    return getLabelByCode(subjects, code)
  }

  // 辅助函数：获取年级标签
  const getGradeLabel = (code: string): string => {
    return getLabelByCode(grades, code)
  }

  // 辅助函数：获取地区标签
  const getRegionLabel = (code: string): string => {
    return getLabelByCode(regions, code)
  }

  // 辅助函数：获取试听课程状态标签样式
  const getLessonStatusBadge = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    // 新状态映射（详细流程）
    const newStatusMap: Record<string, string> = {
      'cancelled': 'bg-gray-100 text-gray-800',           // 取消试听 - 灰色
      'waiting_match': 'bg-yellow-100 text-yellow-800',   // 待匹配老师 - 黄色
      'waiting_confirm': 'bg-blue-100 text-blue-800',     // 待确认老师 - 蓝色
      'waiting_time': 'bg-indigo-100 text-indigo-800',    // 待确认时间 - 靛蓝
      'waiting_link': 'bg-purple-100 text-purple-800',    // 待开链接 - 紫色
      'scheduled': 'bg-cyan-100 text-cyan-800',           // 已排待上课 - 青色
      'waiting_feedback': 'bg-orange-100 text-orange-800',// 上完待反馈 - 橙色
      'completed': 'bg-green-100 text-green-800',         // 已完成 - 绿色
    }

    // 旧状态映射（兼容）
    const oldStatusMap: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',         // 待确认 - 黄色
      'confirmed': 'bg-blue-100 text-blue-800',           // 已确认 - 蓝色
      'completed': 'bg-green-100 text-green-800',         // 已完成 - 绿色
      'cancelled': 'bg-gray-100 text-gray-800',           // 已取消 - 灰色
    }

    return newStatusMap[status] || oldStatusMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 辅助函数：获取试听课程状态文本
  const getLessonStatusText = (status?: string, statusName?: string) => {
    // 优先使用后端返回的状态名称
    if (statusName) return statusName

    if (!status) return '-'

    // 新状态文本映射
    const newStatusMap: Record<string, string> = {
      'cancelled': '已取消',
      'waiting_match': '待匹配老师',
      'waiting_confirm': '待确认老师',
      'waiting_time': '待确认时间',
      'waiting_link': '待开链接',
      'scheduled': '已排待上课',
      'waiting_feedback': '上完待反馈',
      'completed': '已完成',
    }

    // 旧状态文本映射（兼容）
    const oldStatusMap: Record<string, string> = {
      'pending': '待确认',
      'confirmed': '已确认',
      'completed': '已完成',
      'cancelled': '已取消',
    }

    return newStatusMap[status] || oldStatusMap[status] || status
  }

  const fetchStudentDetail = async (id: string) => {
    try {
      setIsLoading(true)

      // 获取学生基本信息和订单等数据
      const detailResponse = await api.get(`/api/students/detail?id=${encodeURIComponent(id)}`)

      if (!detailResponse.ok) {
        throw new Error('获取学生详情失败')
      }

      const detailResult = await detailResponse.json()

      setDetail(detailResult.data)

      // 获取每个课程的课节统计数据
      const courses = detailResult.data.courses || []
      if (courses.length > 0) {
        fetchCoursesSessionsStats(courses)
      }
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

  // 获取所有课程的课节统计数据
  const fetchCoursesSessionsStats = async (courses: Course[]) => {
    try {
      const statsPromises = courses.map(async (course) => {
        try {
          const response = await api.get(`/api/courses/${course.id}/sessions`)

          if (response.ok) {
            const result = await response.json()
            return {
              courseId: course.id,
              stats: result.statistics,
            }
          }
          return null
        } catch (error) {
          console.error('Failed to fetch sessions for course:', {
            course_id_present: Boolean(course.id),
            error: summarizeError(error),
          })
          return null
        }
      })

      const results = await Promise.all(statsPromises)

      // 构建统计数据对象
      const statsMap: CourseSessionsStats = {}
      results.forEach((result) => {
        if (result && result.stats) {
          statsMap[result.courseId] = result.stats
        }
      })

      setCourseSessionsStats(statsMap)
    } catch (error) {
      console.error('Failed to fetch courses sessions stats:', summarizeError(error))
    }
  }

  // 打开新建/编辑回访对话框
  const openVisitDialog = (record?: VisitRecord) => {
    if (!canEditVisitRecord) {
      toast({
        variant: "destructive",
        title: "无权操作",
        description: "当前账号没有新增或编辑回访记录的权限",
      })
      return
    }

    setEditingVisit(record || null)
    setVisitForm({
      visit_date: record?.visit_date || new Date().toISOString().split('T')[0],
      visit_method: record?.visit_method || '',
      parent_attitude: record?.parent_attitude || '',
      next_visit_date: record?.next_visit_date || '',
      visit_notes: record?.visit_notes || '',
    })
    setVisitDialogOpen(true)
  }

  // 提交回访记录
  const handleSubmitVisit = async () => {
    if (!detail) return
    if (!canEditVisitRecord) {
      toast({
        variant: "destructive",
        title: "无权操作",
        description: "当前账号没有新增或编辑回访记录的权限",
      })
      return
    }

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

      const payload = {
        visit_date: visitForm.visit_date,
        visit_method: visitForm.visit_method,
        parent_attitude: visitForm.parent_attitude || null,
        next_visit_date: visitForm.next_visit_date || null,
        visit_notes: visitForm.visit_notes.trim(),
      }
      const response = editingVisit
        ? await api.put('/api/visit-records', { id: editingVisit.id, ...payload })
        : await api.post('/api/visit-records', {
          student_id: detail.student.id,
          ...payload,
        })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: editingVisit ? '更新回访记录失败' : '创建回访记录失败' }))
        throw new Error(error.error || (editingVisit ? '更新回访记录失败' : '创建回访记录失败'))
      }

      toast({
        title: editingVisit ? "回访已更新" : "回访成功",
        description: editingVisit ? "回访记录已更新" : "回访记录已创建",
      })

      setVisitDialogOpen(false)
      setEditingVisit(null)
      // 重新获取数据
      fetchStudentDetail(params.id as string)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "回访失败",
        description: error.message || (editingVisit ? "无法更新回访记录" : "无法创建回访记录"),
      })
    } finally {
      setIsSubmittingVisit(false)
    }
  }

  const openBatchScheduleDialog = (course?: Course) => {
    if (!canCreateSession) {
      toast({
        variant: "destructive",
        title: "无权排课",
        description: "当前账号没有新增课节的权限",
      })
      return
    }

    const firstCourse = course || detail?.courses?.[0]
    setScheduleCourseId(firstCourse?.id || '')
    setScheduleRows([createBatchScheduleRow()])
    setScheduleConflictMode('skip')
    setScheduleDialogOpen(true)
  }

  const updateScheduleRow = (rowId: string, patch: Partial<BatchScheduleRow>) => {
    setScheduleRows((rows) =>
      rows.map((row) => row.id === rowId ? { ...row, ...patch } : row)
    )
  }

  const duplicateScheduleRow = (row: BatchScheduleRow) => {
    setScheduleRows((rows) => [
      ...rows,
      { ...row, id: createBatchScheduleRow().id },
    ])
  }

  const removeScheduleRow = (rowId: string) => {
    setScheduleRows((rows) =>
      rows.length === 1 ? [createBatchScheduleRow()] : rows.filter((row) => row.id !== rowId)
    )
  }

  const handleSubmitBatchSchedule = async () => {
    if (!detail) return
    if (!canCreateSession) {
      toast({
        variant: "destructive",
        title: "无权排课",
        description: "当前账号没有新增课节的权限",
      })
      return
    }

    const selectedCourse = detail.courses.find((course) => course.id === scheduleCourseId)
    if (!selectedCourse) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择要排课的课程",
      })
      return
    }

    if (!selectedCourse.classin_course_id) {
      toast({
        variant: "destructive",
        title: "无法排课",
        description: "该课程未关联 ClassIn 课程，无法创建课堂",
      })
      return
    }

    if (!selectedCourse.teacher_name) {
      toast({
        variant: "destructive",
        title: "无法排课",
        description: "该课程缺少授课老师",
      })
      return
    }

    const hasIncompleteRow = scheduleRows.some((row) =>
      row.date || row.startTime || row.endTime
        ? !row.date || !row.startTime || !row.endTime
        : false
    )
    if (hasIncompleteRow) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请补全每一行的日期、开始时间和结束时间",
      })
      return
    }

    const completeRows = scheduleRows.filter((row) => row.date && row.startTime && row.endTime)
    if (completeRows.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请至少填写一节课",
      })
      return
    }

    try {
      setIsSubmittingSchedule(true)
      const response = await api.post('/api/class-sessions/recreate', {
        courseId: selectedCourse.id,
        items: completeRows.map((row) => ({
          studentName: detail.student.student_name,
          teacherName: selectedCourse.teacher_name,
          subject: selectedCourse.subject,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
        })),
        skipExisting: scheduleConflictMode === 'skip',
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error || '批量排课失败')
      }

      toast({
        title: "批量排课完成",
        description: `新建 ${result.created ?? 0} 节，跳过 ${result.skipped ?? 0} 节，失败 ${result.failed ?? 0} 节`,
      })

      setScheduleDialogOpen(false)
      setScheduleRows([createBatchScheduleRow()])
      await fetchStudentDetail(detail.student.id)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "批量排课失败",
        description: error.message || "无法创建课节",
      })
    } finally {
      setIsSubmittingSchedule(false)
    }
  }

  const handleDeleteVisit = async () => {
    if (!visitToDelete) return
    if (!canDeleteVisitRecord) {
      toast({
        variant: "destructive",
        title: "无权删除",
        description: "当前账号没有删除回访记录的权限",
      })
      setVisitToDelete(null)
      return
    }

    try {
      setIsDeletingVisit(true)
      const response = await api.delete(`/api/visit-records?id=${encodeURIComponent(visitToDelete.id)}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '删除回访记录失败' }))
        throw new Error(error.error || '删除回访记录失败')
      }

      toast({
        title: "回访已删除",
        description: "回访记录已删除",
      })

      setVisitToDelete(null)
      fetchStudentDetail(params.id as string)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除回访记录",
      })
    } finally {
      setIsDeletingVisit(false)
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

  const { student, orders, trialLessons, courses, classrooms, visitRecords, statusHistory, transactions, formalOrderSummaries, stats } = detail
  const summaryByOrderId = new Map((formalOrderSummaries || []).map((summary) => [summary.order_id, summary]))
  const latestOrder = orders.find((order) => order.status === 'active') || orders[0]
  const selectedScheduleCourse = courses.find((course) => course.id === scheduleCourseId)

  return (
    <div className="flex flex-col h-full">
      <Header title="学生详情" description={`${student.student_name} ${student.student_code ? `(${student.student_code})` : ''}`} />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div className="flex flex-wrap gap-2">
            {canCreateSession && courses.length > 0 && (
              <Button
                variant="outline"
                onClick={() => openBatchScheduleDialog()}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                批量排课
              </Button>
            )}
            {canCreateTrialLesson && (
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/trial-lessons/new?student_id=${student.id}`)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                创建新试听
              </Button>
            )}
            {canCreateFormalOrder && (
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/formal-orders/new?studentId=${student.id}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                新建正式订单
              </Button>
            )}
            {canAccessVisitRecords && (
              <Button
                variant="outline"
                onClick={() => setActiveTab('visits')}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                创建跟进记录
              </Button>
            )}
            {latestOrder && (
              <>
                {canCreateFormalOrder && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/dashboard/formal-orders/new?previousOrderId=${latestOrder.id}&studentId=${student.id}&mode=renew`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      续费
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/dashboard/formal-orders/new?previousOrderId=${latestOrder.id}&studentId=${student.id}&mode=extend`)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      扩科
                    </Button>
                  </>
                )}
                {canCreateTransaction && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/dashboard/transactions/new?student_id=${student.id}&order_id=${latestOrder.id}`)}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    退费
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 lg:w-auto">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="orders">订单 ({stats.formalOrdersCount})</TabsTrigger>
            <TabsTrigger value="courses">课程 ({stats.coursesCount})</TabsTrigger>
            <TabsTrigger value="trials">试听课 ({stats.trialLessonsCount})</TabsTrigger>
            <TabsTrigger value="classrooms">课堂 ({stats.classroomsCount})</TabsTrigger>
            <TabsTrigger value="visits">回访 ({stats.visitRecordsCount})</TabsTrigger>
            <TabsTrigger value="transactions">异动 ({stats.transactionsCount})</TabsTrigger>
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
                    剩余 {stats.remainingFormalHours.toFixed(1)} 小时
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
                  <p className="text-xs text-muted-foreground">
                    剩余 ¥{stats.remainingFormalAmount.toFixed(2)}
                  </p>
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
                  {canViewClassInSecrets && student.classin_uid && (
                    <div className="flex items-start gap-3">
                      <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">ClassIn UID</p>
                        <p className="font-medium">{student.classin_uid}</p>
                      </div>
                    </div>
                  )}
                  {canViewClassInSecrets && student.classin_initial_password && (
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
                          <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">科目</TableHead>
                          <TableHead>订单号</TableHead>
                          <TableHead>订单类型</TableHead>
                          <TableHead>签约顾问</TableHead>
                          <TableHead>老师</TableHead>
                          <TableHead>总课时</TableHead>
                          <TableHead>剩余课时</TableHead>
                          <TableHead>剩余金额</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>创建时间</TableHead>
                          {canManageFormalOrderActions && <TableHead>操作</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => {
                          const displayStatus = order.computed_status || order.status
                          return (
                          <TableRow key={order.id}>
                            <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                              {order.subjects.join(', ')}
                            </TableCell>
                            <TableCell className="font-medium">{order.order_number || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ORDER_TYPE_MAP[order.order_type] || order.order_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{order.consultant_teacher}</TableCell>
                            <TableCell>{order.teacher_names.join(', ')}</TableCell>
                            <TableCell>{order.total_hours} 小时</TableCell>
                            <TableCell>{(summaryByOrderId.get(order.id)?.remaining_hours ?? order.total_hours ?? 0).toFixed(1)} 小时</TableCell>
                            <TableCell>¥{(summaryByOrderId.get(order.id)?.remaining_amount ?? order.payment_amount ?? 0).toFixed(2)}</TableCell>
                            <TableCell>¥{order.payment_amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant={displayStatus === 'active' ? 'default' : 'secondary'}
                              >
                                {order.computed_status_label || ORDER_STATUS_MAP[displayStatus] || displayStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(order.created_at), 'yyyy-MM-dd')}</TableCell>
                            {canManageFormalOrderActions && (
                              <TableCell>
                                <div className="flex gap-2">
                                  {canCreateFormalOrder && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push(`/dashboard/formal-orders/new?previousOrderId=${order.id}&studentId=${student.id}&mode=renew`)}
                                      >
                                        续费
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push(`/dashboard/formal-orders/new?previousOrderId=${order.id}&studentId=${student.id}&mode=extend`)}
                                      >
                                        扩科
                                      </Button>
                                    </>
                                  )}
                                  {canCreateTransaction && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => router.push(`/dashboard/transactions/new?student_id=${student.id}&order_id=${order.id}`)}
                                    >
                                      退费
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )})}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>课程列表</CardTitle>
                {canCreateSession && courses.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openBatchScheduleDialog()}
                  >
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    批量排课
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无课程记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">学科</TableHead>
                          <TableHead>订单号</TableHead>
                          <TableHead>课程名称</TableHead>
                          <TableHead>教师</TableHead>
                          <TableHead>未排课时长</TableHead>
                          <TableHead>总时长</TableHead>
                          <TableHead>进度</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courses.map((course) => (
                          <TableRow key={course.id}>
                              <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                                {course.subject || '-'}
                              </TableCell>
                              <TableCell className="font-medium">{course.order_number || '-'}</TableCell>
                              <TableCell>{course.course_name || '-'}</TableCell>
                              <TableCell>{course.teacher_name || '-'}</TableCell>
                              <TableCell>{(() => {
                                // 使用 sessions API 返回的实际统计数据
                                const stats = courseSessionsStats[course.id]

                                if (stats && stats.durations) {
                                  // API 返回的未排课时长
                                  const unscheduledHours = stats.durations.unscheduledHours
                                  return unscheduledHours % 1 === 0 ? unscheduledHours : unscheduledHours.toFixed(1)
                                }

                                // 如果 API 数据还未加载，显示加载中
                                return '...'
                              })()} 小时</TableCell>
                              <TableCell>{course.total_hours || 0} 小时</TableCell>
                              <TableCell>
                                {(() => {
                                  // 使用 sessions API 返回的实际统计数据
                                  const stats = courseSessionsStats[course.id]

                                  if (stats && stats.totalSessions > 0) {
                                    // 计算进度：已完成节数 / 总节数
                                    const progress = Math.round((stats.completedSessions / stats.totalSessions) * 100)
                                    return (
                                      <div className="flex items-center gap-2">
                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-blue-600 h-2 rounded-full"
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                        <span className="text-xs">{progress}%</span>
                                      </div>
                                    )
                                  }

                                  // 如果 API 数据还未加载或没有课节，显示 '-'
                                  return '-'
                                })()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {COURSE_STATUS_MAP[course.course_status] || course.course_status}
                                </Badge>
                              </TableCell>
                              <TableCell>{format(new Date(course.created_at), 'yyyy-MM-dd')}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {canCreateSession && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openBatchScheduleDialog(course)}
                                    >
                                      批量排课
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                                  >
                                    管理课节
                                  </Button>
                                </div>
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

          {/* 试听课标签 */}
          <TabsContent value="trials" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>试听课列表</CardTitle>
                {canCreateTrialLesson && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/trial-lessons/new?student_id=${student.id}`)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新试听
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {trialLessons.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无试听课记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-30 bg-background w-[160px] min-w-[160px]">孩子称呼</TableHead>
                          <TableHead className="sticky left-[160px] z-30 bg-background w-[140px] min-w-[140px]">试听科目</TableHead>
                          <TableHead>地区</TableHead>
                          <TableHead>年级</TableHead>
                          <TableHead>试听时间</TableHead>
                          <TableHead>时长</TableHead>
                          <TableHead>匹配老师</TableHead>
                          <TableHead>确认老师</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>是否转化</TableHead>
                          {canCreateFormalOrder && <TableHead>操作</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialLessons.map((lesson) => {
                          const lessonStatus = lesson.lesson_status || lesson.status
                          const canConvertTrialByStatus = !lesson.is_converted_calculated && ['waiting_feedback', 'completed'].includes(lessonStatus)

                          return (
                            <TableRow key={lesson.id}>
                              <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[160px] min-w-[160px]">
                                {lesson.child_name}
                              </TableCell>
                              <TableCell className="sticky left-[160px] z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                                {getTrialSubjectLabel(lesson.trial_subject || '')}
                              </TableCell>
                              <TableCell>{getRegionLabel(lesson.region || '')}</TableCell>
                              <TableCell>{getGradeLabel(lesson.grade || '')}</TableCell>
                              <TableCell>{format(new Date(lesson.trial_time), 'yyyy-MM-dd HH:mm')}</TableCell>
                              <TableCell>{lesson.trial_duration} 分钟</TableCell>
                              <TableCell>{lesson.matched_teacher || '-'}</TableCell>
                              <TableCell>{lesson.confirmed_teacher || '-'}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLessonStatusBadge(lessonStatus)}`}>
                                  {getLessonStatusText(lessonStatus, lesson.lesson_status_name)}
                                </span>
                              </TableCell>
                              <TableCell>
                                {lesson.is_converted_calculated !== undefined ? (
                                  <Badge variant={lesson.is_converted_calculated ? 'default' : 'secondary'}>
                                    {lesson.is_converted_calculated ? '已转化' : '未转化'}
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                              {canCreateFormalOrder && (
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!canConvertTrialByStatus}
                                    onClick={() => router.push(`/dashboard/formal-orders/new?trialLessonId=${lesson.id}`)}
                                  >
                                    转正式
                                  </Button>
                                </TableCell>
                              )}
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
                {canEditVisitRecord && (
                  <Button onClick={() => openVisitDialog()} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    新建回访
                  </Button>
                )}
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
                          <TableHead>下次回访</TableHead>
                          <TableHead>回访方式</TableHead>
                          <TableHead>家长态度</TableHead>
                          <TableHead>回访人员</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>回访备注</TableHead>
                          {canManageVisitRecords && <TableHead>操作</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {format(new Date(record.visit_date), 'yyyy-MM-dd')}
                            </TableCell>
                            <TableCell>
                              {record.next_visit_date
                                ? format(new Date(record.next_visit_date), 'yyyy-MM-dd')
                                : <span className="text-muted-foreground">-</span>}
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
                            <TableCell>{record.visit_personnel_name || '未知'}</TableCell>
                            <TableCell>
                              {format(new Date(record.created_at), 'yyyy-MM-dd HH:mm')}
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={record.visit_notes || ''}>
                              {record.visit_notes || '-'}
                            </TableCell>
                            {canManageVisitRecords && (
                              <TableCell>
                                <div className="flex gap-2">
                                  {canEditVisitRecord && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openVisitDialog(record)}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      编辑
                                    </Button>
                                  )}
                                  {canDeleteVisitRecord && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => setVisitToDelete(record)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
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

          {/* 异动记录标签 */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>异动记录</CardTitle>
                {latestOrder && canCreateTransaction ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/transactions/new?student_id=${student.id}&order_id=${latestOrder.id}`)}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    新建退费
                  </Button>
                ) : (
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">暂无异动记录</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>创建日期</TableHead>
                          <TableHead>异动类型</TableHead>
                          <TableHead>课程名称</TableHead>
                          <TableHead>订单类型</TableHead>
                          <TableHead>原顾问</TableHead>
                          <TableHead>班主任</TableHead>
                          <TableHead>退费金额</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {record.creation_date ? format(new Date(record.creation_date), 'yyyy-MM-dd') : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{record.transaction_type}</Badge>
                            </TableCell>
                            <TableCell>{record.course_name || '-'}</TableCell>
                            <TableCell>{record.order_type || '-'}</TableCell>
                            <TableCell>{record.original_consultant || '-'}</TableCell>
                            <TableCell>{record.class_teacher || '-'}</TableCell>
                            <TableCell>
                              {record.refund_amount ? `¥${record.refund_amount}` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  record.status === 'completed' ? 'default' :
                                  record.status === 'processing' ? 'default' :
                                  record.status === 'rejected' ? 'destructive' : 'secondary'
                                }
                              >
                                {record.status === 'pending' ? '待处理' :
                                 record.status === 'processing' ? '处理中' :
                                 record.status === 'completed' ? '已完成' :
                                 record.status === 'rejected' ? '已拒绝' : record.status}
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

      {/* 新建回访对话框 */}
      <Dialog open={canEditVisitRecord && visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVisit ? "编辑回访记录" : "新建回访记录"}</DialogTitle>
            <DialogDescription>
              为学生 <span className="font-semibold">{student.student_name}</span> {editingVisit ? "更新回访记录" : "添加回访记录"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visit_date">回访日期 *</Label>
                <Input
                  id="visit_date"
                  type="date"
                  value={visitForm.visit_date}
                  onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_visit_date">下次回访日期</Label>
                <Input
                  id="next_visit_date"
                  type="date"
                  value={visitForm.next_visit_date}
                  onChange={(e) => setVisitForm({ ...visitForm, next_visit_date: e.target.value })}
                />
              </div>
            </div>

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
            <Button
              variant="outline"
              onClick={() => {
                setVisitDialogOpen(false)
                setEditingVisit(null)
              }}
            >
              取消
            </Button>
            <Button onClick={handleSubmitVisit} disabled={isSubmittingVisit}>
              {isSubmittingVisit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                editingVisit ? "保存回访" : "提交回访"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量排课对话框 */}
      <Dialog open={canCreateSession && scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>批量排课</DialogTitle>
            <DialogDescription>
              为学生 <span className="font-semibold">{student.student_name}</span> 批量创建 ClassIn 课堂和本地课节
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-course">课程 *</Label>
                <Select value={scheduleCourseId} onValueChange={setScheduleCourseId}>
                  <SelectTrigger id="schedule-course">
                    <SelectValue placeholder="请选择课程" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.course_name || course.subject || '未命名课程'} - {course.teacher_name || '未分配老师'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-conflict">重复课节处理</Label>
                <Select value={scheduleConflictMode} onValueChange={setScheduleConflictMode}>
                  <SelectTrigger id="schedule-conflict">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">跳过同日期同时间课节</SelectItem>
                    <SelectItem value="create">仍然创建</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedScheduleCourse && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {selectedScheduleCourse.course_name || selectedScheduleCourse.subject || '未命名课程'}
                </span>
                <span className="mx-2">/</span>
                老师：{selectedScheduleCourse.teacher_name || '未分配'}
                <span className="mx-2">/</span>
                ClassIn：{selectedScheduleCourse.classin_course_id || '未关联'}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>排课明细 *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScheduleRows((rows) => [...rows, createBatchScheduleRow()])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  添加一节
                </Button>
              </div>

              <div className="space-y-3">
                {scheduleRows.map((row, index) => (
                  <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`schedule-date-${row.id}`}>第 {index + 1} 节日期</Label>
                      <Input
                        id={`schedule-date-${row.id}`}
                        type="date"
                        value={row.date}
                        onChange={(event) => updateScheduleRow(row.id, { date: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>开始时间</Label>
                      <TimePicker
                        value={row.startTime}
                        onChange={(value) => updateScheduleRow(row.id, { startTime: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>结束时间</Label>
                      <TimePicker
                        value={row.endTime}
                        onChange={(value) => updateScheduleRow(row.id, { endTime: value })}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => duplicateScheduleRow(row)}
                        title="复制这一节"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeScheduleRow(row.id)}
                        title="删除这一节"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleDialogOpen(false)}
              disabled={isSubmittingSchedule}
            >
              取消
            </Button>
            <Button onClick={handleSubmitBatchSchedule} disabled={isSubmittingSchedule}>
              {isSubmittingSchedule ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  排课中...
                </>
              ) : (
                "确认排课"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={canDeleteVisitRecord && Boolean(visitToDelete)} onOpenChange={(open) => !open && setVisitToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除回访记录</DialogTitle>
            <DialogDescription>
              删除后该回访记录将从学生详情中移除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitToDelete(null)} disabled={isDeletingVisit}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteVisit} disabled={isDeletingVisit}>
              {isDeletingVisit ? (
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
