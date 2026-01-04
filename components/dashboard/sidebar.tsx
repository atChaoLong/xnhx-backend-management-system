"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  Target,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  MessageCircle,
  RefreshCw,
  UserPlus,
  Settings,
  List,
  Eye,
  LogOut,
  School,
  Video,
  Shield,
  ChevronDown,
  ChevronRight,
  Calendar,
  Monitor,
  Database,
  TestTube,
  ClipboardList,
  Phone,
  AlertTriangle,
} from "lucide-react"
import { useState } from "react"
import { usePermission } from "@/lib/hooks/usePermission"

// 菜单项类型
interface MenuItem {
  name: string
  href: string
  icon: any
  permission?: { resource: string; action: string }  // 权限检查
}

// 菜单组类型
interface MenuGroup {
  title: string
  items: MenuItem[]
  roles?: string[]  // 允许访问的角色列表，空数组表示所有角色都可访问
}

// 导航组配置 - 根据角色和业务流程组织
const navigationGroups: MenuGroup[] = [
  {
    title: "控制台",
    items: [
      { name: "首页", href: "/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "运营管理",
    roles: ['admin', 'operator'],
    items: [
      { name: "线索录入", href: "/dashboard/leads", icon: Target, permission: { resource: 'leads', action: 'create' } },
      { name: "客户回访", href: "/dashboard/daily-leads", icon: MessageCircle, permission: { resource: 'leads', action: 'view' } },
    ]
  },
  {
    title: "销售管理",
    roles: ['admin', 'sales', 'head_teacher'],
    items: [
      { name: "线索管理", href: "/dashboard/leads", icon: Target, permission: { resource: 'leads', action: 'view' } },
      { name: "试听课程", href: "/dashboard/trial-lessons", icon: BookOpen, permission: { resource: 'trialLessons', action: 'view' } },
      { name: "正式订单", href: "/dashboard/formal-orders", icon: FileText, permission: { resource: 'formalOrders', action: 'view' } },
      { name: "学生管理", href: "/dashboard/students", icon: Users, permission: { resource: 'students', action: 'view' } },
      { name: "异动记录", href: "/dashboard/transactions", icon: RefreshCw, permission: { resource: 'transactions', action: 'view' } },
    ]
  },
  {
    title: "老师面试",
    roles: ['admin', 'hr', 'academic_affairs'],
    items: [
      { name: "老师约面", href: "/dashboard/teacher-candidates", icon: UserPlus, permission: { resource: 'teacherCandidates', action: 'interview' } },
      { name: "初试管理", href: "/dashboard/teacher-candidates", icon: ClipboardList, permission: { resource: 'teacherCandidates', action: 'evaluate' } },
      { name: "录像上传", href: "/dashboard/teacher-candidates", icon: Video, permission: { resource: 'teacherCandidates', action: 'uploadVideo' } },
      { name: "教学复核", href: "/dashboard/teacher-candidates", icon: Eye, permission: { resource: 'teacherCandidates', action: 'reviewVideo' } },
    ]
  },
  {
    title: "老师库",
    roles: ['admin', 'hr', 'academic_affairs', 'sales', 'head_teacher'],
    items: [
      { name: "待入库", href: "/dashboard/teachers", icon: GraduationCap, permission: { resource: 'teachers', action: 'create' } },
      { name: "储备", href: "/dashboard/teachers", icon: Users, permission: { resource: 'teachers', action: 'view' } },
      { name: "老师库（教学版）", href: "/dashboard/teachers", icon: School, permission: { resource: 'teachers', action: 'edit' } },
      { name: "老师库（销售版）", href: "/dashboard/teachers", icon: Phone, permission: { resource: 'teachers', action: 'view' } },
      { name: "新入库异常", href: "/dashboard/teachers", icon: AlertTriangle, permission: { resource: 'teachers', action: 'notes' } },
    ]
  },
  {
    title: "教务管理",
    roles: ['admin', 'academic_affairs'],
    items: [
      { name: "试听转化质检", href: "/dashboard/trial-lessons", icon: TestTube, permission: { resource: 'trialLessons', action: 'edit' } },
      { name: "课后服务质检", href: "/dashboard/students", icon: ClipboardList, permission: { resource: 'students', action: 'visit' } },
      { name: "学生库", href: "/dashboard/students", icon: Users, permission: { resource: 'students', action: 'view' } },
      { name: "待试听匹配", href: "/dashboard/trial-lessons", icon: Calendar, permission: { resource: 'trialLessons', action: 'matchTeacher' } },
      { name: "批量排课", href: "/dashboard/schedule/batch", icon: Calendar },
    ]
  },
  {
    title: "系统管理",
    roles: ['admin'],
    items: [
      { name: "字典管理", href: "/dashboard/dictionaries", icon: List },
      { name: "用户管理", href: "/dashboard/accounts", icon: Shield },
      { name: "角色管理", href: "/dashboard/roles", icon: UserPlus },
      { name: "销售人员", href: "/dashboard/wechat-accounts", icon: MessageCircle },
      { name: "数据同步", href: "/dashboard/sync", icon: Database },
      { name: "ClassIn SDK", href: "/dashboard/classin-sdk", icon: Settings },
    ]
  },
  {
    title: "ClassIn管理",
    roles: ['admin', 'academic_affairs'],
    items: [
      { name: "学生", href: "/dashboard/classin/students", icon: Users },
      { name: "老师", href: "/dashboard/classin/teachers", icon: GraduationCap },
      { name: "班级", href: "/dashboard/classin/classes", icon: Monitor },
      { name: "课堂", href: "/dashboard/classin", icon: Video },
    ]
  }
]

interface SidebarProps {
  user: any
  onLogout: () => void
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const { role, checkPermission } = usePermission()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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

  // 检查用户是否有权限访问某个菜单组
  const canAccessGroup = (group: MenuGroup): boolean => {
    // 如果没有指定角色限制，所有角色都可以访问
    if (!group.roles || group.roles.length === 0) {
      return true
    }
    // 检查用户角色是否在允许列表中
    return group.roles.includes(role || '')
  }

  // 检查用户是否有权限访问某个菜单项
  const canAccessItem = (item: MenuItem): boolean => {
    // 如果没有权限要求，默认可以访问
    if (!item.permission) {
      return true
    }
    // 检查权限
    return checkPermission(item.permission.resource as any, item.permission.action as any)
  }

  // 过滤并处理菜单组
  const visibleGroups = navigationGroups.filter(group => canAccessGroup(group))

  return (
    <div className="flex h-full w-56 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <School className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">小牛好学</span>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-4">
          {visibleGroups.map((group) => {
            // 过滤组内有权限访问的菜单项
            const visibleItems = group.items.filter(item => canAccessItem(item))

            // 如果组内没有可见的菜单项，不显示整个组
            if (visibleItems.length === 0) {
              return null
            }

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
                    {visibleItems.map((item) => {
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
