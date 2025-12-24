"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { DailyLeadsService, NewDailyLead } from "@/lib/services/dailyLeads"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewDailyLeadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    wechat_number: "",
    assigned_person: "",
    received_date: new Date().toISOString().split('T')[0], // 默认今天
    is_added: false,
    resume_attachment: "",
    notes: "",
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入姓名",
      })
      return
    }

    if (!formData.wechat_number.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入微信号",
      })
      return
    }

    if (!formData.assigned_person.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入归属人员",
      })
      return
    }

    if (!formData.received_date) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择领取日期",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload: NewDailyLead = {
        name: formData.name.trim(),
        wechat_number: formData.wechat_number.trim(),
        assigned_person: formData.assigned_person.trim(),
        received_date: formData.received_date,
        is_added: formData.is_added,
        resume_attachment: formData.resume_attachment.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      }

      await DailyLeadsService.createDailyLead(payload)

      toast({
        title: "创建成功",
        description: "线索已创建",
      })

      router.push("/dashboard/daily-leads")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建线索",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增每日线索"
        description="填写线索信息以创建新的每日线索记录"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    姓名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="请输入姓名"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wechat_number">
                    微信号 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="wechat_number"
                    placeholder="请输入微信号"
                    value={formData.wechat_number}
                    onChange={(e) => handleInputChange("wechat_number", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_person">
                    归属人员 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="assigned_person"
                    placeholder="请输入归属人员"
                    value={formData.assigned_person}
                    onChange={(e) => handleInputChange("assigned_person", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="received_date">
                    领取日期 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="received_date"
                    type="date"
                    value={formData.received_date}
                    onChange={(e) => handleInputChange("received_date", e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_added"
                    checked={formData.is_added}
                    onCheckedChange={(checked) => handleInputChange("is_added", checked as boolean)}
                  />
                  <Label htmlFor="is_added" className="cursor-pointer">
                    已添加（转为候选人）
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resume_attachment">简历附件</Label>
                  <Input
                    id="resume_attachment"
                    placeholder="简历附件URL"
                    value={formData.resume_attachment}
                    onChange={(e) => handleInputChange("resume_attachment", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    暂时只支持输入URL，文件上传功能即将推出
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">备注</Label>
                  <Textarea
                    id="notes"
                    placeholder="请输入备注信息"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/daily-leads">
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
