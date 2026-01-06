"use client"

import { Header } from "@/components/dashboard/header"

export default function ClassroomPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="课堂管理" description="功能建设中，敬请期待" />
      <div className="p-6 text-muted-foreground">课堂管理将展示课堂排期与课堂明细。</div>
    </div>
  )
}

