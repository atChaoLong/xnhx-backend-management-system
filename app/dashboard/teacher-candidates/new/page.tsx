"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X } from "lucide-react"
import { TeacherCandidatesService, NewTeacherCandidate } from "@/lib/services/teacherCandidates"
import { useDictionary } from "@/lib/hooks/useDictionary"
import type { DictionaryItem } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import {
  TEACHER_RESUME_ACCEPT,
  uploadTeacherResume,
  validateTeacherResumeFile,
} from "@/lib/services/upload"

export default function NewTeacherCandidatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedGradeGroups, setSelectedGradeGroups] = useState<string[]>([])

  const [formData, setFormData] = useState({
    // 基本信息
    name: "",
    wechat_id: "",
    resume_url: "",

    // 岗位信息
    grade_level: "",

    // 约面信息
    interview_date: "",
    interview_time: "",
    interview_link: "",
    interviewer_name: "",

    // 其他字段在创建阶段不需要
  })

  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

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

  // 年级段多选（小学/初中/高中）
  const handleGradeGroupToggle = (code: string) => {
    setSelectedGradeGroups((prev) => {
      if (prev.includes(code)) {
        return prev.filter((g) => g !== code)
      } else {
        return [...prev, code]
      }
    })
  }

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateTeacherResumeFile(file)
    if (validationError) {
      toast({
        variant: "destructive",
        title: "文件不符合要求",
        description: validationError,
      })
      e.target.value = ""
      setResumeFile(null)
      return
    }

    setResumeFile(file)
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

    if (!resumeFile) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请上传简历",
      })
      return
    }

    const resumeValidationError = validateTeacherResumeFile(resumeFile)
    if (resumeValidationError) {
      toast({
        variant: "destructive",
        title: "文件不符合要求",
        description: resumeValidationError,
      })
      return
    }



    setIsSubmitting(true)

    try {
       let resume_url: string | undefined = undefined

       // 上传简历
       if (resumeFile) {
         try {
           setIsUploading(true)
           resume_url = await uploadTeacherResume(resumeFile)
           toast({
             title: "上传成功",
             description: "简历已上传",
           })
         } catch (error: any) {
           toast({
             variant: "destructive",
             title: "上传失败",
             description: error.message || "无法上传简历",
           })
           setIsUploading(false)
           return
         }
       }

       // 仅上传简历

      const payload: NewTeacherCandidate = {
        name: formData.name.trim(),
        wechat_id: formData.wechat_id.trim() || undefined,
        resume_url: resume_url || formData.resume_url.trim() || undefined,
        grade_level: (selectedGradeGroups.length > 0 ? selectedGradeGroups.join(',') : formData.grade_level) || undefined,
        subjects_taught: selectedSubjects.length > 0 ? selectedSubjects : undefined,
        interview_date: formData.interview_date || undefined,
        interview_time: formData.interview_time || undefined,
        interview_link: formData.interview_link || undefined,
        interviewer_name: formData.interviewer_name || undefined,
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
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h1 className="text-lg font-semibold">新增老师面试</h1>
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">基本信息</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 老师名字和微信号 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs w-28">
                      老师名字 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="请输入姓名"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="h-9 text-sm flex-1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wechat_id" className="text-xs w-28">微信号</Label>
                    <Input
                      id="wechat_id"
                      placeholder="请输入微信号"
                      value={formData.wechat_id}
                      onChange={(e) => handleInputChange("wechat_id", e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                  </div>
                </div>
                {/* 老师简历 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="resume_file" className="text-xs w-28">
                    老师简历 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      id="resume_file"
                      type="file"
                      accept={TEACHER_RESUME_ACCEPT}
                      onChange={handleResumeFileChange}
                      className="h-9 text-sm flex-1"
                      disabled={isUploading}
                      required
                    />
                    {resumeFile && (
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {resumeFile.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 年级段和教授学科 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 年级段 */}
                  <div className="space-y-2">
                    <Label className="text-xs w-28">年级段</Label>
                    <div className="border rounded-md p-2 space-y-2 max-h-28 overflow-y-auto bg-gray-50">
                      {[
                        { code: 'primary', label: '小学' },
                        { code: 'middle', label: '初中' },
                        { code: 'high', label: '高中' },
                      ].map((g) => (
                        <label key={g.code} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedGradeGroups.includes(g.code)}
                            onChange={() => handleGradeGroupToggle(g.code)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          {g.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 教授学科 */}
                  <div className="space-y-2">
                    <Label className="text-xs w-28">教授学科</Label>
                    <div className="border rounded-md p-2 space-y-2 max-h-28 overflow-y-auto bg-gray-50">
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
                            className="text-xs cursor-pointer"
                          >
                            {subject.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 约面信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">约面信息</h3>
              <div className="pb-4 space-y-3">
                {/* 约面日期和面试时间 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interview_date" className="text-xs w-28">约面日期</Label>
                    <Input
                      id="interview_date"
                      type="date"
                      value={formData.interview_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleInputChange("interview_date", e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interview_datetime" className="text-xs w-28">面试时间</Label>
                    <Input
                      id="interview_datetime"
                      type="datetime-local"
                      value={`${formData.interview_date}T${formData.interview_time || ''}`}
                      onChange={(e) => {
                        const [date, time] = e.target.value.split('T')
                        handleInputChange("interview_date", date)
                        handleInputChange("interview_time", time || '')
                      }}
                      className="h-9 text-sm flex-1"
                    />
                  </div>
                </div>

                {/* 面试链接和面试官 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interview_link" className="text-xs w-28">面试链接</Label>
                    <Input
                      id="interview_link"
                      type="url"
                      placeholder="面试链接"
                      value={formData.interview_link}
                      onChange={(e) => handleInputChange("interview_link", e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interviewer_name" className="text-xs w-28">面试官</Label>
                    <Input
                      id="interviewer_name"
                      placeholder="面试官姓名"
                      value={formData.interviewer_name}
                      onChange={(e) => handleInputChange("interviewer_name", e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting || isUploading}
            className="h-9"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="h-9 bg-blue-500 hover:bg-blue-600"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
