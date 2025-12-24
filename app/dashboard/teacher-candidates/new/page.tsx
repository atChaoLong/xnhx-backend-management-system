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
import { TeacherCandidatesService, NewTeacherCandidate } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewTeacherCandidatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    // 基本信息
    name: "",
    wechat_id: "",
    daily_lead_id: "",
    resume_url: "",
    profile_photo_url: "",

    // 岗位信息
    grade_level: "",
    subjects_taught: "",
    teacher_type: "",
    trial_subject: "",
    teaching_style: "",

    // 约面信息
    interview_date: "",
    interviewer_name: "",
    interview_time: "",
    interview_link: "",
    interview_officer: "",

    // 复核状态
    review_status: "待复核" as '待复核' | '已复核' | '不符合',
    reviewer_name: "",
    review_result: "",
    review_evaluation_comment: "",

    // 招聘决定
    is_hired: false,
    teacher_level: "",
    can_teach_graduation_class: false,
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

    if (!formData.wechat_id.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入微信号",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload: NewTeacherCandidate = {
        name: formData.name.trim(),
        wechat_id: formData.wechat_id.trim(),
        daily_lead_id: formData.daily_lead_id || undefined,
        resume_url: formData.resume_url.trim() || undefined,
        profile_photo_url: formData.profile_photo_url.trim() || undefined,
        grade_level: formData.grade_level || undefined,
        subjects_taught: formData.subjects_taught ? formData.subjects_taught.split(',').map(s => s.trim()) : undefined,
        teacher_type: formData.teacher_type || undefined,
        trial_subject: formData.trial_subject || undefined,
        teaching_style: formData.teaching_style || undefined,
        interview_date: formData.interview_date || undefined,
        interviewer_name: formData.interviewer_name || undefined,
        interview_time: formData.interview_time || undefined,
        interview_link: formData.interview_link || undefined,
        interview_officer: formData.interview_officer || undefined,
        review_status: formData.review_status,
        reviewer_name: formData.reviewer_name || undefined,
        review_result: formData.review_result || undefined,
        review_evaluation_comment: formData.review_evaluation_comment || undefined,
        is_hired: formData.is_hired,
        teacher_level: formData.teacher_level || undefined,
        can_teach_graduation_class: formData.can_teach_graduation_class,
      }

      await TeacherCandidatesService.createTeacherCandidate(payload)

      toast({
        title: "创建成功",
        description: "教师候选已创建",
      })

      router.push("/dashboard/teacher-candidates")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建候选",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增教师候选"
        description="填写教师候选信息（核心字段）"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="wechat_id">
                      微信号 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wechat_id"
                      placeholder="请输入微信号"
                      value={formData.wechat_id}
                      onChange={(e) => handleInputChange("wechat_id", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_lead_id">每日线索ID</Label>
                  <Input
                    id="daily_lead_id"
                    placeholder="关联的每日线索ID（可选）"
                    value={formData.daily_lead_id}
                    onChange={(e) => handleInputChange("daily_lead_id", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade_level">年级</Label>
                    <Input
                      id="grade_level"
                      placeholder="例如：小学、初中、高中"
                      value={formData.grade_level}
                      onChange={(e) => handleInputChange("grade_level", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subjects_taught">科目（逗号分隔）</Label>
                    <Input
                      id="subjects_taught"
                      placeholder="例如：数学,英语,物理"
                      value={formData.subjects_taught}
                      onChange={(e) => handleInputChange("subjects_taught", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teaching_style">教学风格</Label>
                  <Textarea
                    id="teaching_style"
                    placeholder="请描述教学风格"
                    value={formData.teaching_style}
                    onChange={(e) => handleInputChange("teaching_style", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* 约面信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">约面信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interview_date">面试日期</Label>
                    <Input
                      id="interview_date"
                      type="date"
                      value={formData.interview_date}
                      onChange={(e) => handleInputChange("interview_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interview_time">面试时间</Label>
                    <Input
                      id="interview_time"
                      type="time"
                      value={formData.interview_time}
                      onChange={(e) => handleInputChange("interview_time", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interviewer_name">面试官</Label>
                    <Input
                      id="interviewer_name"
                      placeholder="面试官姓名"
                      value={formData.interviewer_name}
                      onChange={(e) => handleInputChange("interviewer_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interview_link">面试链接</Label>
                    <Input
                      id="interview_link"
                      placeholder="面试链接"
                      value={formData.interview_link}
                      onChange={(e) => handleInputChange("interview_link", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 复核状态 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">复核状态</h3>

                <div className="space-y-2">
                  <Label htmlFor="review_status">复核状态</Label>
                  <select
                    id="review_status"
                    value={formData.review_status}
                    onChange={(e) => handleInputChange("review_status", e.target.value as '待复核' | '已复核' | '不符合')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="待复核">待复核</option>
                    <option value="已复核">已复核</option>
                    <option value="不符合">不符合</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review_result">复核结果</Label>
                  <Textarea
                    id="review_result"
                    placeholder="复核结果"
                    value={formData.review_result}
                    onChange={(e) => handleInputChange("review_result", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* 招聘决定 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">招聘决定</h3>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_hired"
                    checked={formData.is_hired}
                    onCheckedChange={(checked) => handleInputChange("is_hired", checked as boolean)}
                  />
                  <Label htmlFor="is_hired" className="cursor-pointer">
                    已录用
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_teach_graduation_class"
                    checked={formData.can_teach_graduation_class}
                    onCheckedChange={(checked) => handleInputChange("can_teach_graduation_class", checked as boolean)}
                  />
                  <Label htmlFor="can_teach_graduation_class" className="cursor-pointer">
                    可带毕业班
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher_level">教师级别</Label>
                  <Input
                    id="teacher_level"
                    placeholder="例如：初级、中级、高级"
                    value={formData.teacher_level}
                    onChange={(e) => handleInputChange("teacher_level", e.target.value)}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/teacher-candidates">
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
