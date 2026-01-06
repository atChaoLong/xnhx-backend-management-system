"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface BasicInfoTabProps {
  formData: {
    name: string
    wechat_id: string
    resume_url?: string
    profile_photo_url?: string
    grade_level: string
    subjects_taught: string
    interview_date: string
    interview_time: string
    interview_link: string
    interviewer_name: string
  }
  onInputChange: (field: string, value: string | boolean) => void
  onFileUpload?: (field: string, url: string) => void
}

export function BasicInfoTab({ formData, onInputChange, onFileUpload }: BasicInfoTabProps) {
  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">基本信息</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              候选人称呼 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="请输入姓名"
              value={formData.name}
              onChange={(e) => onInputChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wechat_id">
              微信号 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wechat_id"
              placeholder="请输入微信号"
              value={formData.wechat_id}
              onChange={(e) => onInputChange("wechat_id", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>简历</Label>
          {formData.resume_url && (
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
              <a href={formData.resume_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                查看简历
              </a>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>形象照</Label>
          {formData.profile_photo_url && (
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
              <a href={formData.profile_photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                查看形象照
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 约面信息（与创建保持一致） */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">约面信息</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* 年级段（可多选）- 左列 */}
          <div className="space-y-2">
            <Label>年级段（可多选）</Label>
            <div className="border rounded-md p-3 space-y-2 bg-gray-50">
              {["小学", "初中", "高中"].map((grade) => {
                const gradeLevels = formData.grade_level 
                  ? formData.grade_level.split(",").map(g => g.trim())
                  : []
                const isChecked = gradeLevels.includes(grade)
                
                return (
                  <div key={grade} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`grade-${grade}`}
                      checked={isChecked}
                      onChange={(e) => {
                        let newGrades = gradeLevels
                        if (e.target.checked) {
                          newGrades = [...gradeLevels, grade]
                        } else {
                          newGrades = gradeLevels.filter(g => g !== grade)
                        }
                        onInputChange("grade_level", newGrades.join(", "))
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor={`grade-${grade}`} className="text-sm cursor-pointer">
                      {grade}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 教授学科（可多选）- 右列 */}
          <div className="space-y-2">
            <Label>教授学科（可多选）</Label>
            <div className="border rounded-md p-3 space-y-2 bg-gray-50 max-h-40 overflow-y-auto">
              {["语文", "数学", "英语", "物理", "化学", "生物", "地理", "历史", "道法"].map((subject) => {
                const subjects = formData.subjects_taught
                  ? formData.subjects_taught.split(",").map(s => s.trim())
                  : []
                const isChecked = subjects.includes(subject)
                
                return (
                  <div key={subject} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`subject-${subject}`}
                      checked={isChecked}
                      onChange={(e) => {
                        let newSubjects = subjects
                        if (e.target.checked) {
                          newSubjects = [...subjects, subject]
                        } else {
                          newSubjects = subjects.filter(s => s !== subject)
                        }
                        onInputChange("subjects_taught", newSubjects.join(", "))
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor={`subject-${subject}`} className="text-sm cursor-pointer">
                      {subject}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 约面日期与时间 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="interview_date">约面日期</Label>
            <Input
              id="interview_date"
              type="date"
              value={formData.interview_date}
              onChange={(e) => onInputChange("interview_date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interview_datetime">面试时间</Label>
            <Input
              id="interview_datetime"
              type="datetime-local"
              value={`${formData.interview_date}T${formData.interview_time || ''}`}
              onChange={(e) => {
                const [date, time] = e.target.value.split('T')
                onInputChange("interview_date", date)
                onInputChange("interview_time", time || '')
              }}
            />
          </div>
        </div>

        {/* 面试链接与面试官 */}
        <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="interviewer_name">面试官</Label>
            <Input
              id="interviewer_name"
              placeholder="面试官名字"
              value={formData.interviewer_name}
              onChange={(e) => onInputChange("interviewer_name", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
