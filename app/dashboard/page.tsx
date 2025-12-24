"use client"

import { Header } from "@/components/dashboard/header"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserPlus, GraduationCap, BookOpen, FileText, Target, Loader2 } from "lucide-react"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = [
    {
      title: "线索总数",
      value: "0",
      icon: Target,
      description: "所有线索记录",
    },
    {
      title: "教师候选人",
      value: "0",
      icon: UserPlus,
      description: "招聘中的候选人",
    },
    {
      title: "学生总数",
      value: "0",
      icon: Users,
      description: "已注册学生",
    },
    {
      title: "在职教师",
      value: "0",
      icon: GraduationCap,
      description: "活跃教师数量",
    },
    {
      title: "试听课程",
      value: "0",
      icon: BookOpen,
      description: "安排的试听课程",
    },
    {
      title: "正式订单",
      value: "0",
      icon: FileText,
      description: "已确认订单",
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header title="控制台" description={`欢迎回来，${user?.name || '用户'}`} />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>欢迎使用小牛好学教育管理系统</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              系统已成功连接到 Supabase，所有功能正在运行中。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
