"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { FormalOrdersService, FormalOrder, generateOrderNumber } from "@/lib/services/formalOrders"
import { TeachersService } from "@/lib/services/teachers"
import { StudentsService, generateStudentCode } from "@/lib/services/students"
import { DictionaryService } from "@/lib/services/dictionary"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { LeadsService } from "@/lib/services/leads"
import { UserProfilesService } from "@/lib/services/userProfiles"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function EditFormalOrderPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [order, setOrder] = useState<FormalOrder | null>(null)

  const orderId = params.id as string

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

  // 加载正式订单数据
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsLoading(true)
        const data = await FormalOrdersService.getFormalOrderById(orderId)
        setOrder(data)

        // 设置表单数据
        setFormData({
          student_id: data.student_id || "",
          lead_id: data.lead_id || "",
          previous_order_id: data.previous_order_id || "",
          teacher_name: data.teacher_names?.[0] || "",
          student_name: "", // 编辑时从学生数据加载
          student_grade: "",
          student_region: "",
          parent_phone: "",
          order_number: data.order_number || "",
          order_type: data.order_type || "",
          consultant_teacher: data.consultant_teacher || "",
          order_notes: data.order_notes || "",
          total_hours: data.total_hours?.toString() || "",
          payment_channel: data.payment_channel || "",
          payment_amount: data.payment_amount?.toString() || "",
          hourly_rate: data.hourly_rate?.toString() || "",
          payment_proof: data.payment_proof || "",
          payment_time: data.payment_time ? new Date(data.payment_time).toISOString().slice(0, 16) : "",
          status: data.status || "active",
        })

        // 设置多选数组
        setSelectedSubjects(data.subjects || [])

        // 如果有学生ID，加载学生信息填充到表单
        if (data.student_id) {
          try {
            const studentData = await StudentsService.getStudentById(data.student_id)
            setFormData((prev) => ({
              ...prev,
              student_name: studentData.student_name || "",
              student_grade: studentData.grade_code || "",
              student_region: studentData.region || "",
              parent_phone: studentData.parent_phone || "",
            }))
          } catch (error) {
            console.error("加载学生信息失败:", error)
          }
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载正式订单数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  // 加载列表数据
  useEffect(() => {
    const loadData = async () => {
      const [teachersData, studentsData, salesData, headTeachersData, leadsResult, ordersResult, dicts] = await Promise.all([
        TeachersService.getAllTeachers(),
        StudentsService.getAllStudents(),
        UserProfilesService.getUsers('sales'),
        UserProfilesService.getUsers('head_teacher'),
        LeadsService.getLeads(),
        FormalOrdersService.getAllFormalOrders(),
        DictionaryService.getAllDictionaries(),
      ])
      setTeachers(teachersData)
      setStudents(studentsData)

      // 合并销售和班主任为 consultants
      const mergedConsultants = [
        ...(salesData || []).map(u => ({ id: u.id, name: u.name })),
        ...(headTeachersData || []).map(u => ({ id: u.id, name: u.name })),
      ]
      setConsultants(mergedConsultants)

      setLeads(leadsResult?.data || [])
      setPreviousOrders(ordersResult || [])

      // 提取年级和地域字典（dicts 是对象，不是数组）
      const gradeItems = dicts?.['grade'] || []
      const regionItems = dicts?.['region'] || []

      setGrades(gradeItems.map(item => ({ code: item.code, label: item.label })))
      setRegions(regionItems.map(item => ({ code: item.code, label: item.label })))

      setIsLoadingDict(false)
    }
    loadData()
  }, [])

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

  // 处理学生选择
  const handleStudentSelect = async (studentId: string) => {
    setFormData((prev) => ({ ...prev, student_id: studentId }))

    if (!studentId) {
      // 清空学生信息
      setFormData((prev) => ({
        ...prev,
        student_id: "",
        student_name: "",
        student_grade: "",
        student_region: "",
        parent_phone: "",
      }))
      return
    }

    // 加载学生详细信息
    try {
      const studentData = await StudentsService.getStudentById(studentId)
      setFormData((prev) => ({
        ...prev,
        student_name: studentData.student_name || "",
        student_grade: studentData.grade_code || "",
        student_region: studentData.region || "",
        parent_phone: studentData.parent_phone || "",
      }))
    } catch (error) {
      console.error("加载学生信息失败:", error)
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法加载学生信息",
      })
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

    const isRenew = formData.order_type.includes('续') || formData.order_type.toLowerCase().includes('renew')
    const isNewOrExpand = formData.order_type.includes('新') || formData.order_type.includes('扩') || formData.order_type.toLowerCase().includes('new') || formData.order_type.toLowerCase().includes('extend')
    if (isNewOrExpand && !formData.lead_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "新签/扩课必须选择关联线索",
      })
      return
    }
    if (isRenew && !formData.previous_order_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "续费必须选择之前的订单",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 判断是否需要创建/更新学生
      let studentId = formData.student_id
      const hasManualInput = formData.student_name?.trim() && formData.parent_phone?.trim()

      if (hasManualInput) {
        try {
          if (!studentId) {
            // 创建新学生
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
            // 更新现有学生信息
            await StudentsService.updateStudent({
              id: studentId,
              student_name: formData.student_name.trim(),
              grade_code: formData.student_grade?.trim() || undefined,
              region: formData.student_region?.trim() || '',
              parent_phone: formData.parent_phone.trim(),
            })
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

      const payload = {
        id: orderId,
        student_id: studentId || formData.student_id,
        order_number: formData.order_number.trim() || generateOrderNumber(),
        order_type: formData.order_type,
        consultant_teacher: formData.consultant_teacher,
        order_notes: formData.order_notes.trim() || undefined,
        lead_id: formData.lead_id || undefined,
        previous_order_id: formData.previous_order_id || undefined,
        teacher_names: [formData.teacher_name],
        subjects: selectedSubjects,
        total_hours: parseFloat(formData.total_hours),
        payment_channel: formData.payment_channel,
        payment_amount: parseFloat(formData.payment_amount),
        hourly_rate: parseFloat(formData.hourly_rate),
        payment_proof: formData.payment_proof,
        payment_time: formData.payment_time,
        status: formData.status,
      }

      await FormalOrdersService.updateFormalOrder(payload)

      toast({
        title: "保存成功",
        description: "正式订单信息已更新",
      })

      router.push("/dashboard/formal-orders")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新正式订单",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑正式订单" description="修改正式订单信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑正式订单" description="修改正式订单信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">正式订单不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该正式订单信息</p>
            <Link href="/dashboard/formal-orders">
              <Button>返回列表</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="编辑正式订单"
        description="修改正式订单信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 订单基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">订单基本信息</h3>

                {/* 学生选择（可选） */}
                <div className="space-y-2">
                  <Label htmlFor="student_id" className="text-sm font-medium">
                    选择学生（可选，可手动录入）
                  </Label>
                  <SearchableSelect
                    id="student_id"
                    placeholder="搜索学生姓名..."
                    value={formData.student_id}
                    onChange={(id, name) => handleStudentSelect(id)}
                    options={students.map((s) => ({ id: s.id, name: s.student_name }))}
                    loading={students.length === 0}
                  />
                  <p className="text-xs text-muted-foreground">可选择已有学生，或直接在下方手动录入信息</p>
                </div>

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
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="student_grade">年级</Label>
                          <Select
                            value={formData.student_grade}
                            onValueChange={(value) => handleInputChange("student_grade", value)}
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
                {(formData.order_type.includes('新') || formData.order_type.includes('扩') || formData.order_type.toLowerCase().includes('new') || formData.order_type.toLowerCase().includes('extend')) && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lead_id">
                        关联线索 <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="lead_id"
                        value={formData.lead_id}
                        onChange={(e) => handleInputChange("lead_id", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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

                {(formData.order_type.includes('续') || formData.order_type.toLowerCase().includes('renew')) && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="previous_order_id">
                        关联之前订单 <span className="text-destructive">*</span>
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
                          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
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
                      付款凭证URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="payment_proof"
                      placeholder="请输入付款凭证URL"
                      value={formData.payment_proof}
                      onChange={(e) => handleInputChange("payment_proof", e.target.value)}
                      required
                    />
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

              {/* 状态 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">状态</h3>

                <div className="space-y-2">
                  <Label htmlFor="status">状态</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleInputChange("status", e.target.value as any)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="active">进行中</option>
                    <option value="completed">已完成</option>
                    <option value="cancelled">已取消</option>
                    <option value="suspended">已暂停</option>
                  </select>
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
                      更新中...
                    </>
                  ) : (
                    "更新"
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
