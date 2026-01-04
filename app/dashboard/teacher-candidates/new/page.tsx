"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X, Upload } from "lucide-react"
import { TeacherCandidatesService, NewTeacherCandidate } from "@/lib/services/teacherCandidates"
import { getDictionaryItems, DictionaryItem } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import { uploadFile } from "@/lib/supabase-client"

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

  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

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

    if (!resumeFile) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请上传简历",
      })
      return
    }



    setIsSubmitting(true)

    try {
       let resume_url: string | undefined = undefined
       let profile_photo_url: string | undefined = undefined

       // 上传简历
       if (resumeFile) {
         try {
           setIsUploading(true)
           resume_url = await uploadFile(resumeFile, 'teacher-resumes')
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

       // 上传形象照
       if (photoFile) {
         try {
           profile_photo_url = await uploadFile(photoFile, 'teacher-photos')
           toast({
             title: "上传成功",
             description: "形象照已上传",
           })
         } catch (error: any) {
           toast({
             variant: "destructive",
             title: "上传失败",
             description: error.message || "无法上传形象照",
           })
           setIsUploading(false)
           return
         }
       }

      const payload: NewTeacherCandidate = {
        name: formData.name.trim(),
        wechat_id: formData.wechat_id.trim() || undefined,
        resume_url: resume_url || formData.resume_url.trim() || undefined,
        profile_photo_url: profile_photo_url || formData.profile_photo_url.trim() || undefined,
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
                {/* 候选人称呼 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="name" className="text-xs min-w-20">
                    候选人称呼 <span className="text-red-500">*</span>
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

                {/* 微信号 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="wechat_id" className="text-xs min-w-20">微信号</Label>
                  <Input
                    id="wechat_id"
                    placeholder="请输入微信号"
                    value={formData.wechat_id}
                    onChange={(e) => handleInputChange("wechat_id", e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                </div>

                {/* 简历 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="resume_file" className="text-xs min-w-20">
                    简历 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      id="resume_file"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setResumeFile(e.target.files[0])
                        }
                      }}
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

                {/* 形象照 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="photo_file" className="text-xs min-w-20">形象照</Label>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      id="photo_file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setPhotoFile(e.target.files[0])
                        }
                      }}
                      className="h-9 text-sm flex-1"
                      disabled={isUploading}
                    />
                    {photoFile && (
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {photoFile.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 年级段 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="grade_level" className="text-xs min-w-20">年级段</Label>
                  <select
                    id="grade_level"
                    value={formData.grade_level}
                    onChange={(e) => handleInputChange("grade_level", e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="">请选择</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade.id} value={grade.code}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 教授学科 */}
                <div className="flex gap-4">
                  <Label className="text-xs min-w-20 pt-2">教授学科</Label>
                  <div className="border rounded-md p-2 space-y-2 max-h-28 overflow-y-auto bg-gray-50 flex-1">
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

            {/* 约面信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">约面信息</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 面试时间 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_datetime" className="text-xs min-w-20">面试时间</Label>
                  <Input
                    id="interview_datetime"
                    type="datetime-local"
                    value={formData.interview_date && formData.interview_time ? `${formData.interview_date}T${formData.interview_time}` : ''}
                    onChange={(e) => {
                      const [date, time] = e.target.value.split('T')
                      handleInputChange("interview_date", date)
                      handleInputChange("interview_time", time || '')
                    }}
                    className="h-9 text-sm flex-1"
                  />
                </div>

                {/* 约面人 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_officer" className="text-xs min-w-20">约面人</Label>
                  <Input
                    id="interview_officer"
                    placeholder="约面人姓名"
                    value={formData.interview_officer}
                    onChange={(e) => handleInputChange("interview_officer", e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                </div>

                {/* 面试链接 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_link" className="text-xs min-w-20">面试链接</Label>
                  <Input
                    id="interview_link"
                    type="url"
                    placeholder="面试链接"
                    value={formData.interview_link}
                    onChange={(e) => handleInputChange("interview_link", e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                </div>

                {/* 面试官 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interviewer_name" className="text-xs min-w-20">面试官</Label>
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
