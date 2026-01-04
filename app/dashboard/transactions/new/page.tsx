"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { TransactionsService } from "@/lib/services/transactions"
import { StudentsService } from "@/lib/services/students"
import { getDictionaryItems } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewTransactionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 字典数据
  const [orderTypes, setOrderTypes] = useState<any[]>([])

  // 列表数据
  const [students, setStudents] = useState<any[]>([])

  const [formData, setFormData] = useState({
    creation_date: "",
    course_name: "",
    student_name: "",
    teacher_name: "",
    schedule_consumption: "",
    order_type: "",
    original_consultant: "",
    class_teacher: "",
    refund_reason: "",
    transaction_type: "",
    remaining_duration: "",
    refund_amount: "",
    bank_card_name: "",
    bank_card_number: "",
    bank_name: "",
    bank_branch: "",
    unit_price: "",
    status: "pending" as 'pending' | 'processing' | 'completed' | 'rejected',
  })

  // 加载字典数据和列表数据
  useEffect(() => {
    const loadData = async () => {
      const [orderTypeData, studentsData] = await Promise.all([
        getDictionaryItems('payment_type'),
        StudentsService.getAllStudents(),
      ])
      setOrderTypes(orderTypeData)
      setStudents(studentsData)
    }
    loadData()
  }, [])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.creation_date) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入创建日期",
      })
      return
    }

    if (!formData.student_name || !formData.student_name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入学生姓名",
      })
      return
    }

    if (!formData.transaction_type || !formData.transaction_type.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入异动类型",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        creation_date: formData.creation_date,
        course_name: formData.course_name.trim() || undefined,
        student_name: formData.student_name.trim(),
        teacher_name: formData.teacher_name.trim() || undefined,
        schedule_consumption: formData.schedule_consumption ? parseFloat(formData.schedule_consumption) : undefined,
        order_type: formData.order_type.trim() || undefined,
        original_consultant: formData.original_consultant.trim() || undefined,
        class_teacher: formData.class_teacher.trim() || undefined,
        refund_reason: formData.refund_reason.trim() || undefined,
        transaction_type: formData.transaction_type.trim(),
        remaining_duration: formData.remaining_duration ? parseFloat(formData.remaining_duration) : undefined,
        refund_amount: formData.refund_amount ? parseFloat(formData.refund_amount) : undefined,
        bank_card_name: formData.bank_card_name.trim() || undefined,
        bank_card_number: formData.bank_card_number.trim() || undefined,
        bank_name: formData.bank_name.trim() || undefined,
        bank_branch: formData.bank_branch.trim() || undefined,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : undefined,
        status: formData.status,
      }

      await TransactionsService.createTransaction(payload)

      toast({
        title: "创建成功",
        description: "异动记录已创建",
      })

      router.push("/dashboard/transactions")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建异动记录",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增异动记录"
        description="填写退费异动记录信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="creation_date">
                      创建日期 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="creation_date"
                      type="date"
                      value={formData.creation_date}
                      onChange={(e) => handleInputChange("creation_date", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student_name">
                      学生姓名 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="student_name"
                      value={formData.student_name}
                      onChange={(e) => handleInputChange("student_name", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择学生</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.student_name}>
                          {student.student_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="course_name">课程名称</Label>
                    <Input
                      id="course_name"
                      placeholder="请输入课程名称"
                      value={formData.course_name}
                      onChange={(e) => handleInputChange("course_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teacher_name">老师姓名</Label>
                    <Input
                      id="teacher_name"
                      placeholder="请输入老师姓名"
                      value={formData.teacher_name}
                      onChange={(e) => handleInputChange("teacher_name", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transaction_type">
                      异动类型 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="transaction_type"
                      value={formData.transaction_type}
                      onChange={(e) => handleInputChange("transaction_type", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择</option>
                      <option value="退费">退费</option>
                      <option value="换课">换课</option>
                      <option value="转班">转班</option>
                      <option value="停课">停课</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="order_type">订单类型</Label>
                    <select
                      id="order_type"
                      value={formData.order_type}
                      onChange={(e) => handleInputChange("order_type", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择订单类型</option>
                      {orderTypes.map((type) => (
                        <option key={type.id} value={type.label}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="original_consultant">原顾问</Label>
                    <Input
                      id="original_consultant"
                      placeholder="请输入原顾问"
                      value={formData.original_consultant}
                      onChange={(e) => handleInputChange("original_consultant", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="class_teacher">班主任</Label>
                    <Input
                      id="class_teacher"
                      placeholder="请输入班主任"
                      value={formData.class_teacher}
                      onChange={(e) => handleInputChange("class_teacher", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">
                      状态 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="pending">待处理</option>
                      <option value="processing">处理中</option>
                      <option value="completed">已完成</option>
                      <option value="rejected">已拒绝</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 课程与费用信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">课程与费用信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule_consumption">课表耗</Label>
                    <Input
                      id="schedule_consumption"
                      type="number"
                      step="0.01"
                      placeholder="请输入课表耗"
                      value={formData.schedule_consumption}
                      onChange={(e) => handleInputChange("schedule_consumption", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remaining_duration">剩余时长</Label>
                    <Input
                      id="remaining_duration"
                      type="number"
                      step="0.01"
                      placeholder="请输入剩余时长"
                      value={formData.remaining_duration}
                      onChange={(e) => handleInputChange("remaining_duration", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">单价</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      placeholder="请输入单价"
                      value={formData.unit_price}
                      onChange={(e) => handleInputChange("unit_price", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="refund_amount">退费金额</Label>
                    <Input
                      id="refund_amount"
                      type="number"
                      step="0.01"
                      placeholder="请输入退费金额"
                      value={formData.refund_amount}
                      onChange={(e) => handleInputChange("refund_amount", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refund_reason">退费原因</Label>
                  <Textarea
                    id="refund_reason"
                    placeholder="请输入退费原因"
                    value={formData.refund_reason}
                    onChange={(e) => handleInputChange("refund_reason", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* 银行卡信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">银行卡信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_card_name">银行卡姓名</Label>
                    <Input
                      id="bank_card_name"
                      placeholder="请输入银行卡姓名"
                      value={formData.bank_card_name}
                      onChange={(e) => handleInputChange("bank_card_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_card_number">银行卡卡号</Label>
                    <Input
                      id="bank_card_number"
                      placeholder="请输入银行卡卡号"
                      value={formData.bank_card_number}
                      onChange={(e) => handleInputChange("bank_card_number", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">所属银行</Label>
                    <Input
                      id="bank_name"
                      placeholder="请输入所属银行"
                      value={formData.bank_name}
                      onChange={(e) => handleInputChange("bank_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_branch">银行支行</Label>
                    <Input
                      id="bank_branch"
                      placeholder="请输入银行支行"
                      value={formData.bank_branch}
                      onChange={(e) => handleInputChange("bank_branch", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/transactions">
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
