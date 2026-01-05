"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertTriangle } from "lucide-react"
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
import { InterviewInfoTab } from "@/components/dashboard/teacher-candidates/InterviewInfoTab"
import { InterviewScoreTab } from "@/components/dashboard/teacher-candidates/InterviewScoreTab"
import { QualityEvaluationTab } from "@/components/dashboard/teacher-candidates/QualityEvaluationTab"
import { ReviewTab } from "@/components/dashboard/teacher-candidates/ReviewTab"
import { SalaryHiringTab } from "@/components/dashboard/teacher-candidates/SalaryHiringTab"

export default function EditTeacherCandidatePage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { role, teacherCandidates } = usePermission()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [candidate, setCandidate] = useState<TeacherCandidate | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const candidateId = params.id as string

  // 根据角色判断可见的Tab
  const isHR = role === 'hr' || role === 'admin'
  const isAcademic = role === 'academic_affairs' || role === 'admin'

  // HR可以看到：基本信息、约面、评分、素质评价、录像上传
  // 教学可以看到：基本信息、复核流程、谈薪入库
  const canViewBasic = true // 都可以看
  const canViewInterview = isHR // 只有HR
  const canViewScore = isHR // 只有HR
  const canViewQuality = isHR // 只有HR
  const canViewReview = isAcademic // 只有教学
  const canViewSalary = isAcademic // 只有教学

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
    approved_hourly_rate: "",

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
          approved_hourly_rate: data.approved_hourly_rate?.toString() || "",
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

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
        approved_hourly_rate: formData.approved_hourly_rate ? parseFloat(formData.approved_hourly_rate as string) : undefined,
        is_hired: formData.is_hired,
        teacher_level: formData.teacher_level || undefined,
        can_teach_graduation_class: formData.can_teach_graduation_class,
        hired_notes: formData.hired_notes || undefined,
      }

      await TeacherCandidatesService.updateTeacherCandidate(payload)

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
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tab 导航 */}
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className={`grid w-full gap-1 bg-gray-100 p-1 rounded-lg`} style={{
                  gridTemplateColumns: `repeat(${
                    [canViewBasic, canViewInterview, canViewScore, canViewQuality, canViewReview, canViewSalary].filter(Boolean).length
                  }, minmax(0, 1fr))`
                }}>
                  {canViewBasic && <TabsTrigger value="basic" className="text-xs">基本信息</TabsTrigger>}
                  {canViewInterview && <TabsTrigger value="interview" className="text-xs">约面信息</TabsTrigger>}
                  {canViewScore && <TabsTrigger value="score" className="text-xs">面试评分</TabsTrigger>}
                  {canViewQuality && <TabsTrigger value="quality" className="text-xs">素质评价</TabsTrigger>}
                  {canViewReview && <TabsTrigger value="review" className="text-xs">复核流程</TabsTrigger>}
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
                        teacher_type: formData.teacher_type,
                        trial_subject: formData.trial_subject,
                        teaching_style: formData.teaching_style,
                      }}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>
                )}

                {/* Tab 2: 约面信息 */}
                {canViewInterview && (
                  <TabsContent value="interview" className="mt-6">
                    <InterviewInfoTab
                      formData={{
                        interview_date: formData.interview_date,
                        interview_time: formData.interview_time,
                        interview_officer: formData.interview_officer,
                        interviewer_name: formData.interviewer_name,
                        interview_link: formData.interview_link,
                        interview_exception: formData.interview_exception,
                      }}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>
                )}

                {/* Tab 3: 面试评分 */}
                {canViewScore && (
                  <TabsContent value="score" className="mt-6">
                    <InterviewScoreTab
                      formData={{
                        interview_score: formData.interview_score,
                        logical_expression_score: formData.logical_expression_score,
                        dress_appearance_score: formData.dress_appearance_score,
                        material_preparation_score: formData.material_preparation_score,
                        exam_score: formData.exam_score,
                        initial_evaluation: formData.initial_evaluation,
                        video_recording_url: formData.video_recording_url,
                      }}
                      onInputChange={handleInputChange}
                    />
                  </TabsContent>
                )}

                {/* Tab 4: 素质评价 */}
                {canViewQuality && (
                  <TabsContent value="quality" className="mt-6">
                    <QualityEvaluationTab
                      formData={{
                        mandarin_level: formData.mandarin_level,
                        research_ability: formData.research_ability,
                        service_awareness: formData.service_awareness,
                        affinity: formData.affinity,
                        teacher_characteristics: formData.teacher_characteristics,
                        teacher_feeling: formData.teacher_feeling,
                        suitable_for_students: formData.suitable_for_students,
                        scheduling_preference: formData.scheduling_preference,
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
                        }}
                        onInputChange={handleInputChange}
                        currentUser={{
                          id: "current-user-id", // TODO: 从登录信息获取
                          name: "系统用户", // TODO: 从登录信息获取
                        }}
                      />
                    </TabsContent>
                  )}

                  {/* Tab 6: 谈薪入库 */}
                  {canViewSalary && (
                    <TabsContent value="salary" className="mt-6">
                      <SalaryHiringTab
                        formData={{
                          current_rate: formData.current_rate,
                          approved_hourly_rate: formData.approved_hourly_rate,
                          teacher_level: formData.teacher_level,
                          can_teach_graduation_class: formData.can_teach_graduation_class,
                          hired_notes: formData.hired_notes,
                          is_hired: formData.is_hired,
                          review_status: formData.review_status,
                        }}
                        onInputChange={handleInputChange}
                      />
                    </TabsContent>
                  )}
              </Tabs>

              {/* 操作按钮 */}
              <div className="flex justify-between items-center pt-4 border-t gap-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  删除
                </Button>
                <div className="flex gap-4">
                  <Link href="/dashboard/teacher-candidates">
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
                      "保存"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
      </Dialog>
    </div>
  )
}
