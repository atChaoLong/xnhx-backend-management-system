import { ACTIONS, RESOURCES, hasPermission, type Action, type Resource, type Role } from "@/lib/permissions"

type RequiredPermission = {
  resource: Resource
  action: Action
}

type DashboardRouteRule = {
  path: string
  label: string
  exact?: boolean
  roles?: Role[]
  permissions?: RequiredPermission[]
}

const dailyBusinessRoles: Role[] = ["admin", "operator", "sales", "head_teacher"]
const orderRoles: Role[] = ["admin", "sales", "head_teacher"]
const academicRoles: Role[] = ["admin", "academic_affairs", "head_teacher", "hr", "finance"]
const academicCoreRoles: Role[] = ["admin", "academic_affairs"]
const qualityRoles: Role[] = ["admin", "academic_affairs", "head_teacher"]
const todoRoles: Role[] = ["admin", "operator", "sales", "head_teacher", "academic_affairs"]
const systemRoles: Role[] = ["admin"]

const routeRules: DashboardRouteRule[] = [
  { path: "/dashboard", label: "控制台", exact: true },

  { path: "/dashboard/debug", label: "调试页面", roles: systemRoles },
  { path: "/dashboard/test-dictionary-cache", label: "字典缓存测试", roles: systemRoles },
  { path: "/dashboard/sync", label: "数据同步", roles: systemRoles },
  { path: "/dashboard/classin-sdk", label: "ClassIn SDK", roles: systemRoles },
  { path: "/dashboard/classin", label: "ClassIn 管理", roles: systemRoles },
  { path: "/dashboard/wechat-accounts", label: "微信账号管理", roles: systemRoles },

  {
    path: "/dashboard/accounts",
    label: "账号管理",
    roles: systemRoles,
    permissions: [{ resource: RESOURCES.users, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/roles",
    label: "角色管理",
    roles: systemRoles,
    permissions: [{ resource: RESOURCES.users, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/dictionaries",
    label: "字典管理",
    roles: systemRoles,
    permissions: [{ resource: RESOURCES.dictionaries, action: ACTIONS.view }],
  },

  {
    path: "/dashboard/public-leads",
    label: "公共线索池",
    roles: ["sales", "admin"],
    permissions: [{ resource: RESOURCES.leads, action: ACTIONS.assign }],
  },
  {
    path: "/dashboard/leads/new",
    label: "新建线索",
    roles: dailyBusinessRoles,
    permissions: [{ resource: RESOURCES.leads, action: ACTIONS.create }],
  },
  {
    path: "/dashboard/leads",
    label: "线索跟进",
    roles: dailyBusinessRoles,
    permissions: [{ resource: RESOURCES.leads, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/daily-leads",
    label: "每日线索",
    roles: ["admin", "operator"],
    permissions: [{ resource: RESOURCES.leads, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/feedback",
    label: "回访管理",
    roles: ["admin", "head_teacher"],
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.visit }],
  },
  {
    path: "/dashboard/feedback/students",
    label: "正式生管理",
    roles: ["admin", "head_teacher"],
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.view }],
  },

  {
    path: "/dashboard/trial-lessons/new",
    label: "新建试听",
    roles: ["sales"],
    permissions: [{ resource: RESOURCES.trialLessons, action: ACTIONS.create }],
  },
  {
    path: "/dashboard/trial-lessons",
    label: "试听课",
    roles: ["admin", "sales", "head_teacher", "hr", "finance"],
    permissions: [{ resource: RESOURCES.trialLessons, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/formal-orders/new",
    label: "新建正式订单",
    roles: orderRoles,
    permissions: [{ resource: RESOURCES.formalOrders, action: ACTIONS.create }],
  },
  {
    path: "/dashboard/formal-orders",
    label: "正式课",
    roles: orderRoles,
    permissions: [{ resource: RESOURCES.formalOrders, action: ACTIONS.view }],
  },

  {
    path: "/dashboard/teacher-candidates/interview",
    label: "老师约面",
    roles: ["admin", "teacher_recruiter"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.interview }],
  },
  {
    path: "/dashboard/teacher-candidates/upload",
    label: "初试录像上传",
    roles: ["admin", "teacher_recruiter"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.uploadVideo }],
  },
  {
    path: "/dashboard/teacher-candidates/review",
    label: "教学复核",
    roles: ["admin"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.reviewVideo }],
  },
  {
    path: "/dashboard/teacher-candidates/pending",
    label: "待入库老师",
    roles: ["admin", "academic_affairs", "hr", "finance"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.confirmEntry }],
  },
  {
    path: "/dashboard/teacher-candidates/reserve",
    label: "储备候选人",
    roles: ["admin", "teacher_recruiter", "academic_affairs"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/teacher-candidates/submissions",
    label: "信息采集记录",
    roles: ["admin", "teacher_recruiter"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/teacher-candidates",
    label: "面试管理",
    roles: ["admin", "teacher_recruiter"],
    permissions: [{ resource: RESOURCES.teacherCandidates, action: ACTIONS.view }],
  },

  {
    path: "/dashboard/teachers/sales",
    label: "老师库（销售版）",
    roles: orderRoles,
    permissions: [{ resource: RESOURCES.teachers, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/teachers/teaching",
    label: "老师库（教学版）",
    roles: academicCoreRoles,
    permissions: [{ resource: RESOURCES.teachers, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/teachers/exceptions",
    label: "新入库异常",
    roles: academicCoreRoles,
    permissions: [{ resource: RESOURCES.teachers, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/teachers/new",
    label: "新建老师",
    roles: ["admin", "academic_affairs", "operator"],
    permissions: [{ resource: RESOURCES.teachers, action: ACTIONS.create }],
  },
  {
    path: "/dashboard/teachers",
    label: "老师库存管理",
    roles: academicRoles,
    permissions: [{ resource: RESOURCES.teachers, action: ACTIONS.view }],
  },

  {
    path: "/dashboard/academic/pending-trials",
    label: "待试听匹配",
    roles: ["admin"],
    permissions: [{ resource: RESOURCES.trialLessons, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/academic/students",
    label: "学生库（教务版）",
    roles: academicCoreRoles,
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/students/new",
    label: "新建学生",
    roles: ["admin", "head_teacher"],
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.create }],
  },
  {
    path: "/dashboard/students",
    label: "学生管理",
    roles: ["admin", "head_teacher", "sales", "finance"],
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/formal-students",
    label: "正式生管理",
    roles: ["admin", "head_teacher", "hr", "finance"],
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/schedule/batch",
    label: "批量排课",
    roles: ["admin", "head_teacher", "hr", "finance"],
    permissions: [{ resource: RESOURCES.classSessions, action: ACTIONS.create }],
  },
  {
    path: "/dashboard/classroom",
    label: "课堂管理",
    roles: academicRoles,
    permissions: [{ resource: RESOURCES.classSessions, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/calendar",
    label: "课程日历",
    roles: academicRoles,
    permissions: [{ resource: RESOURCES.classSessions, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/courses",
    label: "课程管理",
    roles: academicRoles,
    permissions: [{ resource: RESOURCES.courses, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/transactions",
    label: "课程异动",
    roles: ["admin", "academic_affairs", "head_teacher", "finance"],
    permissions: [{ resource: RESOURCES.transactions, action: ACTIONS.view }],
  },

  {
    path: "/dashboard/quality/trial-conversion",
    label: "试听转化质检",
    roles: qualityRoles,
    permissions: [{ resource: RESOURCES.trialLessons, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/quality/service",
    label: "课后服务质检",
    roles: qualityRoles,
    permissions: [{ resource: RESOURCES.students, action: ACTIONS.view }],
  },
  {
    path: "/dashboard/grab-logs",
    label: "抢单记录日志",
    roles: systemRoles,
  },
  {
    path: "/dashboard/todos",
    label: "任务列表",
    roles: todoRoles,
    permissions: [{ resource: RESOURCES.todos, action: ACTIONS.view }],
  },
]

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }

  return pathname
}

function matchesRule(pathname: string, rule: DashboardRouteRule): boolean {
  if (rule.exact) {
    return pathname === rule.path
  }

  return pathname === rule.path || pathname.startsWith(`${rule.path}/`)
}

export function getDashboardRouteRule(pathname: string): DashboardRouteRule | undefined {
  const normalizedPathname = normalizePath(pathname)

  return routeRules.find((rule) => matchesRule(normalizedPathname, rule))
}

export function canAccessDashboardRoute(role: Role | undefined, pathname: string): boolean {
  const rule = getDashboardRouteRule(pathname)

  if (!rule) {
    return role === "admin"
  }

  if (rule.roles && (!role || !rule.roles.includes(role))) {
    return false
  }

  if (rule.permissions?.length) {
    return rule.permissions.every(({ resource, action }) => hasPermission(role, resource, action))
  }

  return true
}
