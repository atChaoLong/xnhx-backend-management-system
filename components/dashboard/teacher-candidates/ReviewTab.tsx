"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { format } from "date-fns"

interface ReviewTabProps {
  formData: {
    review_status: string
    review_result?: string
    review_evaluation_comment?: string
    reviewed_by?: string
    review_date?: string
    trial_video_url?: string
  }
  onInputChange: (field: string, value: string | boolean) => void
  currentUser?: {
    id: string
    name: string
  }
}

export function ReviewTab({ formData, onInputChange, currentUser }: ReviewTabProps) {
  const reviewDate = formData.review_date
    ? format(new Date(formData.review_date), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd")

  return (
    <div className="space-y-6">
      {/* 复核信息提示 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="text-xs space-y-1">
            <p>复核人：{currentUser?.name || "系统用户"}</p>
            <p>复核日期：{reviewDate}</p>
          </div>
        </AlertDescription>
      </Alert>

      {/* 复核状态 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">复核流程</h3>

        <div className="space-y-2">
          <Label htmlFor="review_status">复核状态</Label>
          <select
            id="review_status"
            value={formData.review_status}
            onChange={(e) => {
              onInputChange("review_status", e.target.value)
              // 自动填充复核日期和复核人
              onInputChange("review_date", new Date().toISOString().split("T")[0])
              if (currentUser?.id) {
                onInputChange("reviewed_by", currentUser.id)
              }
            }}
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
            placeholder="复核意见和建议"
            value={formData.review_result || ""}
            onChange={(e) => onInputChange("review_result", e.target.value)}
            rows={3}
          />
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

      {/* 试讲视频 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">补充资料</h3>

        <div className="space-y-2">
          <Label htmlFor="trial_video_url">试讲视频链接（可选）</Label>
          <Input
            id="trial_video_url"
            type="url"
            placeholder="试讲视频URL"
            value={formData.trial_video_url || ""}
            onChange={(e) => onInputChange("trial_video_url", e.target.value)}
          />
          {formData.trial_video_url && (
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
              <a
                href={formData.trial_video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                查看试讲视频
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
