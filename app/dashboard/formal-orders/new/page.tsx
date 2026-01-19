"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { FormalOrdersService, NewFormalOrder, generateOrderNumber } from "@/lib/services/formalOrders"
import { TeachersService } from "@/lib/services/teachers"
import { StudentsService } from "@/lib/services/students"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { LeadsService } from "@/lib/services/leads"
import { UserProfilesService } from "@/lib/services/userProfiles"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"

export default function NewFormalOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 字典数据
  const { items: orderTypes, loading: orderTypesLoading } = useDictionary('order_type')
  const { items: paymentChannels, loading: paymentChannelsLoading } = useDictionary('payment_channel')
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')

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

  // 加载列表数据
  useEffect(() => {
    const loadData = async () => {
      const [teachersData, studentsData, salesData, headTeachersData, leadsResult, ordersResult] = await Promise.all([
        TeachersService.getAllTeachers(),
        StudentsService.getAllStudents(),
        UserProfilesService.getUsers('sales'),
        UserProfilesService.getUsers('head_teacher'),
        LeadsService.getLeads(),
        FormalOrdersService.getAllFormalOrders(),
      ])
      setTeachers(teachersData)
      setStudents(studentsData)
      const mergedConsultants = [
        ...(salesData || []).map(u => ({ id: u.id, name: u.name })),
        ...(headTeachersData || []).map(u => ({ id: u.id, name: u.name })),
      ]
      setConsultants(mergedConsultants)
      setLeads(leadsResult.data || [])
      setPreviousOrders(ordersResult || [])
    }
    loadData()
  }, [])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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

    // 验证必填字段
    if (!formData.student_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择学生",
      })
      return
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

    const isRenew = String(formData.order_type) === 'renew'
    const isNewOrExpand = String(formData.order_type) === 'new' || String(formData.order_type) === 'extend'
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
      const payload: NewFormalOrder = {
        student_id: formData.student_id,
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
        payment_proof: formData.payment_proof, // 文件上传后需要获取实际URL
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SearchableSelect
                    id="student_id"
                    label="选择学生"
                    required
                    placeholder="搜索学生姓名..."
                    value={formData.student_id}
                    onChange={(id, name) => handleInputChange("student_id", id)}
                    options={students.map((s) => ({ id: s.id, name: s.student_name }))}
                    loading={students.length === 0}
                  />

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

                {/* 关联信息（紧贴订单类型下方） */}
                <div className="space-y-4">
                {(String(formData.order_type) === 'new' || String(formData.order_type) === 'extend') && (
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
                            {lead.report_number || lead.parent_wechat || lead.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {String(formData.order_type) === 'renew' && (
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
                        {previousOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.order_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

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
                      placeholder="请输入小时单价"
                      value={formData.hourly_rate}
                      onChange={(e) => handleInputChange("hourly_rate", e.target.value)}
                      required
                    />
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
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadedFile(file)
                          handleInputChange("payment_proof", file.name)
                        }
                      }}
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
