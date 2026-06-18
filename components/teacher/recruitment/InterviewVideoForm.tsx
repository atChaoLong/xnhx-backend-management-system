/**
 * 第二步：上传面试视频表单
 * 销售/运营上传面试过程录像
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X, Upload } from "lucide-react"
import { TeacherCandidate, TeacherCandidatesService } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"
import { advanceToNextStep } from "@/lib/services/recruitmentFlow"
import {
  INTERVIEW_VIDEO_ACCEPT,
  uploadTeacherInterviewVideo,
  validateInterviewVideoFile,
} from "@/lib/services/upload"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

interface InterviewVideoFormProps {
  candidate: TeacherCandidate
  onClose: () => void
  onSuccess: () => void
  isReadonly?: boolean
}

export default function InterviewVideoForm({
  candidate,
  onClose,
  onSuccess,
  isReadonly = false,
}: InterviewVideoFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [videoUrl, setVideoUrl] = useState(candidate.video_recording_url || "")
  const [videoFile, setVideoFile] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    interview_exception: candidate.interview_exception || "",
    interview_notes: candidate.interview_notes || "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateInterviewVideoFile(file)
    if (validationError) {
      toast({
        variant: "destructive",
        title: "文件不符合要求",
        description: validationError,
      })
      e.target.value = ""
      setVideoFile(null)
      return
    }

    setVideoFile(file)
    setVideoUrl("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!videoUrl && !videoFile) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请上传面试视频或提供视频链接",
      })
      return
    }

    if (videoFile) {
      const validationError = validateInterviewVideoFile(videoFile)
      if (validationError) {
        toast({
          variant: "destructive",
          title: "文件不符合要求",
          description: validationError,
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      let finalVideoUrl = videoUrl

      // 如果有新上传的文件，上传到存储
      if (videoFile) {
        try {
          setIsUploading(true)
          finalVideoUrl = await uploadTeacherInterviewVideo(videoFile)
          toast({
            title: "上传成功",
            description: "面试视频已上传",
          })
        } catch (error: unknown) {
          toast({
            variant: "destructive",
            title: "上传失败",
            description: getClientSafeErrorMessage(error, "无法上传面试视频，请稍后重试", [
              "上传超时，请检查网络后重试",
            ]),
          })
          setIsSubmitting(false)
          return
        }
      }

      await TeacherCandidatesService.updateTeacherCandidate({
        id: candidate.id,
        video_recording_url: finalVideoUrl,
        interview_exception: formData.interview_exception.trim() || undefined,
        interview_notes: formData.interview_notes.trim() || undefined,
      } as TeacherCandidate)

      if (!candidate.recruitment_step || candidate.recruitment_step === "scheduling") {
        const scheduleResult = await advanceToNextStep(candidate.id, "scheduling")
        if (!scheduleResult.success) {
          throw new Error(scheduleResult.error || "招聘流程推进失败")
        }
      }

      const result = await advanceToNextStep(candidate.id, "interview_video")
      if (!result.success) {
        throw new Error(result.error || "招聘流程推进失败")
      }

      toast({
        title: "面试视频已保存",
        description: "已进入下一步：教学复核",
      })

      onSuccess()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: getClientSafeErrorMessage(error, "无法保存面试视频信息，请稍后重试"),
      })
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h1 className="text-lg font-semibold">上传面试视频 - {candidate.name}</h1>
            <p className="text-sm text-gray-500 mt-1">上传完整的面试过程录像供教学复核</p>
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
            {/* 面试信息总结 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">面试信息</h3>
              <div className="border-b pb-4 bg-gray-50 p-4 rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">面试时间</p>
                    <p className="font-medium">
                      {candidate.interview_date && candidate.interview_time
                        ? `${candidate.interview_date} ${candidate.interview_time}`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">约面人</p>
                    <p className="font-medium">{candidate.interview_officer || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">面试链接</p>
                    <p className="font-medium truncate">{candidate.interview_link || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 视频上传 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">视频</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 视频文件上传 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="video_file" className="text-xs min-w-20">
                    视频文件 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      id="video_file"
                      type="file"
                      accept={INTERVIEW_VIDEO_ACCEPT}
                      onChange={handleVideoFileChange}
                      className="h-9 text-sm flex-1"
                      disabled={isUploading || isSubmitting}
                    />
                    {videoFile && (
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {videoFile.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 或者提供视频链接 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="video_url" className="text-xs min-w-20">
                    或视频链接
                  </Label>
                  <Input
                    id="video_url"
                    type="url"
                    placeholder="提供已上传的视频链接（如云盘、网盘）"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value)
                      if (e.target.value) setVideoFile(null)
                    }}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting || !!videoFile}
                  />
                </div>
              </div>
            </div>

            {/* 面试异常 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">备注</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 面试异常情况 */}
                <div className="flex gap-4">
                  <Label htmlFor="interview_exception" className="text-xs min-w-20 pt-2">
                    异常情况
                  </Label>
                  <Textarea
                    id="interview_exception"
                    placeholder="记录任何面试中的异常或特殊情况"
                    value={formData.interview_exception}
                    onChange={(e) => handleInputChange("interview_exception", e.target.value)}
                    className="min-h-20 text-sm resize-none flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>

                {/* 备注 */}
                <div className="flex gap-4">
                  <Label htmlFor="interview_notes" className="text-xs min-w-20 pt-2">
                    备注
                  </Label>
                  <Textarea
                    id="interview_notes"
                    placeholder="其他备注信息"
                    value={formData.interview_notes}
                    onChange={(e) => handleInputChange("interview_notes", e.target.value)}
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
            disabled={isSubmitting || isUploading}
            className="h-9"
          >
            取消
          </Button>
          {!isReadonly && (
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
                "保存并继续"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
