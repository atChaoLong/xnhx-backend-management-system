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
  Shield
} from "lucide-react"

const navigation = [
  { name: "控制台", href: "/dashboard", icon: LayoutDashboard },
  { name: "每日线索", href: "/dashboard/daily-leads", icon: Target },
  { name: "老师面试", href: "/dashboard/teacher-candidates", icon: UserPlus },
  { name: "线索管理", href: "/dashboard/leads", icon: Code },
  { name: "学生管理", href: "/dashboard/students", icon: Users },
  { name: "老师管理", href: "/dashboard/teachers", icon: GraduationCap },
  { name: "试听课程", href: "/dashboard/trial-lessons", icon: BookOpen },
  { name: "正式订单", href: "/dashboard/formal-orders", icon: FileText },
  { name: "销售人员", href: "/dashboard/wechat-accounts", icon: MessageCircle },
  // { name: "销售人员", href: "/dashboard/sales", icon: UserCheck },
  { name: "异动记录", href: "/dashboard/transactions", icon: RefreshCw },
  // { name: "老师面试", href: "/dashboard/recruitment", icon: School },
  { name: "字典管理", href: "/dashboard/dictionaries", icon: List },
  { name: "账号管理", href: "/dashboard/accounts", icon: Shield },
  { name: "数据同步", href: "/dashboard/sync", icon: RefreshCw },
  { name: "ClassIn SDK", href: "/dashboard/classin-sdk", icon: Database },
  // { name: "ClassIn 集成", href: "/dashboard/classin", icon: Database },
  // { name: "ClassIn 测试", href: "/dashboard/classin/test", icon: TestTube },
  // { name: "自定义视图", href: "/dashboard/teachers-views", icon: Eye },
  // { name: "设置", href: "/dashboard/settings", icon: Settings },
]

interface SidebarProps {
  user: any
  onLogout: () => void
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-36 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <School className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">小牛好学</span>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
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
