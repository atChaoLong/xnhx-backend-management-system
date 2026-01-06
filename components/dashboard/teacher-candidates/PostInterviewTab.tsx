"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PostInterviewTabProps {
  formData: {
    video_recording_url?: string
    initial_evaluation?: string
    teacher_type?: string
    trial_subject?: string
    teaching_style?: string
    teacher_characteristics?: string
    mandarin_level?: string
    research_ability?: string
    service_awareness?: string
    affinity?: string
    exam_score?: string
    current_rate?: number | string
    interview_score?: number | string
  }
  onInputChange: (field: string, value: string | number) => void
}

const DEFAULT_TEACHER_TYPES = [
  "机构老师（k12）",
  "机构老师（非k12）",
  "学校老师",
  "研究生",
  "大学生",
  "其他",
]

const levelOptions = ["强", "较强", "一般", "较弱", "未评"]

export function PostInterviewTab({ formData, onInputChange }: PostInterviewTabProps) {
  const examScore = formData.exam_score || ""

  return (
    <div className="space-y-6">
      {/* 面试录像与初试评价 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">初试结果</h3>

        <div className="space-y-2">
          <Label htmlFor="video_recording_url">面试录像链接</Label>
          <Input
            id="video_recording_url"
            type="url"
            placeholder="面试录像URL"
            value={formData.video_recording_url || ""}
            onChange={(e) => onInputChange("video_recording_url", e.target.value)}
          />
        </div>

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
      </div>

      {/* 老师类型、试讲科目、授课风格 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">岗位与试讲</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="teacher_type">老师类型</Label>
            <select
              id="teacher_type"
              value={formData.teacher_type || ""}
              onChange={(e) => onInputChange("teacher_type", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {DEFAULT_TEACHER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trial_subject">试讲科目</Label>
            <Input
              id="trial_subject"
              placeholder="试讲指定科目"
              value={formData.trial_subject || ""}
              onChange={(e) => onInputChange("trial_subject", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="teaching_style">授课风格</Label>
          <Textarea
            id="teaching_style"
            placeholder="请描述教学风格"
            value={formData.teaching_style || ""}
            onChange={(e) => onInputChange("teaching_style", e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* 素质评价与老师特点 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">素质评价与特点</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mandarin_level">普通话水平</Label>
            <select
              id="mandarin_level"
              value={formData.mandarin_level || ""}
              onChange={(e) => onInputChange("mandarin_level", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              <option value="一级甲等">一级甲等</option>
              <option value="一级乙等">一级乙等</option>
              <option value="二级甲等">二级甲等</option>
              <option value="二级乙等">二级乙等</option>
              <option value="三级">三级</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="research_ability">教研能力</Label>
            <select
              id="research_ability"
              value={formData.research_ability || ""}
              onChange={(e) => onInputChange("research_ability", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {levelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="service_awareness">服务意识</Label>
            <select
              id="service_awareness"
              value={formData.service_awareness || ""}
              onChange={(e) => onInputChange("service_awareness", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {levelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="affinity">亲和力</Label>
            <select
              id="affinity"
              value={formData.affinity || ""}
              onChange={(e) => onInputChange("affinity", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {levelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher_characteristics">老师特点</Label>
          <Textarea
            id="teacher_characteristics"
            placeholder="描述候选人的教学特点、优势等"
            value={formData.teacher_characteristics || ""}
            onChange={(e) => onInputChange("teacher_characteristics", e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* 成绩与评价 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">成绩与面试评价</h3>
        <div className="space-y-2">
          <Label htmlFor="exam_score">中高考分数（得分/满分）</Label>
          <Input
            id="exam_score"
            placeholder="示例：100/120"
            value={examScore}
            onChange={(e) => onInputChange("exam_score", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview_score">面试评价（评分）</Label>
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
          <Label htmlFor="current_rate">目前课时费</Label>
          <div className="flex items-center gap-2">
            <Input
              id="current_rate"
              type="number"
              min="0"
              step="0.5"
              placeholder="元/小时"
              value={formData.current_rate || ""}
              onChange={(e) => onInputChange("current_rate", e.target.value ? parseFloat(e.target.value) : "")}
            />
            <span className="text-gray-500 text-sm">元/小时</span>
          </div>
        </div>
      </div>
    </div>
  )
}
