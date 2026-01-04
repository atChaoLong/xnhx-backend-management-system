"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileUpload } from "@/components/ui/file-upload"
import { useState, useEffect } from "react"

interface BasicInfoTabProps {
  formData: {
    name: string
    wechat_id: string
    resume_url?: string
    profile_photo_url?: string
    grade_level: string
    subjects_taught: string
    teacher_type: string
    trial_subject: string
    teaching_style: string
  }
  onInputChange: (field: string, value: string | boolean) => void
  onFileUpload?: (field: string, url: string) => void
}

// 老师类型选项（如果字典系统不可用，使用这个默认列表）
const DEFAULT_TEACHER_TYPES = [
  "机构老师（k12）",
  "机构老师（非k12）",
  "学校老师",
  "研究生",
  "大学生",
  "其他",
]

export function BasicInfoTab({ formData, onInputChange, onFileUpload }: BasicInfoTabProps) {
  const [teacherTypes] = useState(DEFAULT_TEACHER_TYPES)
  const [customTeacherType, setCustomTeacherType] = useState("")

  // 当选择"其他"时，清空自定义输入
  const isCustom = formData.teacher_type && !DEFAULT_TEACHER_TYPES.includes(formData.teacher_type)

  const handleTeacherTypeChange = (value: string) => {
    if (value === "其他") {
      onInputChange("teacher_type", "")
      setCustomTeacherType("")
    } else {
      onInputChange("teacher_type", value)
      setCustomTeacherType("")
    }
  }

  const handleCustomTypeChange = (value: string) => {
    setCustomTeacherType(value)
    onInputChange("teacher_type", value)
  }

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

      {/* 岗位信息 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">岗位信息</h3>

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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="teacher_type">老师类型</Label>
            <select
              id="teacher_type"
              value={isCustom ? "custom" : formData.teacher_type}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setCustomTeacherType(formData.teacher_type || "")
                } else {
                  handleTeacherTypeChange(e.target.value)
                }
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">请选择</option>
              {teacherTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              {isCustom && <option value="custom">✓ 自定义: {formData.teacher_type}</option>}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trial_subject">试讲科目</Label>
            <Input
              id="trial_subject"
              placeholder="试讲指定科目"
              value={formData.trial_subject}
              onChange={(e) => onInputChange("trial_subject", e.target.value)}
            />
          </div>
        </div>

        {/* 自定义老师类型输入 */}
        {isCustom && (
          <div className="space-y-2">
            <Label htmlFor="teacher_type_custom">自定义老师类型</Label>
            <Input
              id="teacher_type_custom"
              placeholder="输入自定义类型（如：全职、兼职、实习等）"
              value={customTeacherType}
              onChange={(e) => handleCustomTypeChange(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              选择"其他"选项可切回标准选项
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="teaching_style">授课风格</Label>
          <Textarea
            id="teaching_style"
            placeholder="请描述教学风格"
            value={formData.teaching_style}
            onChange={(e) => onInputChange("teaching_style", e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
