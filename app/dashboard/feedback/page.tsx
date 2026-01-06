"use client"

import { Header } from "@/components/dashboard/header"

export default function FeedbackPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="回访管理" description="功能建设中，敬请期待" />
      <div className="p-6 text-muted-foreground">回访管理将支持对客户回访记录与计划的统一管理。</div>
    </div>
  )
}

