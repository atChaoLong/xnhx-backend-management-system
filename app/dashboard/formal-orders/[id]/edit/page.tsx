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
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function EditFormalOrderPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [order, setOrder] = useState<FormalOrder | null>(null)

  const orderId = params.id as string

  const [formData, setFormData] = useState({
    // 关联字段
    student_id: "",

    // 订单基本信息
    order_number: "",
    order_type: "",
    consultant_teacher: "",
    order_notes: "",

    // 课程安排
    teacher_names: "",
    subjects: "",
    total_sessions: "",
    session_duration: "",
    fixed_mode: "",
    frequency: "",
    official_start_time: "",
    first_class_time: "",

    // 费用信息
    total_hours: "",
    payment_channel: "",
    payment_amount: "",
    hourly_rate: "",
    payment_proof: "",
    payment_time: "",

    // 状态管理
    status: "active" as 'active' | 'completed' | 'cancelled' | 'suspended',
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
          order_number: data.order_number || "",
          order_type: data.order_type || "",
          consultant_teacher: data.consultant_teacher || "",
          order_notes: data.order_notes || "",
          teacher_names: data.teacher_names?.join(', ') || "",
          subjects: data.subjects?.join(', ') || "",
          total_sessions: data.total_sessions?.toString() || "",
          session_duration: data.session_duration?.toString() || "",
          fixed_mode: data.fixed_mode || "",
          frequency: data.frequency || "",
          official_start_time: data.official_start_time ? new Date(data.official_start_time).toISOString().slice(0, 16) : "",
          first_class_time: data.first_class_time ? new Date(data.first_class_time).toISOString().slice(0, 16) : "",
          total_hours: data.total_hours?.toString() || "",
          payment_channel: data.payment_channel || "",
          payment_amount: data.payment_amount?.toString() || "",
          hourly_rate: data.hourly_rate?.toString() || "",
          payment_proof: data.payment_proof || "",
          payment_time: data.payment_time ? new Date(data.payment_time).toISOString().slice(0, 16) : "",
          status: data.status || "active",
        })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    const requiredFields = [
      { field: 'student_id', name: '学生ID' },
      { field: 'order_type', name: '订单类型' },
      { field: 'consultant_teacher', name: '签约顾问' },
      { field: 'teacher_names', name: '老师姓名' },
      { field: 'subjects', name: '学科' },
      { field: 'total_sessions', name: '总课时数' },
      { field: 'session_duration', name: '单课时长' },
      { field: 'fixed_mode', name: '固定模式' },
      { field: 'frequency', name: '频次' },
      { field: 'official_start_time', name: '正式上课时间' },
      { field: 'first_class_time', name: '首次课时间' },
      { field: 'total_hours', name: '总课时(小时)' },
      { field: 'payment_channel', name: '付款渠道' },
      { field: 'payment_amount', name: '付款金额' },
      { field: 'hourly_rate', name: '小时单价' },
      { field: 'payment_proof', name: '付款凭证' },
      { field: 'payment_time', name: '付费时间' },
    ]

    for (const { field, name } of requiredFields) {
      const value = formData[field as keyof typeof formData]
      if (!value || (typeof value === 'string' && !value.trim())) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: `请输入${name}`,
        })
        return
      }
    }

    // 验证数组字段
    const teacherArray = formData.teacher_names.split(',').map(s => s.trim()).filter(s => s)
    const subjectArray = formData.subjects.split(',').map(s => s.trim()).filter(s => s)

    if (teacherArray.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一位老师",
      })
      return
    }

    if (subjectArray.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个学科",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        id: orderId,
        student_id: formData.student_id.trim(),
        order_number: formData.order_number.trim() || generateOrderNumber(),
        order_type: formData.order_type.trim(),
        consultant_teacher: formData.consultant_teacher.trim(),
        order_notes: formData.order_notes.trim() || undefined,
        teacher_names: teacherArray,
        subjects: subjectArray,
        total_sessions: parseInt(formData.total_sessions),
        session_duration: parseFloat(formData.session_duration),
        fixed_mode: formData.fixed_mode.trim(),
        frequency: formData.frequency.trim(),
        official_start_time: formData.official_start_time,
        first_class_time: formData.first_class_time,
        total_hours: parseFloat(formData.total_hours),
        payment_channel: formData.payment_channel.trim(),
        payment_amount: parseFloat(formData.payment_amount),
        hourly_rate: parseFloat(formData.hourly_rate),
        payment_proof: formData.payment_proof.trim(),
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student_id">
                      学生ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="student_id"
                      placeholder="请输入学生ID"
                      value={formData.student_id}
                      onChange={(e) => handleInputChange("student_id", e.target.value)}
                      required
                    />
                  </div>

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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="order_type">
                      订单类型 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="order_type"
                      placeholder="请输入订单类型"
                      value={formData.order_type}
                      onChange={(e) => handleInputChange("order_type", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="consultant_teacher">
                      签约顾问/班主任 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="consultant_teacher"
                      placeholder="请输入签约顾问"
                      value={formData.consultant_teacher}
                      onChange={(e) => handleInputChange("consultant_teacher", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order_notes">订单备注</Label>
                  <textarea
                    id="order_notes"
                    placeholder="请输入订单备注"
                    value={formData.order_notes}
                    onChange={(e) => handleInputChange("order_notes", e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 课程安排 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">课程安排</h3>

                <div className="space-y-2">
                  <Label htmlFor="teacher_names">
                    老师姓名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="teacher_names"
                    placeholder="多个老师用逗号分隔，如: 张老师,李老师"
                    value={formData.teacher_names}
                    onChange={(e) => handleInputChange("teacher_names", e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">多个老师用逗号分隔</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subjects">
                    学科 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="subjects"
                    placeholder="多个学科用逗号分隔，如: 数学,英语"
                    value={formData.subjects}
                    onChange={(e) => handleInputChange("subjects", e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">多个学科用逗号分隔</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_sessions">
                      总课时数 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="total_sessions"
                      type="number"
                      placeholder="请输入总课时数"
                      value={formData.total_sessions}
                      onChange={(e) => handleInputChange("total_sessions", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session_duration">
                      单课时长(小时) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="session_duration"
                      type="number"
                      step="0.5"
                      placeholder="例如: 1.0"
                      value={formData.session_duration}
                      onChange={(e) => handleInputChange("session_duration", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fixed_mode">
                      固定模式 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fixed_mode"
                      placeholder="请输入固定模式"
                      value={formData.fixed_mode}
                      onChange={(e) => handleInputChange("fixed_mode", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">
                      频次 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="frequency"
                      placeholder="请输入频次"
                      value={formData.frequency}
                      onChange={(e) => handleInputChange("frequency", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="official_start_time">
                      正式上课时间 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="official_start_time"
                      type="datetime-local"
                      value={formData.official_start_time}
                      onChange={(e) => handleInputChange("official_start_time", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="first_class_time">
                      首次课时间 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="first_class_time"
                      type="datetime-local"
                      value={formData.first_class_time}
                      onChange={(e) => handleInputChange("first_class_time", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 费用信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">费用信息</h3>

                <div className="grid grid-cols-2 gap-4">
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
                    <Input
                      id="payment_channel"
                      placeholder="请输入付款渠道"
                      value={formData.payment_channel}
                      onChange={(e) => handleInputChange("payment_channel", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
