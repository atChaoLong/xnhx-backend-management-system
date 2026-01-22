"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "./input"
import { Button } from "./button"
import { Clock } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  minuteStep?: number // 分钟步进，默认 30（支持整点和半点）
}

/**
 * 时间选择器组件
 * 支持快速选择整点和半点，也支持手动输入
 */
export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  minuteStep = 30,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // 生成时间选项（整点和半点）
  const generateTimeOptions = () => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += minuteStep) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        options.push(timeStr)
      }
    }
    return options
  }

  const timeOptions = generateTimeOptions()

  // 将时间段分组（上午、下午）
  const groupedTimeOptions = {
    上午: timeOptions.filter(t => t < '12:00'),
    下午: timeOptions.filter(t => t >= '12:00'),
  }

  // 处理时间选择
  const handleTimeSelect = (time: string) => {
    onChange(time)
    setIsOpen(false)
  }

  // 处理手动输入
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value || "选择时间"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          {/* 手动输入 */}
          <div className="flex items-center gap-2 pb-3 border-b">
            <Input
              type="time"
              value={value}
              onChange={handleInputChange}
              className="h-9"
              step={minuteStep}
              disabled={disabled}
            />
          </div>

          {/* 快速选择 */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(groupedTimeOptions).map(([period, times]) => (
              <div key={period}>
                <div className="text-xs font-medium text-muted-foreground mb-1 sticky top-0 bg-background">
                  {period}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {times.map((time) => (
                    <Button
                      key={time}
                      variant={value === time ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleTimeSelect(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
