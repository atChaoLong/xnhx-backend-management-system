/**
 * 第三步：教学复核表单（鉴黄师 = 教学主管）
 * 教学主管评估面试质量、专业素养、亲和力等
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X, Play } from "lucide-react"
import { TeacherCandidate, TeacherCandidatesService } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"
import { advanceToNextStep, rejectCandidate } from "@/lib/services/recruitmentFlow"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

interface TeachingReviewFormProps {
  candidate: TeacherCandidate
  onClose: () => void
  onSuccess: () => void
  isReadonly?: boolean
}

export default function TeachingReviewForm({
  candidate,
  onClose,
  onSuccess,
  isReadonly = false,
}: TeachingReviewFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    // 面试评分（1-10）
    interview_score: candidate.interview_score?.toString() || "",
    // 面试评级（优秀、良好、一般、差）
    interview_rating: candidate.interview_rating || "",
    // 仪容仪表评分（1-10）
    dress_appearance_score: candidate.dress_appearance_score?.toString() || "",
    // 逻辑表达能力评分（1-10）
    logical_expression_score: candidate.logical_expression_score?.toString() || "",
    // 教学准备充分度评分（1-10）
    material_preparation_score: candidate.material_preparation_score?.toString() || "",
    // 亲和度（1-10）
    affinity: candidate.affinity?.toString() || "",
    // 服务意识（1-10）
    service_awareness: candidate.service_awareness?.toString() || "",
    // 教师特点（文本）
    teacher_characteristics: candidate.teacher_characteristics || "",
    // 普通话水平（优秀、良好、一般、不达标）
    mandarin_level: candidate.mandarin_level || "",
    // 科研能力（1-10）
    research_ability: candidate.research_ability?.toString() || "",
    // 初步评价
    initial_evaluation: candidate.initial_evaluation || "",
    // 复核状态（已通过、已复核、拒绝）
    review_status: candidate.review_status || "",
    // 复核备注
    review_notes: candidate.review_notes || "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleValidateScore = (value: string): boolean => {
    const num = parseInt(value)
    return !isNaN(num) && num >= 1 && num <= 10
  }

  const optionalNumber = (value: string) => {
    return value ? Number(value) : undefined
  }

  const handleSubmit = async (e: React.FormEvent, decision: 'approve' | 'reject') => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.interview_score) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入面试总体评分",
      })
      return
    }

    if (!handleValidateScore(formData.interview_score)) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "面试评分必须是 1-10 之间的数字",
      })
      return
    }

    if (!formData.review_status) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择复核状态",
      })
      return
    }

    if (decision === 'reject' && !formData.review_notes) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "拒绝时必须填写拒绝原因",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await TeacherCandidatesService.updateTeacherCandidate({
        id: candidate.id,
        interview_score: Number(formData.interview_score),
        interview_rating: formData.interview_rating || undefined,
        dress_appearance_score: optionalNumber(formData.dress_appearance_score),
        logical_expression_score: optionalNumber(formData.logical_expression_score),
        material_preparation_score: optionalNumber(formData.material_preparation_score),
        affinity: formData.affinity || undefined,
        service_awareness: formData.service_awareness || undefined,
        research_ability: formData.research_ability || undefined,
        teacher_characteristics: formData.teacher_characteristics.trim() || undefined,
        mandarin_level: formData.mandarin_level || undefined,
        initial_evaluation: formData.initial_evaluation.trim() || undefined,
        review_status: decision === "approve" ? "已复核" : "不符合",
        review_notes: formData.review_notes.trim() || undefined,
      } as TeacherCandidate)

      const result = decision === "approve"
        ? await advanceToNextStep(candidate.id, "teaching_review", true)
        : await rejectCandidate(candidate.id, "teaching_review", formData.review_notes.trim())

      if (!result.success) {
        throw new Error(result.error || "招聘流程推进失败")
      }

      toast({
        title: decision === 'approve' ? "已通过复核" : "已拒绝",
        description: decision === 'approve' 
          ? "已进入下一步：谈薪入库"
          : "此记录已归档",
      })

      onSuccess()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: getClientSafeErrorMessage(error, "无法保存复核信息，请稍后重试"),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h1 className="text-lg font-semibold">教学复核 - {candidate.name}</h1>
            <p className="text-sm text-gray-500 mt-1">评估面试质量、专业素养和适合度</p>
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
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {/* 视频预览 */}
            {candidate.video_recording_url && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-500">面试视频</h3>
                <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-4">
                  <Play className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">点击下方链接观看面试视频</p>
                    <a
                      href={candidate.video_recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate"
                    >
                      {candidate.video_recording_url}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* 面试评分 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">面试评分</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 总体评分 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_score" className="text-xs min-w-32">
                    面试总体评分 <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="interview_score"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="1-10"
                    value={formData.interview_score}
                    onChange={(e) => handleInputChange("interview_score", e.target.value)}
                    className="h-9 w-20 px-2 text-sm border rounded text-center"
                    disabled={isReadonly || isSubmitting}
                  />
                  <span className="text-xs text-gray-500">分</span>
                </div>

                {/* 评级 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="interview_rating" className="text-xs min-w-32">
                    面试评级
                  </Label>
                  <select
                    id="interview_rating"
                    value={formData.interview_rating}
                    onChange={(e) => handleInputChange("interview_rating", e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    disabled={isReadonly || isSubmitting}
                  >
                    <option value="">请选择</option>
                    <option value="优秀">优秀</option>
                    <option value="良好">良好</option>
                    <option value="一般">一般</option>
                    <option value="差">差</option>
                  </select>
                </div>

                {/* 细项评分 - 3列 */}
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dress_score" className="text-xs min-w-max">
                      仪容仪表
                    </Label>
                    <input
                      id="dress_score"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={formData.dress_appearance_score}
                      onChange={(e) => handleInputChange("dress_appearance_score", e.target.value)}
                      className="h-8 w-14 px-1 text-xs border rounded text-center"
                      disabled={isReadonly || isSubmitting}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="logic_score" className="text-xs min-w-max">
                      逻辑表达
                    </Label>
                    <input
                      id="logic_score"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={formData.logical_expression_score}
                      onChange={(e) => handleInputChange("logical_expression_score", e.target.value)}
                      className="h-8 w-14 px-1 text-xs border rounded text-center"
                      disabled={isReadonly || isSubmitting}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="material_score" className="text-xs min-w-max">
                      教学准备
                    </Label>
                    <input
                      id="material_score"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={formData.material_preparation_score}
                      onChange={(e) => handleInputChange("material_preparation_score", e.target.value)}
                      className="h-8 w-14 px-1 text-xs border rounded text-center"
                      disabled={isReadonly || isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 素质评价 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">素质评价</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 亲和度、服务意识、科研能力 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="affinity" className="text-xs min-w-max">
                      亲和度
                    </Label>
                    <input
                      id="affinity"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={formData.affinity}
                      onChange={(e) => handleInputChange("affinity", e.target.value)}
                      className="h-8 w-14 px-1 text-xs border rounded text-center"
                      disabled={isReadonly || isSubmitting}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="service" className="text-xs min-w-max">
                      服务意识
                    </Label>
                    <input
                      id="service"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={formData.service_awareness}
                      onChange={(e) => handleInputChange("service_awareness", e.target.value)}
                      className="h-8 w-14 px-1 text-xs border rounded text-center"
                      disabled={isReadonly || isSubmitting}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="research" className="text-xs min-w-max">
                      科研能力
                    </Label>
                    <input
                      id="research"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      value={formData.research_ability}
                      onChange={(e) => handleInputChange("research_ability", e.target.value)}
                      className="h-8 w-14 px-1 text-xs border rounded text-center"
                      disabled={isReadonly || isSubmitting}
                    />
                  </div>
                </div>

                {/* 普通话水平 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="mandarin" className="text-xs min-w-32">
                    普通话水平
                  </Label>
                  <select
                    id="mandarin"
                    value={formData.mandarin_level}
                    onChange={(e) => handleInputChange("mandarin_level", e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    disabled={isReadonly || isSubmitting}
                  >
                    <option value="">请选择</option>
                    <option value="优秀">优秀</option>
                    <option value="良好">良好</option>
                    <option value="一般">一般</option>
                    <option value="不达标">不达标</option>
                  </select>
                </div>

                {/* 教师特点 */}
                <div className="flex gap-4">
                  <Label htmlFor="characteristics" className="text-xs min-w-32 pt-2">
                    教师特点
                  </Label>
                  <Textarea
                    id="characteristics"
                    placeholder="描述教师的主要特点和优势"
                    value={formData.teacher_characteristics}
                    onChange={(e) => handleInputChange("teacher_characteristics", e.target.value)}
                    className="min-h-16 text-sm resize-none flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 复核决定 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-purple-500">复核决定</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 复核状态 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="review_status" className="text-xs min-w-32">
                    复核状态 <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="review_status"
                    value={formData.review_status}
                    onChange={(e) => handleInputChange("review_status", e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    disabled={isReadonly || isSubmitting}
                  >
                    <option value="">请选择</option>
                    <option value="已通过">已通过（进入谈薪）</option>
                    <option value="已复核">已复核（待处理）</option>
                    <option value="拒绝">拒绝（归档）</option>
                  </select>
                </div>

                {/* 复核备注 */}
                <div className="flex gap-4">
                  <Label htmlFor="review_notes" className="text-xs min-w-32 pt-2">
                    复核备注
                  </Label>
                  <Textarea
                    id="review_notes"
                    placeholder={formData.review_status === '拒绝' ? '请说明拒绝原因' : '补充评价或建议'}
                    value={formData.review_notes}
                    onChange={(e) => handleInputChange("review_notes", e.target.value)}
                    className="min-h-20 text-sm resize-none flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>

                {/* 初步评价 */}
                <div className="flex gap-4">
                  <Label htmlFor="initial_eval" className="text-xs min-w-32 pt-2">
                    初步评价
                  </Label>
                  <Textarea
                    id="initial_eval"
                    placeholder="整体评价、是否适合本机构、建议等"
                    value={formData.initial_evaluation}
                    onChange={(e) => handleInputChange("initial_evaluation", e.target.value)}
                    className="min-h-20 text-sm resize-none flex-1"
                    disabled={isReadonly || isSubmitting}
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
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9"
          >
            取消
          </Button>
          {!isReadonly && (
            <>
              <Button
                onClick={(e) => handleSubmit(e, 'reject')}
                disabled={isSubmitting}
                variant="destructive"
                className="h-9"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    拒绝中...
                  </>
                ) : (
                  "拒绝"
                )}
              </Button>
              <Button
                onClick={(e) => handleSubmit(e, 'approve')}
                disabled={isSubmitting}
                className="h-9 bg-green-500 hover:bg-green-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    通过中...
                  </>
                ) : (
                  "通过并继续"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
