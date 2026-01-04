"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface InterviewScoreTabProps {
  formData: {
    interview_score?: number | string
    logical_expression_score?: number | string
    dress_appearance_score?: number | string
    material_preparation_score?: number | string
    exam_score?: string
    initial_evaluation?: string
    video_recording_url?: string
  }
  onInputChange: (field: string, value: string | number) => void
}

export function InterviewScoreTab({ formData, onInputChange }: InterviewScoreTabProps) {
  const parseExamScore = (score?: string) => {
    if (!score) return { earned: "", total: "" }
    const [earned, total] = score.split("/")
    return { earned: earned || "", total: total || "" }
  }

  const exam = parseExamScore(formData.exam_score)

  return (
    <div className="space-y-6">
      {/* 面试评分 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">面试评分</h3>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            所有评分项为可选，评分范围通常为 0-10 分，支持小数点
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="interview_score">总体面试评分</Label>
            <Input
              id="interview_score"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="0-10 分"
              value={formData.interview_score || ""}
              onChange={(e) => onInputChange("interview_score", e.target.value ? parseFloat(e.target.value) : "")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logical_expression_score">逻辑表达能力</Label>
            <Input
              id="logical_expression_score"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="0-10 分"
              value={formData.logical_expression_score || ""}
              onChange={(e) => onInputChange("logical_expression_score", e.target.value ? parseFloat(e.target.value) : "")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dress_appearance_score">礼仪着装/精神面貌</Label>
            <Input
              id="dress_appearance_score"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="0-10 分"
              value={formData.dress_appearance_score || ""}
              onChange={(e) => onInputChange("dress_appearance_score", e.target.value ? parseFloat(e.target.value) : "")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="material_preparation_score">课件准备充分度</Label>
            <Input
              id="material_preparation_score"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="0-10 分"
              value={formData.material_preparation_score || ""}
              onChange={(e) => onInputChange("material_preparation_score", e.target.value ? parseFloat(e.target.value) : "")}
            />
          </div>
        </div>

        {/* 中高考分数 */}
        <div className="space-y-2">
          <Label>中高考分数</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="得分"
              value={exam.earned}
              onChange={(e) => {
                const newScore = exam.total ? `${e.target.value}/${exam.total}` : e.target.value
                onInputChange("exam_score", newScore)
              }}
              className="flex-1"
            />
            <span className="text-gray-400">/</span>
            <Input
              type="number"
              placeholder="满分"
              value={exam.total}
              onChange={(e) => {
                const newScore = exam.earned ? `${exam.earned}/${e.target.value}` : e.target.value
                onInputChange("exam_score", newScore)
              }}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-gray-500">例如：150/150 (高考)/100(中考)</p>
        </div>
      </div>

      {/* 面试过程 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">面试过程</h3>

        <div className="space-y-2">
          <Label htmlFor="initial_evaluation">初试评价</Label>
          <Textarea
            id="initial_evaluation"
            placeholder="第一印象和初步评价"
            value={formData.initial_evaluation || ""}
            onChange={(e) => onInputChange("initial_evaluation", e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="video_recording_url">面试录像链接</Label>
          <Input
            id="video_recording_url"
            type="url"
            placeholder="面试录像URL"
            value={formData.video_recording_url || ""}
            onChange={(e) => onInputChange("video_recording_url", e.target.value)}
          />
          {formData.video_recording_url && (
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
              <a href={formData.video_recording_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                查看面试录像
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
