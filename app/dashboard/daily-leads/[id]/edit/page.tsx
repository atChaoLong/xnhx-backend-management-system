"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { DailyLeadsService, DailyLead } from "@/lib/services/dailyLeads"
import { useToast } from "@/hooks/use-toast"
import {
  LEAD_RESUME_ACCEPT,
  uploadLeadResume,
  validateLeadResumeFile,
} from "@/lib/services/upload"
import Link from "next/link"

export default function EditDailyLeadPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lead, setLead] = useState<DailyLead | null>(null)
  const [resumeFileName, setResumeFileName] = useState("")

  const leadId = params.id as string

  const [formData, setFormData] = useState({
    name: "",
    wechat_number: "",
    assigned_person: "",
    received_date: "",
    is_added: false,
    resume_attachment: "",
    notes: "",
  })

  // 加载线索数据
  useEffect(() => {
    const fetchLead = async () => {
      try {
        setIsLoading(true)
        const data = await DailyLeadsService.getDailyLeadById(leadId)
        setLead(data)

        // 设置表单数据
        setFormData({
          name: data.name || "",
          wechat_number: data.wechat_number || "",
          assigned_person: data.assigned_person || "",
          received_date: data.received_date || "",
          is_added: data.is_added || false,
          resume_attachment: data.resume_attachment || "",
          notes: data.notes || "",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载线索数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchLead()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateLeadResumeFile(file)
    if (validationError) {
      toast({
        variant: "destructive",
        title: "文件不符合要求",
        description: validationError,
      })
      e.target.value = ""
      setResumeFileName("")
      return
    }

    setIsUploadingResume(true)
    setResumeFileName(file.name)

    try {
      const url = await uploadLeadResume(file)
      handleInputChange("resume_attachment", url)
      toast({
        title: "上传成功",
        description: "简历附件已上传",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error.message || "无法上传简历附件",
      })
      e.target.value = ""
      setResumeFileName("")
    } finally {
      setIsUploadingResume(false)
    }
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
      const payload = {
        id: leadId,
        name: formData.name.trim(),
        wechat_number: formData.wechat_number.trim(),
        assigned_person: formData.assigned_person.trim(),
        received_date: formData.received_date,
        is_added: formData.is_added,
        resume_attachment: formData.resume_attachment.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      }

      await DailyLeadsService.updateDailyLead(payload)

      toast({
        title: "保存成功",
        description: "线索信息已更新",
      })

      router.push("/dashboard/daily-leads")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新线索",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑每日线索" description="修改线索信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑每日线索" description="修改线索信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">线索不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该线索信息</p>
            <Link href="/dashboard/daily-leads">
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
        title="编辑每日线索"
        description="修改线索信息"
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
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      id="resume_attachment_file"
                      type="file"
                      accept={LEAD_RESUME_ACCEPT}
                      onChange={handleResumeFileChange}
                      disabled={isUploadingResume || isSubmitting}
                      className="sr-only"
                    />
                    <Input
                      value={resumeFileName || "未选择文件"}
                      readOnly
                      disabled={isUploadingResume}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploadingResume || isSubmitting}
                      onClick={() => document.getElementById("resume_attachment_file")?.click()}
                    >
                      {isUploadingResume ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          上传中...
                        </>
                      ) : (
                        "选择文件"
                      )}
                    </Button>
                  </div>
                  <Input
                    id="resume_attachment"
                    placeholder="也可以粘贴简历附件URL"
                    value={formData.resume_attachment}
                    onChange={(e) => handleInputChange("resume_attachment", e.target.value)}
                    disabled={isUploadingResume}
                  />
                  <p className="text-xs text-muted-foreground">
                    支持 PDF、Word 或图片，最大 50MB
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
                  <Button type="button" variant="outline" disabled={isSubmitting || isUploadingResume}>
                    取消
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || isUploadingResume}>
                  {isUploadingResume ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : isSubmitting ? (
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
