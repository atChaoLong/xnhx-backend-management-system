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
  }
  onInputChange: (field: string, value: string | number | boolean) => void
}

export function SalaryHiringTab({ formData, onInputChange }: SalaryHiringTabProps) {
  return (
    <div className="space-y-6">
      {/* 薪资信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-blue-600">薪资信息</h3>

        <div className="space-y-2">
          <Label htmlFor="approved_hourly_rate">时薪（谈定）</Label>
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
    </div>
  )
}
