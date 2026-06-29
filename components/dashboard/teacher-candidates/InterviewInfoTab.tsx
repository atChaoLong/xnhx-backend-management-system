"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TimePicker } from "@/components/ui/time-picker"

interface InterviewInfoTabProps {
  formData: {
    interview_date: string
    interview_time: string
    interview_officer: string
    interviewer_name: string
    interview_link: string
    interview_exception: string
  }
  onInputChange: (field: string, value: string) => void
}

export function InterviewInfoTab({ formData, onInputChange }: InterviewInfoTabProps) {
  return (
    <div className="space-y-6">
      {/* 约面信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">约面信息</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="interview_date">约面日期</Label>
            <Input
              id="interview_date"
              type="date"
              value={formData.interview_date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => onInputChange("interview_date", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview_time">约面时间</Label>
            <TimePicker
              value={formData.interview_time}
              onChange={(value) => onInputChange("interview_time", value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="interview_officer">约面人</Label>
            <Input
              id="interview_officer"
              placeholder="约面负责人"
              value={formData.interview_officer}
              onChange={(e) => onInputChange("interview_officer", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer_name">面试官</Label>
            <Input
              id="interviewer_name"
              placeholder="面试官名字"
              value={formData.interviewer_name}
              onChange={(e) => onInputChange("interviewer_name", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="interview_link">面试链接</Label>
          <Input
            id="interview_link"
            type="url"
            placeholder="在线面试链接"
            value={formData.interview_link}
            onChange={(e) => onInputChange("interview_link", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interview_exception">面试异常</Label>
          <Textarea
            id="interview_exception"
            placeholder="如有异常情况请记录（迟到、中途退出、音视频问题等）"
            value={formData.interview_exception}
            onChange={(e) => onInputChange("interview_exception", e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
