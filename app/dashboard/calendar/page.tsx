"use client"

import { Header } from "@/components/dashboard/header"

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="课程日历" description="功能建设中，敬请期待" />
      <div className="p-6 text-muted-foreground">课程日历将以日历视图呈现课程安排。</div>
    </div>
  )
}

