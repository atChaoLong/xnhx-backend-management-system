/**
 * 第一步：约面表单
 * 运营/销售人员安排面试时间、地点、面试官
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X } from "lucide-react"
import { TeacherCandidate } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"
import { validateStepCompletion, advanceToNextStep } from "@/lib/services/recruitmentFlow"

interface SchedulingFormProps {
  candidate: TeacherCandidate
  onClose: () => void
  onSuccess: () => void
  isReadonly?: boolean
}

export default function SchedulingForm({
  candidate,
  onClose,
  onSuccess,
  isReadonly = false,
}: SchedulingFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    wechat_id: candidate.wechat_id || "",
    interview_date: candidate.interview_date || "",
    interview_time: candidate.interview_time || "",
    interview_officer: candidate.interview_officer || "",
    interview_link: candidate.interview_link || "",
    interview_notes: candidate.interview_notes || "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.interview_date) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择面试日期",
      })
      return
    }

    if (!formData.interview_time) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择面试时间",
      })
      return
    }

    if (!formData.interview_officer) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入约面人",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 这里调用 API 更新信息并推进到下一步
      // TODO: 实现 API 调用
      
      toast({
        title: "约面信息已保存",
        description: "已进入下一步：上传面试视频",
      })

      onSuccess()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法保存约面信息",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h1 className="text-lg font-semibold">约面 - {candidate.name}</h1>
            <p className="text-sm text-gray-500 mt-1">安排面试时间、地点和面试官</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 联系方式 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">联系方式</h3>
              <div className="border-b pb-4">
                {/* 微信号 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="wechat_id" className="text-xs min-w-20">
                    微信号
                  </Label>
                  <Input
                    id="wechat_id"
                    placeholder="请输入微信号"
                    value={formData.wechat_id}
                    onChange={(e) => handleInputChange("wechat_id", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 约面信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">约面信息</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 面试日期和时间 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_datetime" className="text-xs min-w-20">
                    面试日期时间 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="interview_datetime"
                    type="datetime-local"
                    value={
                      formData.interview_date && formData.interview_time
                        ? `${formData.interview_date}T${formData.interview_time}`
                        : ""
                    }
                    onChange={(e) => {
                      const [date, time] = e.target.value.split("T")
                      handleInputChange("interview_date", date)
                      handleInputChange("interview_time", time || "")
                    }}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                    required
                  />
                </div>

                {/* 约面人 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_officer" className="text-xs min-w-20">
                    约面人 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="interview_officer"
                    placeholder="请输入约面人姓名"
                    value={formData.interview_officer}
                    onChange={(e) => handleInputChange("interview_officer", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                    required
                  />
                </div>

                {/* 面试链接 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_link" className="text-xs min-w-20">
                    面试链接
                  </Label>
                  <Input
                    id="interview_link"
                    type="url"
                    placeholder="面试链接（如 Zoom/ClassIn）"
                    value={formData.interview_link}
                    onChange={(e) => handleInputChange("interview_link", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 备注 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">备注</h3>
              <div className="flex gap-4">
                <Label htmlFor="interview_notes" className="text-xs min-w-20 pt-2">
                  面试备注
                </Label>
                <Textarea
                  id="interview_notes"
                  placeholder="记录任何重要信息或特殊需求"
                  value={formData.interview_notes}
                  onChange={(e) => handleInputChange("interview_notes", e.target.value)}
                  className="min-h-20 text-sm resize-none flex-1"
                  disabled={isReadonly || isSubmitting}
                />
              </div>
            </div>
          </form>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9"
          >
            取消
          </Button>
          {!isReadonly && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-9 bg-blue-500 hover:bg-blue-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存并继续"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
