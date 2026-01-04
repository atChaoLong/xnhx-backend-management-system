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
import { TeacherCandidatesService, NewTeacherCandidate } from "@/lib/services/teacherCandidates"
import { getDictionaryItems, DictionaryItem } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewTeacherCandidatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [gradeLevels, setGradeLevels] = useState<DictionaryItem[]>([])
  const [subjects, setSubjects] = useState<DictionaryItem[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  const [formData, setFormData] = useState({
    // 基本信息
    name: "",
    wechat_id: "",
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
    review_status: "" as '' | '已复核' | '已通过',
    reviewed_by: "",
    review_result: "",
    review_evaluation_comment: "",

    // 招聘决定
    is_hired: false,
    teacher_level: "",
    can_teach_graduation_class: false,
  })

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        const [gradeData, subjectData] = await Promise.all([
          getDictionaryItems('grade'),
          getDictionaryItems('subject')
        ])
        setGradeLevels(gradeData)
        setSubjects(subjectData)
      } catch (error: any) {
        console.error("加载字典数据失败:", error)
      }
    }

    loadDictionaries()
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 处理学科多选
  const handleSubjectToggle = (subjectCode: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subjectCode)) {
        return prev.filter((s) => s !== subjectCode)
      } else {
        return [...prev, subjectCode]
      }
    })
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
        resume_url: formData.resume_url.trim() || undefined,
        profile_photo_url: formData.profile_photo_url.trim() || undefined,
        grade_level: formData.grade_level || undefined,
        subjects_taught: selectedSubjects.length > 0 ? selectedSubjects : undefined,
        teacher_type: formData.teacher_type || undefined,
        trial_subject: formData.trial_subject || undefined,
        teaching_style: formData.teaching_style || undefined,
        interview_date: formData.interview_date || undefined,
        interviewer_name: formData.interviewer_name || undefined,
        interview_time: formData.interview_time || undefined,
        interview_link: formData.interview_link || undefined,
        interview_officer: formData.interview_officer || undefined,
        review_status: formData.review_status,
        reviewed_by: formData.reviewed_by || undefined,
        review_result: formData.review_result || undefined,
        review_evaluation_comment: formData.review_evaluation_comment || undefined,
        is_hired: formData.is_hired,
        teacher_level: formData.teacher_level || undefined,
        can_teach_graduation_class: formData.can_teach_graduation_class,
      }

      await TeacherCandidatesService.createTeacherCandidate(payload)

      toast({
        title: "创建成功",
        description: "老师面试记录已创建",
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

  if (isLoadingLeads) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="新增老师面试"
          description="填写老师面试信息（核心字段）"
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增老师面试"
        description="填写老师面试信息（核心字段）"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* 1. 候选人称呼 */}
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      候选人称呼 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="请输入姓名"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>

                  {/* 4. 微信号（必填） */}
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

                  {/* 5. 简历 */}
                  <div className="space-y-2">
                    <Label htmlFor="resume_url">简历</Label>
                    <Input
                      id="resume_url"
                      type="url"
                      placeholder="简历链接URL"
                      value={formData.resume_url}
                      onChange={(e) => handleInputChange("resume_url", e.target.value)}
                    />
                  </div>

                  {/* 6. 年级段 */}
                  <div className="space-y-2">
                    <Label htmlFor="grade_level">年级段</Label>
                    <select
                      id="grade_level"
                      value={formData.grade_level}
                      onChange={(e) => handleInputChange("grade_level", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择年级段</option>
                      {gradeLevels.map((grade) => (
                        <option key={grade.id} value={grade.code}>
                          {grade.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 7. 教授学科 */}
                  <div className="space-y-2 col-span-2">
                    <Label>教授学科</Label>
                    <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                      {subjects.map((subject) => (
                        <div key={subject.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`subject-${subject.code}`}
                            checked={selectedSubjects.includes(subject.code)}
                            onChange={() => handleSubjectToggle(subject.code)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label
                            htmlFor={`subject-${subject.code}`}
                            className="text-sm cursor-pointer"
                          >
                            {subject.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 约面信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">约面信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* 3/9. 面试时间 */}
                  <div className="space-y-2">
                    <Label htmlFor="interview_datetime">面试时间</Label>
                    <Input
                      id="interview_datetime"
                      type="datetime-local"
                      value={formData.interview_date && formData.interview_time ? `${formData.interview_date}T${formData.interview_time}` : ''}
                      onChange={(e) => {
                        const [date, time] = e.target.value.split('T')
                        handleInputChange("interview_date", date)
                        handleInputChange("interview_time", time || '')
                      }}
                    />
                  </div>

                  {/* 8. 约面人 */}
                  <div className="space-y-2">
                    <Label htmlFor="interview_officer">约面人</Label>
                    <Input
                      id="interview_officer"
                      placeholder="约面人姓名"
                      value={formData.interview_officer}
                      onChange={(e) => handleInputChange("interview_officer", e.target.value)}
                    />
                  </div>

                  {/* 10. 面试链接 */}
                  <div className="space-y-2">
                    <Label htmlFor="interview_link">面试链接</Label>
                    <Input
                      id="interview_link"
                      type="url"
                      placeholder="面试链接URL"
                      value={formData.interview_link}
                      onChange={(e) => handleInputChange("interview_link", e.target.value)}
                    />
                  </div>

                  {/* 11. 面试官 */}
                  <div className="space-y-2">
                    <Label htmlFor="interviewer_name">面试官</Label>
                    <Input
                      id="interviewer_name"
                      placeholder="面试官姓名"
                      value={formData.interviewer_name}
                      onChange={(e) => handleInputChange("interviewer_name", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 复核状态 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">复核信息（勿填）</h3>

                {/* 2. 复核信息（勿填） */}
                <div className="space-y-2">
                  <Label htmlFor="review_status">复核状态</Label>
                  <select
                    id="review_status"
                    value={formData.review_status}
                    onChange={(e) => handleInputChange("review_status", e.target.value as '' | '已复核' | '已通过')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">（空白）</option>
                    <option value="已复核">已复核</option>
                    <option value="已通过">已通过</option>
                  </select>
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
