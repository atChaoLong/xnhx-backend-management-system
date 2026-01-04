"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface QualityEvaluationTabProps {
  formData: {
    mandarin_level?: string
    research_ability?: string
    service_awareness?: string
    affinity?: string
    teacher_characteristics?: string
    teacher_feeling?: string
    suitable_for_students?: string
    scheduling_preference?: string
  }
  onInputChange: (field: string, value: string) => void
}

const levelOptions = ["强", "较强", "一般", "较弱", "未评"]

export function QualityEvaluationTab({ formData, onInputChange }: QualityEvaluationTabProps) {
  return (
    <div className="space-y-6">
      {/* 素质评价 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">素质评价</h3>

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
      </div>

      {/* 特点描述 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">特点描述</h3>

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

        <div className="space-y-2">
          <Label htmlFor="teacher_feeling">老师感觉</Label>
          <Textarea
            id="teacher_feeling"
            placeholder="如：松弛自信、不浮躁、落落大方、亲切友好等气质描述"
            value={formData.teacher_feeling || ""}
            onChange={(e) => onInputChange("teacher_feeling", e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="suitable_for_students">适合学生</Label>
          <Textarea
            id="suitable_for_students"
            placeholder="描述适合的学生类型（如：基础薄弱、成绩优秀、需要激励等）"
            value={formData.suitable_for_students || ""}
            onChange={(e) => onInputChange("suitable_for_students", e.target.value)}
            rows={2}
          />
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
    </div>
  )
}
