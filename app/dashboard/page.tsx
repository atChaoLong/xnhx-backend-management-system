"use client"

import { Header } from "@/components/dashboard/header"
import { useApp } from "@/lib/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserPlus, GraduationCap, BookOpen, FileText, Target } from "lucide-react"

export default function DashboardPage() {
  const { leads, teacherCandidates, students, teachers, trialLessons, formalOrders, dailyLeads } = useApp()

  const stats = [
    {
      title: "总线索数",
      value: leads.length,
      icon: Target,
      description: "所有线索记录",
    },
    {
      title: "教师候选人",
      value: teacherCandidates.length,
      icon: UserPlus,
      description: "招聘中的候选人",
    },
    {
      title: "学生总数",
      value: students.length,
      icon: Users,
      description: "已注册学生",
    },
    {
      title: "在职教师",
      value: teachers.length,
      icon: GraduationCap,
      description: "活跃教师数量",
    },
    {
      title: "试听课程",
      value: trialLessons.length,
      icon: BookOpen,
      description: "安排的试听课程",
    },
    {
      title: "正式订单",
      value: formalOrders.length,
      icon: FileText,
      description: "已确认订单",
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header title="控制台" description="系统运营数据概览" />

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
            <CardTitle>每日线索概览</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无每日线索数据</p>
            ) : (
              <div className="space-y-4">
                {dailyLeads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.wechatNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{lead.assignedPerson}</p>
                      <p className="text-xs text-muted-foreground">{lead.receivedDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
