"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  Target,
  Code,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  MessageCircle,
  UserCheck,
  RefreshCw,
  UserPlus,
  Settings,
  List,
  Eye,
  LogOut,
  School,
  TestTube,
  Database,
  Shield,
  ChevronDown,
  ChevronRight,
  Calendar
} from "lucide-react"
import { useState } from "react"

// 导航组配置 - 按照客户实际业务流程组织
const navigationGroups = [
  {
    title: "控制台",
    items: [
      { name: "首页", href: "/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "客户管理",
    items: [
      { name: "线索跟进", href: "/dashboard/leads", icon: Target },
      { name: "客户回访", href: "/dashboard/daily-leads", icon: MessageCircle },
    ]
  },
  {
    title: "订单管理",
    items: [
      { name: "试听课", href: "/dashboard/trial-lessons", icon: BookOpen },
      { name: "正式课", href: "/dashboard/formal-orders", icon: FileText },
    ]
  },
  {
    title: "教务管理",
    items: [
      { name: "面试管理", href: "/dashboard/teacher-candidates", icon: UserPlus },
      { name: "老师库存管理", href: "/dashboard/teachers", icon: GraduationCap },
      { name: "学生管理", href: "/dashboard/students", icon: Users },
      { name: "排课管理", href: "/dashboard/schedule", icon: Calendar },
      { name: "课程日历", href: "/dashboard/calendar", icon: Eye },
    ]
  },
  {
    title: "待办事项",
    items: [
      { name: "待办任务", href: "/dashboard/tasks", icon: Eye },
      { name: "异动记录", href: "/dashboard/transactions", icon: RefreshCw },
    ]
  },
  {
    title: "系统管理",
    items: [
      { name: "字典管理", href: "/dashboard/dictionaries", icon: List },
      { name: "用户管理", href: "/dashboard/accounts", icon: Shield },
      { name: "角色管理", href: "/dashboard/roles", icon: UserCheck },
      { name: "销售人员", href: "/dashboard/wechat-accounts", icon: MessageCircle },
      { name: "数据同步", href: "/dashboard/sync", icon: Database },
      { name: "ClassIn SDK", href: "/dashboard/classin-sdk", icon: Settings },
    ]
  }
]

interface SidebarProps {
  user: any
  onLogout: () => void
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["业务管理", "系统管理"]))

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupTitle)) {
        newSet.delete(groupTitle)
      } else {
        newSet.add(groupTitle)
      }
      return newSet
    })
  }

  return (
    <div className="flex h-full w-48 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <School className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">小牛好学</span>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-4">
          {navigationGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.title)
            return (
              <div key={group.title}>
                {/* 分组标题 - 可折叠 */}
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {group.title}
                </button>

                {/* 分组菜单项 */}
                {isExpanded && (
                  <div className="mt-1 space-y-1 ml-2">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.name || "用户"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </Button>
      </div>
    </div>
  )
}
