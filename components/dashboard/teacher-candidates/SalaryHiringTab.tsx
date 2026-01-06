"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface SalaryHiringTabProps {
  formData: {
    approved_hourly_rate?: number | string
    teacher_level?: string
    can_teach_graduation_class?: boolean
    hired_notes?: string
    is_hired?: boolean
    review_status?: string
  }
  onInputChange: (field: string, value: string | number | boolean) => void
}

export function SalaryHiringTab({ formData, onInputChange }: SalaryHiringTabProps) {
  const isReviewed = formData.review_status === "已复核"
  const isHired = formData.is_hired

  return (
    <div className="space-y-6">
      {/* 薪资信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">薪资信息</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="approved_hourly_rate">谈定时薪</Label>
            <div className="flex items-center gap-2">
              <Input
                id="approved_hourly_rate"
                type="number"
                min="0"
                step="0.5"
                placeholder="元/小时"
                value={formData.approved_hourly_rate || ""}
                onChange={(e) => onInputChange("approved_hourly_rate", e.target.value ? parseFloat(e.target.value) : "")}
              />
              <span className="text-gray-500 text-sm">元/小时</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="teacher_level">老师级别</Label>
          <select
            id="teacher_level"
            value={formData.teacher_level || ""}
            onChange={(e) => onInputChange("teacher_level", e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="">请选择</option>
            <option value="初级">初级</option>
            <option value="中级">中级</option>
            <option value="高级">高级</option>
          </select>
        </div>
      </div>

      {/* 招聘决定 */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-blue-600">招聘决定</h3>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_hired"
              checked={formData.is_hired || false}
              onCheckedChange={(checked) => onInputChange("is_hired", checked as boolean)}
            />
            <Label htmlFor="is_hired" className="cursor-pointer font-normal">
              是否入库（标记为已录用）
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_teach_graduation_class"
              checked={formData.can_teach_graduation_class || false}
              onCheckedChange={(checked) => onInputChange("can_teach_graduation_class", checked as boolean)}
            />
            <Label htmlFor="can_teach_graduation_class" className="cursor-pointer font-normal">
              可排毕业班（具备高级教学能力）
            </Label>
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

      {/* 状态提示 */}
      {!isReviewed && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            需要先完成复核流程（设置为"已复核"），才能进行入库操作
          </AlertDescription>
        </Alert>
      )}

      {isReviewed && isHired && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            已完成复核且标记为录用，可进行入库操作
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
