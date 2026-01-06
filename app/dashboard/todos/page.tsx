"use client"

import { Header } from "@/components/dashboard/header"

export default function TodosPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="待办事项" description="功能建设中，敬请期待" />
      <div className="p-6 text-muted-foreground">待办事项将汇总个人与团队的待处理任务。</div>
    </div>
  )
}

