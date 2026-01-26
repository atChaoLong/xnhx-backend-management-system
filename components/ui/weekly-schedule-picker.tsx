"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TimePicker } from "@/components/ui/time-picker"

export interface WeeklySchedule {
  monday: string | null
  tuesday: string | null
  wednesday: string | null
  thursday: string | null
  friday: string | null
  saturday: string | null
  sunday: string | null
}

const days = [
  { key: 'monday', label: '周一' },
  { key: 'tuesday', label: '周二' },
  { key: 'wednesday', label: '周三' },
  { key: 'thursday', label: '周四' },
  { key: 'friday', label: '周五' },
  { key: 'saturday', label: '周六' },
  { key: 'sunday', label: '周日' },
]

interface WeeklySchedulePickerProps {
  value: WeeklySchedule
  onChange: (value: WeeklySchedule) => void
  label?: string
  defaultStartTime?: string // 默认开课时间
}

export function WeeklySchedulePicker({ value, onChange, label, defaultStartTime }: WeeklySchedulePickerProps) {
  const handleTimeChange = (dayKey: keyof WeeklySchedule, time: string) => {
    onChange({
      ...value,
      [dayKey]: time,
    })
  }

  const handleAddDay = (dayKey: keyof WeeklySchedule) => {
    onChange({
      ...value,
      [dayKey]: defaultStartTime || '09:00', // 使用默认开课时间，如果没有则使用 09:00
    })
  }

  const handleRemoveDay = (dayKey: keyof WeeklySchedule) => {
    onChange({
      ...value,
      [dayKey]: null,
    })
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
        {days.map((day) => {
          const dayKey = day.key as keyof WeeklySchedule
          const time = value[dayKey]

          return (
            <div
              key={dayKey}
              className="border rounded-md p-2 flex flex-col items-center gap-2"
            >
              {time ? (
                <>
                  <span className="text-sm font-medium whitespace-nowrap text-xs shrink-0">
                    {day.label}
                  </span>
                  <div className="flex items-center gap-1 w-full">
                    <TimePicker
                      value={time}
                      onChange={(newTime) => handleTimeChange(dayKey, newTime)}
                      className="h-8 flex-1 min-w-0 text-xs"
                      minuteStep={60}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveDay(dayKey)}
                      className="h-8 w-8 text-base p-0 shrink-0"
                    >
                      ×
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium whitespace-nowrap text-xs shrink-0">
                    {day.label}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddDay(dayKey)}
                    className="w-full h-8 text-xs"
                  >
                    +添加
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* 提示信息 */}
      <div className="text-xs text-muted-foreground">
        {Object.values(value).filter((v): v is string => v !== null).length === 0 ? (
          <span className="text-destructive">请至少选择一天的时间</span>
        ) : (
          <span>已选择 {Object.values(value).filter((v): v is string => v !== null).length} 天</span>
        )}
      </div>
    </div>
  )
}
