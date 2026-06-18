"use client"

import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDictionary } from "@/lib/hooks/useDictionary"
import type { DictionaryItem } from "@/lib/services/dictionary"
 

interface ReviewTabProps {
  formData: {
    review_status: string
    review_result?: string
    review_evaluation_comment?: string
    reviewed_by?: string
    review_date?: string
    trial_video_url?: string
    teacher_level?: string
    scheduling_preference?: string
    hired_notes?: string
  }
  onInputChange: (field: string, value: string | boolean) => void
  currentUser?: {
    id: string
    name: string
  }
}

export function ReviewTab({ formData, onInputChange, currentUser }: ReviewTabProps) {
  const { items: reviewResults, loading: reviewResultsLoading } = useDictionary('review_result')
  const { items: teacherLevels, loading: teacherLevelsLoading } = useDictionary('teacher_level')

  useEffect(() => {
    if (!formData.reviewed_by && currentUser?.name) {
      onInputChange("reviewed_by", currentUser.name)
    }
  }, [currentUser?.name, formData.reviewed_by, onInputChange])

  return (
    <div className="space-y-6">

      {/* 复核状态 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">复核结果</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reviewed_by">复核人</Label>
            <Input
              id="reviewed_by"
              placeholder="请输入复核人"
              value={formData.reviewed_by || ""}
              onChange={(e) => onInputChange("reviewed_by", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review_result">复核结果</Label>
            <select
              id="review_result"
              value={formData.review_result || ""}
              onChange={(e) => onInputChange("review_result", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {reviewResults.map((result) => (
                <option key={result.code} value={result.label}>
                  {result.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="review_evaluation_comment">复核评价（定薪参考）</Label>
          <Textarea
            id="review_evaluation_comment"
            placeholder="详细的复核评价，作为定薪时的参考依据"
            value={formData.review_evaluation_comment || ""}
            onChange={(e) => onInputChange("review_evaluation_comment", e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* 复核补充：老师级别、排课偏好、入库备注 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">补充信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="teacher_level">老师级别</Label>
            <select
              id="teacher_level"
              value={formData.teacher_level || ""}
              onChange={(e) => onInputChange("teacher_level", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {teacherLevels.map((level) => (
                <option key={level.code} value={level.label}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduling_preference">排课偏好</Label>
            <Textarea
              id="scheduling_preference"
              placeholder="如：只能工作日晚上、周末可排、一周最多几节课等"
              value={formData.scheduling_preference || ""}
              onChange={(e) => onInputChange("scheduling_preference", e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hired_notes">入库备注</Label>
          <Textarea
            id="hired_notes"
            placeholder="入库前的备注说明（如特殊要求、合同信息等）"
            value={formData.hired_notes || ""}
            onChange={(e) => onInputChange("hired_notes", e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
