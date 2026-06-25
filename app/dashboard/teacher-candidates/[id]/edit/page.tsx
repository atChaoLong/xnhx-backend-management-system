"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertTriangle, Copy, ExternalLink, QrCode } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TeacherCandidatesService, TeacherCandidate } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import Link from "next/link"

// 导入Tab组件
import { BasicInfoTab } from "@/components/dashboard/teacher-candidates/BasicInfoTab"
import { PostInterviewTab } from "@/components/dashboard/teacher-candidates/PostInterviewTab"
import { ReviewTab } from "@/components/dashboard/teacher-candidates/ReviewTab"
import { SalaryHiringTab } from "@/components/dashboard/teacher-candidates/SalaryHiringTab"

export default function EditTeacherCandidatePage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { user, role, teacherCandidates } = usePermission()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [candidate, setCandidate] = useState<TeacherCandidate | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teacherFormUrl, setTeacherFormUrl] = useState("")

  const candidateId = params.id as string

  // 根据角色判断可见的Tab
  const isRecruiter = role === 'teacher_recruiter' || role === 'admin'
  const isAcademic = role === 'academic_affairs' || role === 'admin'

  // 分阶段：基本信息（招师/教务），初试后填写（招师），复核填写（教务），谈薪入库（招师）
  const canViewBasic = isRecruiter || isAcademic
  const canViewPostInterview = isRecruiter
  const canViewReview = isAcademic
  const canViewSalary = isRecruiter
  const canEditCandidate = teacherCandidates.interview() || teacherCandidates.evaluate() || teacherCandidates.uploadVideo() || teacherCandidates.reviewVideo()
  const canDeleteCandidate = teacherCandidates.delete()

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
    interview_exception: "",

    // 面试评分
    interview_score: "",
    logical_expression_score: "",
    dress_appearance_score: "",
    material_preparation_score: "",
    exam_score: "",
    initial_evaluation: "",
    video_recording_url: "",

    // 素质评价
    teacher_characteristics: "",
    mandarin_level: "",
    research_ability: "",
    service_awareness: "",
    affinity: "",
    teacher_feeling: "",
    suitable_for_students: "",
    scheduling_preference: "",

    // 复核状态
    review_status: "待复核" as '待复核' | '已复核' | '不符合',
    review_result: "",
    review_evaluation_comment: "",
    review_date: "",
    reviewed_by: "",
    trial_video_url: "",

    // 薪资信息
    current_rate: "",
    grade_level_settings: [] as Array<{
      grade: string
      workload: number
      hourlyRate: number
    }>,

    // 招聘决定
    is_hired: false,
    teacher_level: "",
    can_teach_graduation_class: false,
    hired_notes: "",
  })

  // 加载候选数据
  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        setIsLoading(true)
        const data = await TeacherCandidatesService.getTeacherCandidateById(candidateId)
        setCandidate(data)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        setTeacherFormUrl(`${baseUrl}/teacher-form?candidate_id=${data.id}`)

        // 设置表单数据
        setFormData({
          name: data.name || "",
          wechat_id: data.wechat_id || "",
          resume_url: data.resume_url || "",
          profile_photo_url: data.profile_photo_url || "",
          grade_level: data.grade_level || "",
          subjects_taught: data.subjects_taught?.join(", ") || "",
          teacher_type: data.teacher_type || "",
          trial_subject: data.trial_subject || "",
          teaching_style: data.teaching_style || "",
          interview_date: data.interview_date || "",
          interviewer_name: data.interviewer_name || "",
          interview_time: data.interview_time || "",
          interview_link: data.interview_link || "",
          interview_officer: data.interview_officer || "",
          interview_exception: data.interview_exception || "",
          interview_score: data.interview_score?.toString() || "",
          logical_expression_score: data.logical_expression_score?.toString() || "",
          dress_appearance_score: data.dress_appearance_score?.toString() || "",
          material_preparation_score: data.material_preparation_score?.toString() || "",
          exam_score: data.exam_score || "",
          initial_evaluation: data.initial_evaluation || "",
          video_recording_url: data.video_recording_url || "",
          teacher_characteristics: data.teacher_characteristics || "",
          mandarin_level: data.mandarin_level || "",
          research_ability: data.research_ability || "",
          service_awareness: data.service_awareness || "",
          affinity: data.affinity || "",
          teacher_feeling: data.teacher_feeling || "",
          suitable_for_students: data.suitable_for_students || "",
          scheduling_preference: data.scheduling_preference || "",
          review_status: data.review_status || "待复核",
          review_result: data.review_result || "",
          review_evaluation_comment: data.review_evaluation_comment || "",
          review_date: data.review_date || "",
          reviewed_by: data.reviewed_by || "",
          trial_video_url: data.trial_video_url || "",
          current_rate: data.current_rate?.toString() || "",
          grade_level_settings: (data.grade_level_settings as Array<{
            grade: string
            workload: number
            hourlyRate: number
          }>) || [],
          is_hired: data.is_hired || false,
          teacher_level: data.teacher_level || "",
          can_teach_graduation_class: data.can_teach_graduation_class || false,
          hired_notes: data.hired_notes || "",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载面试数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchCandidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId])

  const handleInputChange = (field: string, value: string | boolean | number | Array<any>) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "review_result") {
        next.review_status = value ? "已复核" : "待复核"
        if (value && !next.review_date) {
          next.review_date = new Date().toISOString().split("T")[0]
        }
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canEditCandidate) {
      toast({
        variant: "destructive",
        title: "权限不足",
        description: "你没有更新面试记录的权限",
      })
      return
    }

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
      const payload = {
        id: candidateId,
        name: formData.name.trim(),
        wechat_id: formData.wechat_id.trim(),
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
        interview_exception: formData.interview_exception || undefined,
        interview_score: formData.interview_score ? parseFloat(formData.interview_score as string) : undefined,
        logical_expression_score: formData.logical_expression_score ? parseFloat(formData.logical_expression_score as string) : undefined,
        dress_appearance_score: formData.dress_appearance_score ? parseFloat(formData.dress_appearance_score as string) : undefined,
        material_preparation_score: formData.material_preparation_score ? parseFloat(formData.material_preparation_score as string) : undefined,
        exam_score: formData.exam_score || undefined,
        initial_evaluation: formData.initial_evaluation || undefined,
        video_recording_url: formData.video_recording_url || undefined,
        teacher_characteristics: formData.teacher_characteristics || undefined,
        mandarin_level: formData.mandarin_level || undefined,
        research_ability: formData.research_ability || undefined,
        service_awareness: formData.service_awareness || undefined,
        affinity: formData.affinity || undefined,
        teacher_feeling: formData.teacher_feeling || undefined,
        suitable_for_students: formData.suitable_for_students || undefined,
        scheduling_preference: formData.scheduling_preference || undefined,
        review_status: formData.review_status,
        review_result: formData.review_result || undefined,
        review_evaluation_comment: formData.review_evaluation_comment || undefined,
        review_date: formData.review_date || undefined,
        reviewed_by: formData.reviewed_by || undefined,
        trial_video_url: formData.trial_video_url || undefined,
        current_rate: formData.current_rate ? parseFloat(formData.current_rate as string) : undefined,
        grade_level_settings: formData.grade_level_settings && formData.grade_level_settings.length > 0
          ? formData.grade_level_settings.filter(s => s.grade)
          : undefined,
        is_hired: formData.is_hired,
        teacher_level: formData.teacher_level || undefined,
        can_teach_graduation_class: formData.can_teach_graduation_class,
        hired_notes: formData.hired_notes || undefined,
      }

      await TeacherCandidatesService.updateTeacherCandidate(payload as any)

      toast({
        title: "保存成功",
        description: "面试信息已更新",
      })

      router.push("/dashboard/teacher-candidates")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新面试记录",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!canDeleteCandidate) {
      toast({
        variant: "destructive",
        title: "权限不足",
        description: "只有超级管理员可以删除面试记录",
      })
      setDeleteDialogOpen(false)
      return
    }

    try {
      await TeacherCandidatesService.deleteTeacherCandidate(candidateId)
      toast({
        title: "删除成功",
        description: "面试记录已删除",
      })
      router.push("/dashboard/teacher-candidates")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除面试记录",
      })
    }
  }

  const handleCopyTeacherFormUrl = async () => {
    if (!candidate || !teacherFormUrl) return

    try {
      await navigator.clipboard.writeText(teacherFormUrl)

      toast({
        title: "已复制",
        description: "老师信息采集链接已复制",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "复制失败",
        description: error.message || "无法复制表单链接",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑老师面试" description="修改面试信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑老师面试" description="修改面试信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">面试记录不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该面试记录</p>
            <Link href="/dashboard/teacher-candidates">
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
        title={`编辑老师面试 - ${formData.name}`}
        description="完整的教师招聘流程管理"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6">
            {isRecruiter && teacherFormUrl && (
              <div className="mb-6 flex flex-col gap-3 rounded-md border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <QrCode className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">老师信息采集链接</div>
                    <div className="truncate text-xs text-muted-foreground">{teacherFormUrl}</div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyTeacherFormUrl}>
                    <Copy className="mr-2 h-4 w-4" />
                    复制
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={teacherFormUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      打开
                    </a>
                  </Button>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tab 导航 */}
              <Tabs defaultValue="basic" className="w-full">
          <TabsList className={`grid w-full gap-1 bg-gray-100 p-1 rounded-lg`} style={{
                  gridTemplateColumns: `repeat(${
                    [canViewBasic, canViewPostInterview, canViewReview, canViewSalary].filter(Boolean).length
                  }, minmax(0, 1fr))`
                }}>
                  {canViewBasic && <TabsTrigger value="basic" className="text-xs">基本信息</TabsTrigger>}
                  {canViewPostInterview && <TabsTrigger value="postInterview" className="text-xs">初试结果</TabsTrigger>}
                  {canViewReview && <TabsTrigger value="review" className="text-xs">复核结果</TabsTrigger>}
                  {canViewSalary && <TabsTrigger value="salary" className="text-xs">谈薪入库</TabsTrigger>}
                </TabsList>

                {/* Tab 1: 基本信息 */}
                {canViewBasic && (
                  <TabsContent value="basic" className="mt-6">
                    <BasicInfoTab
                      formData={{
                        name: formData.name,
                        wechat_id: formData.wechat_id,
                        resume_url: formData.resume_url,
                        profile_photo_url: formData.profile_photo_url,
                        grade_level: formData.grade_level,
                        subjects_taught: formData.subjects_taught,
                        interview_date: formData.interview_date,
                        interview_time: formData.interview_time,
                        interview_link: formData.interview_link,
                        interviewer_name: formData.interviewer_name,
                      }}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>
                )}

                {/* Tab 2: 初试后填写 */}
                {canViewPostInterview && (
                  <TabsContent value="postInterview" className="mt-6">
                    <PostInterviewTab
                      formData={{
                        video_recording_url: formData.video_recording_url,
                        initial_evaluation: formData.initial_evaluation,
                        teacher_type: formData.teacher_type,
                        trial_subject: formData.trial_subject,
                        teaching_style: formData.teaching_style,
                        teacher_characteristics: formData.teacher_characteristics,
                        mandarin_level: formData.mandarin_level,
                        research_ability: formData.research_ability,
                        service_awareness: formData.service_awareness,
                        affinity: formData.affinity,
                        exam_score: formData.exam_score,
                        current_rate: formData.current_rate,
                        interview_score: formData.interview_score,
                      }}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>
                )}

                  {/* Tab 5: 复核流程 */}
                  {canViewReview && (
                    <TabsContent value="review" className="mt-6">
                      <ReviewTab
                        formData={{
                          review_status: formData.review_status,
                          review_result: formData.review_result,
                          review_evaluation_comment: formData.review_evaluation_comment,
                          reviewed_by: formData.reviewed_by,
                          review_date: formData.review_date,
                          trial_video_url: formData.trial_video_url,
                          teacher_level: formData.teacher_level,
                          scheduling_preference: formData.scheduling_preference,
                          hired_notes: formData.hired_notes,
                        }}
                        onInputChange={handleInputChange}
                        currentUser={{
                          id: user?.id || "",
                          name: user?.name || user?.email || "",
                        }}
                      />
                    </TabsContent>
                  )}

                  {/* Tab 6: 谈薪入库 */}
                  {canViewSalary && (
                    <TabsContent value="salary" className="mt-6">
                      <SalaryHiringTab
                        formData={{
                          grade_level_settings: formData.grade_level_settings,
                        }}
                        onInputChange={handleInputChange}
                      />
                    </TabsContent>
                  )}
              </Tabs>

              {/* 操作按钮 */}
              <div className="flex justify-between items-center pt-4 border-t gap-4">
                <div className="flex gap-4">
                  <Link href="/dashboard/teacher-candidates">
                    <Button type="button" variant="outline" disabled={isSubmitting}>
                      取消
                    </Button>
                  </Link>
                  {canEditCandidate && (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          更新中...
                        </>
                      ) : (
                        "保存"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      {canDeleteCandidate && <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个面试记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  )
}
