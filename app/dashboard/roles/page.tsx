"use client"

import { Header } from "@/components/dashboard/header"

export default function RolesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="角色管理" description="功能建设中，敬请期待" />
      <div className="p-6 text-muted-foreground">角色管理将支持权限矩阵的配置与分配。</div>
    </div>
  )
}

