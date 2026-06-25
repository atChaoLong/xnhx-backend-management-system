"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { FormalOrdersService, NewFormalOrder, generateOrderNumber } from "@/lib/services/formalOrders"
import { TrialLessonsService, TrialLesson } from "@/lib/services/trialLessons"
import { TeachersService } from "@/lib/services/teachers"
import { StudentsService, generateStudentCode } from "@/lib/services/students"
import { DictionaryService } from "@/lib/services/dictionary"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { LeadsService } from "@/lib/services/leads"
import { UserProfilesService } from "@/lib/services/userProfiles"
import { PAYMENT_PROOF_ACCEPT, uploadPaymentProof, validatePaymentProofFile } from "@/lib/services/upload"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { summarizeError } from "@/lib/safe-error"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function NewFormalOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const trialLessonId = searchParams.get('trialLessonId') || ""
  const previousOrderId = searchParams.get('previousOrderId') || ""
  const studentIdParam = searchParams.get('studentId') || ""
  const orderMode = searchParams.get('mode') || ""
  const isRenewalEntry = Boolean(previousOrderId)
  const isTrialConversionEntry = Boolean(trialLessonId && !previousOrderId)
  const isExistingStudentEntry = Boolean(studentIdParam && !trialLessonId && !previousOrderId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sourceTrialLesson, setSourceTrialLesson] = useState<TrialLesson | null>(null)
  const [sourceError, setSourceError] = useState("")

  // 字典数据
  const { items: orderTypes, loading: orderTypesLoading } = useDictionary('order_type')
  const { items: paymentChannels, loading: paymentChannelsLoading } = useDictionary('payment_channel')
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')
  const [grades, setGrades] = useState<Array<{ code: string; label: string }>>([])
  const [regions, setRegions] = useState<Array<{ code: string; label: string }>>([])
  const [isLoadingDict, setIsLoadingDict] = useState(true)

  // 列表数据
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [previousOrders, setPreviousOrders] = useState<any[]>([])
  const [consultants, setConsultants] = useState<{ id: string; name: string }[]>([])

  // 多选
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  // 文件上传
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    // 关联字段
    student_id: "",
    lead_id: "",
    previous_order_id: "",
    teacher_name: "", // 单选老师

    // 手动录入的学生信息
    student_name: "",
    student_grade: "",
    student_region: "",
    parent_phone: "",

    // 订单基本信息
    order_number: "",
    order_type: "",
    consultant_teacher: "",
    order_notes: "",

    // 费用信息
    total_hours: "",
    payment_channel: "",
    payment_amount: "",
    hourly_rate: "",
    payment_proof: "",
    payment_time: "",

    // 状态管理
    status: "active",
  })

  function readSettled<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
    if (result.status === 'fulfilled') {
      return result.value
    }
    console.error(`加载${label}失败:`, summarizeError(result.reason))
    return fallback
  }

  // 加载列表数据
  useEffect(() => {
    const loadData = async () => {
      if (!trialLessonId && !previousOrderId && !studentIdParam) {
        setIsLoadingDict(false)
        return
      }

      try {
        const [
          teachersResult,
          studentsResult,
          salesResult,
          headTeachersResult,
          leadsResultSettled,
          ordersResultSettled,
          dictsResult,
        ] = await Promise.allSettled([
          TeachersService.getAllTeachers(),
          StudentsService.getAllStudents(),
          UserProfilesService.getUsers('sales'),
          UserProfilesService.getUsers('head_teacher'),
          LeadsService.getLeads(),
          FormalOrdersService.getAllFormalOrders(),
          DictionaryService.getAllDictionaries(),
        ])
        const teachersData = readSettled<any[]>(teachersResult, [], '老师列表')
        const studentsData = readSettled<any[]>(studentsResult, [], '学生列表')
        const salesData = readSettled<any[]>(salesResult, [], '销售列表')
        const headTeachersData = readSettled<any[]>(headTeachersResult, [], '班主任列表')
        const leadsResult = readSettled<{ data?: any[] }>(leadsResultSettled, { data: [] }, '线索列表')
        const ordersResult = readSettled<any[]>(ordersResultSettled, [], '正式订单列表')
        const dicts = readSettled<Record<string, any[]>>(dictsResult, {}, '字典')
        setTeachers(teachersData)
        setStudents(studentsData)
        const mergedConsultants = [
          ...(salesData || []).map(u => ({ id: u.id, name: u.name })),
          ...(headTeachersData || []).map(u => ({ id: u.id, name: u.name })),
        ]
        setConsultants(mergedConsultants)
        setPreviousOrders(ordersResult || [])
        setGrades(dicts.grade || [])
        setRegions(dicts.province || [])

        if (previousOrderId) {
          const previousOrder = ordersResult.find((order: any) => order.id === previousOrderId)
            || await FormalOrdersService.getFormalOrderById(previousOrderId)
          const student = previousOrder.student_id
            ? await StudentsService.getStudentById(previousOrder.student_id)
            : studentIdParam
              ? await StudentsService.getStudentById(studentIdParam)
              : null
          const isExtendEntry = orderMode === 'extend'
          const continuationType = (dicts.order_type || []).find((type: any) => {
            const label = type.label || ''
            const code = type.code || ''
            return isExtendEntry
              ? code === 'extend' || label.includes('扩') || label.toLowerCase().includes('extend')
              : code === 'renewal' || code === 'renew' || label.includes('续') || label.toLowerCase().includes('renew')
          })

          if (student) {
            setSelectedSubjects(previousOrder.subjects || [])
            setFormData((prev) => ({
              ...prev,
              student_id: student.id,
              student_name: student.student_name || '',
              student_grade: student.grade_code || '',
              student_region: student.region || '',
              parent_phone: student.parent_phone || '',
              lead_id: previousOrder.lead_id || '',
              previous_order_id: previousOrder.id,
              teacher_name: previousOrder.teacher_names?.[0] || '',
              consultant_teacher: previousOrder.consultant_teacher || '',
              order_type: continuationType?.label || (isExtendEntry ? '扩科订单' : '续费订单'),
              hourly_rate: previousOrder.hourly_rate ? String(previousOrder.hourly_rate) : '',
            }))
          }

          return
        }

        if (studentIdParam) {
          const student = await StudentsService.getStudentById(studentIdParam)
          if (!studentsData.some((item: any) => item.id === student.id)) {
            setStudents([student, ...studentsData])
          }
          const studentOrders = (ordersResult || [])
            .filter((order: any) => order.student_id === student.id)
            .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          const latestStudentOrder = studentOrders[0]
          const renewalType = (dicts.order_type || []).find((type: any) => {
            const label = type.label || ''
            const code = type.code || ''
            return code === 'renewal' || code === 'renew' || label.includes('续') || label.toLowerCase().includes('renew')
          })

          setLeads(leadsResult.data || [])
          setSelectedSubjects(latestStudentOrder?.subjects || [])
          setFormData((prev) => ({
            ...prev,
            student_id: student.id,
            student_name: student.student_name || '',
            student_grade: student.grade_code || '',
            student_region: student.region || '',
            parent_phone: student.parent_phone || '',
            lead_id: latestStudentOrder?.lead_id || '',
            previous_order_id: latestStudentOrder?.id || '',
            teacher_name: latestStudentOrder?.teacher_names?.[0] || '',
            consultant_teacher: latestStudentOrder?.consultant_teacher || '',
            order_type: latestStudentOrder ? (renewalType?.label || '续费订单') : '',
            hourly_rate: latestStudentOrder?.hourly_rate ? String(latestStudentOrder.hourly_rate) : '',
          }))
          return
        }

        const trialLesson = await TrialLessonsService.getTrialLessonById(trialLessonId)
        const allowedStatuses = ['waiting_feedback', 'completed']
        if (trialLesson.lesson_status && !allowedStatuses.includes(trialLesson.lesson_status)) {
          setSourceError('只有试听完成或待反馈的试听课程可以转正式订单')
        }

        if (trialLesson.is_converted_calculated ?? trialLesson.is_converted) {
          setSourceError('该试听课程已转正式订单，不能重复转化')
        }

        if (!trialLesson.lead_id && !trialLesson.student_id) {
          setSourceError('该试听课程缺少关联线索或正式生，不能转正式订单')
        }

        setSourceTrialLesson(trialLesson)

        let mergedLeads = leadsResult.data || []
        if (trialLesson.lead_id && !mergedLeads.some((lead: any) => lead.id === trialLesson.lead_id)) {
          try {
            const sourceLead = await LeadsService.getLeadById(trialLesson.lead_id)
            mergedLeads = [sourceLead, ...mergedLeads]
          } catch (error) {
            console.error('加载来源线索失败:', summarizeError(error))
          }
        }
        setLeads(mergedLeads)

        const subjectLabel = dicts.subject?.find((subject: any) => subject.code === trialLesson.trial_subject)?.label || trialLesson.trial_subject
        if (subjectLabel) {
          setSelectedSubjects([subjectLabel])
        }

        setFormData((prev) => ({
          ...prev,
          student_id: trialLesson.student_id || "",
          student_name: trialLesson.child_name || "",
          student_grade: trialLesson.grade || "",
          student_region: trialLesson.region || "",
          parent_phone: trialLesson.phone || "",
          lead_id: trialLesson.lead_id || "",
          teacher_name: trialLesson.confirmed_teacher || trialLesson.matched_teacher || "",
          consultant_teacher: trialLesson.assigned_consultant || "",
        }))
      } catch (error: any) {
        console.error('加载正式订单来源信息失败:', summarizeError(error))
        setSourceError(error.message || '无法加载来源试听信息')
      } finally {
        setIsLoadingDict(false)
      }
    }
    loadData()
  }, [trialLessonId, previousOrderId, studentIdParam, orderMode])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value }

      // 自动计算小时单价：当总课时或付款金额变化时
      if (field === 'total_hours' || field === 'payment_amount') {
        const hours = parseFloat(String(newData.total_hours))
        const amount = parseFloat(String(newData.payment_amount))

        // 只有当两个字段都有值时才计算
        if (!isNaN(hours) && hours > 0 && !isNaN(amount) && amount > 0) {
          newData.hourly_rate = (amount / hours).toFixed(2)
        }
      }

      return newData
    })
  }

  // 处理学生选择，自动填充学生信息
  const handleStudentSelect = async (studentId: string) => {
    setFormData((prev) => ({ ...prev, student_id: studentId }))

    // 如果选择了学生，自动填充学生信息
    if (studentId) {
      try {
        const student = await StudentsService.getStudentById(studentId)
        setFormData((prev) => ({
          ...prev,
          student_id: student.id,
          student_name: student.student_name || '',
          student_grade: student.grade_code || '',
          student_region: student.region || '',
          parent_phone: student.parent_phone || '',
          // 清空关联的旧订单（因为之前选择的可能不属于这个学生）
          previous_order_id: '',
        }))
      } catch (error) {
        console.error('加载学生信息失败:', summarizeError(error))
      }
    } else {
      // 清空选择时，清空学生信息
      setFormData((prev) => ({
        ...prev,
        student_id: '',
        student_name: '',
        student_grade: '',
        student_region: '',
        parent_phone: '',
        previous_order_id: '',
      }))
    }
  }

  // 处理学科多选
  const handleSubjectToggle = (subjectLabel: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subjectLabel)) {
        return prev.filter((s) => s !== subjectLabel)
      } else {
        return [...prev, subjectLabel]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const isRenew = formData.order_type.includes('续') || formData.order_type.toLowerCase().includes('renew')
    const isExtend = formData.order_type.includes('扩') || formData.order_type.toLowerCase().includes('extend')
    const isNew = formData.order_type.includes('新') || formData.order_type.toLowerCase().includes('new')

    if (!isRenewalEntry && !isExistingStudentEntry && (!trialLessonId || !sourceTrialLesson || sourceError)) {
      toast({
        variant: "destructive",
        title: "无法创建正式订单",
        description: sourceError || "正式订单必须从试听课程转化创建",
      })
      return
    }

    // 验证必填字段
    // 学生信息验证：如果选择了学生就使用，否则必须手动录入
    const hasSelectedStudent = formData.student_id && formData.student_id.trim() !== ''
    const hasManualInput = formData.student_name?.trim() || formData.parent_phone?.trim()

    if (isTrialConversionEntry && (!formData.student_name?.trim() || !formData.parent_phone?.trim())) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "来源试听缺少学生姓名或家长电话，不能转正式订单",
      })
      return
    }

    if (!isTrialConversionEntry && !hasSelectedStudent && !hasManualInput) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择学生或手动录入学生信息",
      })
      return
    }

    // 如果手动录入，验证必填字段
    if (!isTrialConversionEntry && (!hasSelectedStudent || hasManualInput)) {
      if (!formData.student_name?.trim()) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: "请输入学生姓名",
        })
        return
      }
      if (!formData.parent_phone?.trim()) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: "请输入家长电话",
        })
        return
      }
    }

    if (!formData.teacher_name) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择老师",
      })
      return
    }

    if (selectedSubjects.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个学科",
      })
      return
    }

    if (!formData.order_type) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择订单类型",
      })
      return
    }

    if (!formData.consultant_teacher) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择签约顾问",
      })
      return
    }

    if (isNew && !formData.lead_id && !sourceTrialLesson?.student_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "新签必须选择关联线索或来自正式生试听",
      })
      return
    }
    if ((isRenew || isExtend) && !formData.previous_order_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "续费/扩科必须选择之前的订单",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 判断是否需要创建新学生
      let studentId = formData.student_id
      const hasManualInput = formData.student_name?.trim() && formData.parent_phone?.trim()
      const shouldManageStudentClientSide = !isTrialConversionEntry

      // 如果有手动输入的信息，创建或更新学生
      if (shouldManageStudentClientSide && hasManualInput) {
        try {
          // 如果没有选择学生，创建新学生
          if (!studentId) {
            const newStudent = await StudentsService.createStudent({
              student_code: generateStudentCode(),
              student_name: formData.student_name.trim(),
              grade_code: formData.student_grade?.trim() || undefined,
              region: formData.student_region?.trim() || '',
              parent_phone: formData.parent_phone.trim(),
            })
            studentId = newStudent.id
            toast({
              title: "学生创建成功",
              description: `已为学生 ${formData.student_name} 创建资料`,
            })
          } else {
            // 如果选择了学生但有手动输入，更新学生信息
            await StudentsService.updateStudent({
              id: studentId,
              student_name: formData.student_name.trim(),
              grade_code: formData.student_grade?.trim() || undefined,
              region: formData.student_region?.trim() || '',
              parent_phone: formData.parent_phone.trim(),
            } as any)
            toast({
              title: "学生信息更新成功",
              description: `已更新学生 ${formData.student_name} 的信息`,
            })
          }
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "学生操作失败",
            description: error.message || "无法处理学生资料",
          })
          setIsSubmitting(false)
          return
        }
      }

      let paymentProofUrl = formData.payment_proof
      if (uploadedFile) {
        try {
          paymentProofUrl = await uploadPaymentProof(uploadedFile)
          toast({
            title: "付款凭证上传成功",
            description: "已保存付款凭证文件",
          })
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "付款凭证上传失败",
            description: error.message || "无法上传付款凭证",
          })
          setIsSubmitting(false)
          return
        }
      }

      const payload: NewFormalOrder = {
        student_id: studentId,
        trial_lesson_id: trialLessonId || undefined,
        order_number: formData.order_number.trim() || generateOrderNumber(),
        order_type: formData.order_type,
        consultant_teacher: formData.consultant_teacher,
        order_notes: formData.order_notes.trim() || undefined,
        lead_id: formData.lead_id || undefined,
        previous_order_id: formData.previous_order_id || undefined,
        teacher_names: [formData.teacher_name], // 单选老师转为数组
        subjects: selectedSubjects,
        total_hours: parseFloat(formData.total_hours),
        payment_channel: formData.payment_channel,
        payment_amount: parseFloat(formData.payment_amount),
        hourly_rate: parseFloat(formData.hourly_rate),
        payment_proof: paymentProofUrl,
        payment_time: formData.payment_time,
        status: formData.status,
      }

      await FormalOrdersService.createFormalOrder(payload)

      toast({
        title: "创建成功",
        description: "正式订单已创建",
      })

      router.push("/dashboard/formal-orders")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建正式订单",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (trialLessonId && !sourceTrialLesson && !sourceError) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="新增正式订单"
          description="正在加载来源试听信息"
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

    if ((!trialLessonId && !previousOrderId && !studentIdParam) || sourceError) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="新增正式订单"
          description="新签必须从试听课程转化，续费/扩科请从正式生详情进入"
        />

        <div className="flex-1 overflow-auto p-6">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">{sourceError ? "无法转正式订单" : "缺少来源试听"}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sourceError || "请先在试听课程页面选择可转正的试听，或在正式生详情中选择历史订单续费/扩科。"}
                </p>
              </div>
              <div className="flex justify-end">
                <Link href="/dashboard/trial-lessons">
                  <Button type="button">返回试听课程页面</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增正式订单"
        description="填写正式订单信息以创建新的订单"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 订单基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">订单基本信息</h3>

                {isTrialConversionEntry ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">来源学生</Label>
                    <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                      {formData.student_name || "来源试听学生加载中"}
                    </div>
                    <p className="text-xs text-muted-foreground">学生将由来源试听自动带入，不能在转正式时改绑其他学生。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="student_id" className="text-sm font-medium">
                      选择学生（可选，可手动录入）
                    </Label>
                    <SearchableSelect
                      id="student_id"
                      label=""
                      placeholder="搜索学生姓名..."
                      value={formData.student_id}
                      onChange={(id, name) => handleStudentSelect(id)}
                      options={students.map((s) => ({ id: s.id, name: s.student_name }))}
                      loading={students.length === 0}
                    />
                    <p className="text-xs text-muted-foreground">可选择已有学生，或直接在下方手动录入信息</p>
                    {isExistingStudentEntry && formData.student_id ? (
                      <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        <div className="font-medium">
                          已选择学生：{formData.student_name || "学生信息加载中"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formData.parent_phone ? `家长电话：${formData.parent_phone}` : "家长电话待补充"}
                          {formData.student_grade ? ` · 年级：${grades.find((grade) => grade.code === formData.student_grade)?.label || formData.student_grade}` : ""}
                          {selectedSubjects.length > 0 ? ` · 科目：${selectedSubjects.join("、")}` : ""}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 学生信息输入（始终显示） */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="text-sm font-medium">学生信息</h4>

                  {isLoadingDict ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="student_name">
                            学生姓名 <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="student_name"
                            placeholder="请输入学生姓名"
                            value={formData.student_name}
                            onChange={(e) => handleInputChange("student_name", e.target.value)}
                            disabled={isTrialConversionEntry}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="parent_phone">
                            家长电话 <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="parent_phone"
                            type="tel"
                            placeholder="请输入家长电话"
                            value={formData.parent_phone}
                            onChange={(e) => handleInputChange("parent_phone", e.target.value)}
                            disabled={isTrialConversionEntry}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="student_grade">年级</Label>
                          <Select
                            value={formData.student_grade}
                            onValueChange={(value) => handleInputChange("student_grade", value)}
                            disabled={isTrialConversionEntry}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择年级" />
                            </SelectTrigger>
                            <SelectContent>
                              {grades.map((grade) => (
                                <SelectItem key={grade.code} value={grade.code}>
                                  {grade.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="student_region">地域</Label>
                          <Select
                            value={formData.student_region}
                            onValueChange={(value) => handleInputChange("student_region", value)}
                            disabled={isTrialConversionEntry}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择地域" />
                            </SelectTrigger>
                            <SelectContent>
                              {regions.map((region) => (
                                <SelectItem key={region.code} value={region.code}>
                                  {region.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="order_number">订单号</Label>
                    <Input
                      id="order_number"
                      placeholder="留空自动生成"
                      value={formData.order_number}
                      onChange={(e) => handleInputChange("order_number", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">格式: L + 年月日时分 + 随机数</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="order_type">
                      订单类型 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="order_type"
                      value={formData.order_type}
                      onChange={(e) => handleInputChange("order_type", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择订单类型</option>
                      {orderTypes.map((type) => (
                        <option key={type.id} value={type.label}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="consultant_teacher">
                      销售/班主任 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="consultant_teacher"
                      value={formData.consultant_teacher}
                      onChange={(e) => handleInputChange("consultant_teacher", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择销售或班主任</option>
                      {consultants.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 关联信息 - 根据订单类型显示 */}
                {/* 新签显示关联线索 */}
                {(formData.order_type.includes('新') || formData.order_type.toLowerCase().includes('new')) && !sourceTrialLesson?.student_id && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lead_id">
                        关联线索 <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="lead_id"
                        value={formData.lead_id}
                        onChange={(e) => handleInputChange("lead_id", e.target.value)}
                        disabled={isTrialConversionEntry}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:bg-muted"
                        required
                      >
                        <option value="">请选择线索</option>
                        {leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.report_number} - {lead.parent_wechat} - {lead.student_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* 续费/扩科显示关联订单 */}
                {(formData.order_type.includes('续') || formData.order_type.includes('扩') || formData.order_type.toLowerCase().includes('renew') || formData.order_type.toLowerCase().includes('extend')) && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">

                    <div className="space-y-2">
                      <Label htmlFor="previous_order_id">
                        关联历史订单 <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="previous_order_id"
                        value={formData.previous_order_id}
                        onChange={(e) => handleInputChange("previous_order_id", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        required
                      >
                        <option value="">请选择之前订单</option>
                        {previousOrders
                          .filter(order => !formData.student_id || order.student_id === formData.student_id)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((order) => {
                            const studentName = students.find(s => s.id === order.student_id)?.student_name || '未知学生'
                            const date = order.created_at ? new Date(order.created_at).toLocaleDateString('zh-CN') : ''
                            return (
                              <option key={order.id} value={order.id}>
                                {order.order_number} - {studentName} - {order.total_hours || 0}课时 - {date}
                              </option>
                            )
                          })}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        {formData.student_id
                          ? "显示该学生的历史订单"
                          : "请先选择学生，将只显示该学生的历史订单"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="order_notes">订单备注</Label>
                  <Textarea
                    id="order_notes"
                    placeholder="请输入订单备注"
                    value={formData.order_notes}
                    onChange={(e) => handleInputChange("order_notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* 课程安排 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">课程安排</h3>

                <SearchableSelect
                  id="teacher_name"
                  label="老师姓名"
                  required
                  placeholder="搜索老师姓名..."
                  value={formData.teacher_name?.trim()}
                  onChange={(id, name) => handleInputChange("teacher_name", name?.trim())}
                  options={teachers.map((t) => ({
                    id: t.name?.trim() || t.id,
                    name: t.name?.trim() || "-",
                  }))}
                  loading={teachers.length === 0}
                />

                <div className="space-y-2">
                  <Label>
                    学科 (多选) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {subjects.map((subject) => (
                      <div key={subject.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`subject-${subject.id}`}
                          checked={selectedSubjects.includes(subject.label)}
                          onChange={() => handleSubjectToggle(subject.label)}
                          className="h-4 w-4"
                        />
                        <label
                          htmlFor={`subject-${subject.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {subject.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedSubjects.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个学科</p>
                  )}
                </div>

              </div>

              {/* 费用信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">费用信息</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_hours">
                      总课时(小时) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="total_hours"
                      type="number"
                      step="0.5"
                      placeholder="请输入总课时"
                      value={formData.total_hours}
                      onChange={(e) => handleInputChange("total_hours", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_channel">
                      付款渠道 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="payment_channel"
                      value={formData.payment_channel}
                      onChange={(e) => handleInputChange("payment_channel", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择付款渠道</option>
                      {paymentChannels.map((channel) => (
                        <option key={channel.id} value={channel.label}>
                          {channel.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_amount">
                      付款金额 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      placeholder="请输入付款金额"
                      value={formData.payment_amount}
                      onChange={(e) => handleInputChange("payment_amount", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hourly_rate">
                      小时单价 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      placeholder="自动计算或手动输入"
                      value={formData.hourly_rate}
                      onChange={(e) => handleInputChange("hourly_rate", e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
      根据总课时和付款金额自动计算，也可手动编辑
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_proof">
                      付款凭证 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="payment_proof"
                      type="file"
                      accept={PAYMENT_PROOF_ACCEPT}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const validationError = validatePaymentProofFile(file)
                          if (validationError) {
                            toast({
                              variant: "destructive",
                              title: "文件不符合要求",
                              description: validationError,
                            })
                            e.currentTarget.value = ""
                            setUploadedFile(null)
                            handleInputChange("payment_proof", "")
                            return
                          }

                          setUploadedFile(file)
                          handleInputChange("payment_proof", file.name)
                        }
                      }}
                      disabled={isSubmitting}
                      required
                    />
                    {uploadedFile && (
                      <p className="text-xs text-muted-foreground">
                        已选择: {uploadedFile.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_time">
                      付费时间 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="payment_time"
                      type="datetime-local"
                      value={formData.payment_time}
                      onChange={(e) => handleInputChange("payment_time", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/formal-orders">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    取消
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    "提交"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
