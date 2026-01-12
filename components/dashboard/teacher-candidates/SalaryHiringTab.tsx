"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { Plus, Trash2 } from "lucide-react"

interface GradeRateEntry {
  id: string
  grade: string
  workload: number
  hourlyRate: number
}

interface SalaryHiringTabProps {
  formData: {
    grade_level_settings?: Array<{
      grade: string
      workload: number
      hourlyRate: number
    }>
  }
  onInputChange: (field: string, value: Array<{
    grade: string
    workload: number
    hourlyRate: number
  }>) => void
}

export function SalaryHiringTab({ formData, onInputChange }: SalaryHiringTabProps) {
  const { items: grades, loading: gradesLoading } = useDictionary('grade')

  // 从 formData.grade_level_settings 初始化表格数据
  const [entries, setEntries] = useState<GradeRateEntry[]>(() => {
    const settings = formData.grade_level_settings || []
    return settings.map((setting, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      grade: setting.grade,
      workload: setting.workload,
      hourlyRate: setting.hourlyRate,
    }))
  })

  // 添加新行
  const handleAdd = () => {
    const newEntry: GradeRateEntry = {
      id: Math.random().toString(36).substr(2, 9),
      grade: "",
      workload: 0,
      hourlyRate: 0,
    }
    setEntries([...entries, newEntry])
  }

  // 删除行
  const handleRemove = (id: string) => {
    const newEntries = entries.filter(entry => entry.id !== id)
    setEntries(newEntries)
    updateParentData(newEntries)
  }

  // 更新行数据
  const handleEntryChange = (id: string, field: keyof GradeRateEntry, value: string | number) => {
    const newEntries = entries.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value }
      }
      return entry
    })
    setEntries(newEntries)
  }

  // 更新父组件数据
  const updateParentData = (data: GradeRateEntry[]) => {
    const settings = data
      .filter(entry => entry.grade) // 只保存有年级的数据
      .map(entry => ({
        grade: entry.grade,
        workload: entry.workload || 0,
        hourlyRate: entry.hourlyRate || 0,
      }))
    onInputChange("grade_level_settings", settings)
  }

  // 失去焦点时保存
  const handleBlur = () => {
    updateParentData(entries)
  }

  return (
    <div className="space-y-6">
      {/* 薪资信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">薪资信息</h3>

        {/* 年级-带课量-时薪表格 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              年级时薪配置 <span className="text-red-500">*</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 w-1/3">
                    年级
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 w-1/4">
                    带课量
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 w-1/4">
                    时薪 (元/小时)
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 w-16">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      暂无数据，请点击"添加"按钮添加年级时薪配置
                    </td>
                  </tr>
                ) : (
                  entries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2">
                        <select
                          value={entry.grade}
                          onChange={(e) => handleEntryChange(entry.id, 'grade', e.target.value)}
                          onBlur={handleBlur}
                          className="w-full h-9 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={gradesLoading}
                        >
                          <option value="">请选择年级</option>
                          {grades.map((grade) => (
                            <option key={grade.id} value={grade.label}>
                              {grade.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={entry.workload || ""}
                          onChange={(e) => handleEntryChange(entry.id, 'workload', parseFloat(e.target.value) || 0)}
                          onBlur={handleBlur}
                          className="h-9 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="请输入时薪"
                          value={entry.hourlyRate || ""}
                          onChange={(e) => handleEntryChange(entry.id, 'hourlyRate', parseFloat(e.target.value) || 0)}
                          onBlur={handleBlur}
                          className="h-9 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(entry.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            💡 提示：点击"添加"按钮手动添加年级、带课量和时薪配置
          </p>
        </div>
      </div>
    </div>
  )
}
