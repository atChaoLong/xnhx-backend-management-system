/**
 * API路由权限配置
 * 集中管理所有API路由的权限要求
 */

import { RESOURCES, ACTIONS } from './permissions'

/**
 * 路由权限映射表
 * 路径 -> HTTP方法 -> 资源 + 操作
 */
export const ROUTE_PERMISSIONS = {
  // 线索管理
  '/api/leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },

  // 线索反馈（特殊权限）
  '/api/leads/feedback': {
    POST: { resource: RESOURCES.leads, action: ACTIONS.feedback },
  },
  // 线索分配（抢单/释放）
  '/api/leads/grab': {
    POST: { resource: RESOURCES.leads, action: ACTIONS.assign },
  },
  '/api/leads/release': {
    POST: { resource: RESOURCES.leads, action: ACTIONS.assign },
  },
  '/api/lead-grab-logs': {
    GET: { resource: RESOURCES.users, action: ACTIONS.delete },
  },
  '/api/leads/[id]': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },
  '/api/public-leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.assign },
  },

  // 试听管理
  '/api/trial-lessons': {
    GET: { resource: RESOURCES.trialLessons, action: ACTIONS.view },
    POST: { resource: RESOURCES.trialLessons, action: ACTIONS.create },
    PUT: { resource: RESOURCES.trialLessons, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.trialLessons, action: ACTIONS.delete },
  },
  // 试听开课（后端内部消化）
  '/api/trial-lessons/open-class': {
    POST: { resource: RESOURCES.trialLessons, action: ACTIONS.addLink },
  },
  // 试听创建ClassIn课程（保留旧接口）
  '/api/trial-lessons/create-classin': {
    POST: { resource: RESOURCES.trialLessons, action: ACTIONS.addLink },
  },

  // 学生管理
  '/api/students': {
    GET: { resource: RESOURCES.students, action: ACTIONS.view },
    POST: { resource: RESOURCES.students, action: ACTIONS.create },
    PUT: { resource: RESOURCES.students, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.students, action: ACTIONS.delete },
  },
  // 学生分配班主任
  '/api/students/assign-head-teacher': {
    POST: { resource: RESOURCES.students, action: ACTIONS.edit },
  },
  // 学生详情
  '/api/students/detail': {
    GET: { resource: RESOURCES.students, action: ACTIONS.view },
  },
  '/api/students/register-classin': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/students/status-history': {
    GET: { resource: RESOURCES.students, action: ACTIONS.view },
  },
  '/api/students/update-status': {
    PUT: { resource: RESOURCES.students, action: ACTIONS.edit },
  },
  '/api/student-entries/confirm': {
    POST: { resource: RESOURCES.students, action: ACTIONS.create },
  },

  // 课程管理
  '/api/courses': {
    GET: { resource: RESOURCES.courses, action: ACTIONS.view },
    POST: { resource: RESOURCES.courses, action: ACTIONS.create },
    PUT: { resource: RESOURCES.courses, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.courses, action: ACTIONS.delete },
  },
  // 课程按订单查询
  '/api/courses/by-order': {
    GET: { resource: RESOURCES.courses, action: ACTIONS.view },
  },
  '/api/courses/by-order/[orderId]': {
    GET: { resource: RESOURCES.courses, action: ACTIONS.view },
  },
  // 关联 ClassIn 课程
  '/api/courses/link-classin': {
    POST: { resource: RESOURCES.courses, action: ACTIONS.edit },
  },
  // 课程课时
  '/api/courses/[courseId]/sessions': {
    GET: { resource: RESOURCES.courses, action: ACTIONS.view },
  },
  // 同步课程统计
  '/api/courses/[courseId]/sync-stats': {
    POST: { resource: RESOURCES.courses, action: ACTIONS.edit },
  },
  // 计算课程消耗
  '/api/courses/[courseId]/consumption': {
    GET: { resource: RESOURCES.courses, action: ACTIONS.view },
  },
  // 课时管理
  '/api/class-sessions': {
    GET: { resource: RESOURCES.classSessions, action: ACTIONS.view },
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.create },
    PUT: { resource: RESOURCES.classSessions, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.classSessions, action: ACTIONS.delete },
  },
  '/api/class-sessions/export': {
    GET: { resource: RESOURCES.classSessions, action: ACTIONS.edit },
  },
  '/api/class-sessions/recreate': {
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.edit },
  },
  '/api/class-sessions/sync': {
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.edit },
  },
  '/api/classroom-classin': {
    GET: { resource: RESOURCES.classSessions, action: ACTIONS.view },
  },
  '/api/classrooms/scheduled': {
    GET: { resource: RESOURCES.classSessions, action: ACTIONS.view },
  },

  // 回访记录
  '/api/visit-records': {
    GET: { resource: RESOURCES.students, action: ACTIONS.visit },
    POST: { resource: RESOURCES.students, action: ACTIONS.visit },
    PUT: { resource: RESOURCES.students, action: ACTIONS.visit },
    DELETE: { resource: RESOURCES.students, action: ACTIONS.delete },
  },

  // 质检报告
  '/api/quality-reports/export': {
    GET: { resource: RESOURCES.students, action: ACTIONS.view },
  },
  '/api/quality-reports': {
    GET: { resource: RESOURCES.students, action: ACTIONS.view },
    POST: { resource: RESOURCES.students, action: ACTIONS.edit },
    PUT: { resource: RESOURCES.students, action: ACTIONS.edit },
  },

  // 正式订单
  '/api/formal-orders': {
    GET: { resource: RESOURCES.formalOrders, action: ACTIONS.view },
    POST: { resource: RESOURCES.formalOrders, action: ACTIONS.create },
    PUT: { resource: RESOURCES.formalOrders, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.formalOrders, action: ACTIONS.delete },
  },

  // 课程异动
  '/api/transactions': {
    GET: { resource: RESOURCES.transactions, action: ACTIONS.view },
    POST: { resource: RESOURCES.transactions, action: ACTIONS.create },
    PUT: { resource: RESOURCES.transactions, action: [ACTIONS.edit, ACTIONS.verifyHours, ACTIONS.payment, ACTIONS.verifyPerformance] },
    DELETE: { resource: RESOURCES.transactions, action: ACTIONS.delete },
  },

  // 老师面试
  '/api/teacher-candidates': {
    GET: { resource: RESOURCES.teacherCandidates, action: ACTIONS.view },
    POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.create },
    PUT: { resource: RESOURCES.teacherCandidates, action: [ACTIONS.evaluate, ACTIONS.confirmEntry] },
    DELETE: { resource: RESOURCES.teacherCandidates, action: ACTIONS.delete },
  },
  '/api/teacher-candidates/recruitment-flow': {
    GET: { resource: RESOURCES.teacherCandidates, action: ACTIONS.view },
    PUT: { resource: RESOURCES.teacherCandidates, action: [ACTIONS.evaluate, ACTIONS.confirmEntry] },
  },
  '/api/teacher-form-submissions': {
    GET: { resource: RESOURCES.teacherCandidates, action: ACTIONS.view },
  },

  // 老师库
  '/api/teachers': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.view },
    POST: { resource: RESOURCES.teachers, action: ACTIONS.create },
    PUT: { resource: RESOURCES.teachers, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.teachers, action: ACTIONS.delete },
  },
  '/api/teachers/register-classin': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/teachers/classin': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.view },
  },
  '/api/teachers/exceptions': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.edit },
    POST: { resource: RESOURCES.teachers, action: ACTIONS.edit },
  },

  // 字典管理
  '/api/dictionaries': {
    GET: { resource: RESOURCES.dictionaries, action: ACTIONS.view },
    POST: { resource: RESOURCES.dictionaries, action: ACTIONS.create },
    PUT: { resource: RESOURCES.dictionaries, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.dictionaries, action: ACTIONS.delete },
  },

  // 用户管理
  '/api/users': {
    GET: { resource: RESOURCES.users, action: ACTIONS.view },
    POST: { resource: RESOURCES.users, action: ACTIONS.create },
    PUT: { resource: RESOURCES.users, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.users, action: ACTIONS.delete },
  },

  // 每日线索（招聘线索）
  '/api/daily-leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },

  // 微信号管理（历史废弃模块，包含登录/支付密码，保留为 admin-only）
  '/api/wechat-accounts': {
    GET: { resource: RESOURCES.users, action: ACTIONS.delete },
    POST: { resource: RESOURCES.users, action: ACTIONS.delete },
    PUT: { resource: RESOURCES.users, action: ACTIONS.delete },
    DELETE: { resource: RESOURCES.users, action: ACTIONS.delete },
  },

  // 待办
  '/api/todos': {
    GET: { resource: RESOURCES.todos, action: ACTIONS.view },
    POST: { resource: RESOURCES.todos, action: ACTIONS.create },
    PUT: { resource: RESOURCES.todos, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.todos, action: ACTIONS.delete },
  },
  '/api/todos/[id]/complete': {
    POST: { resource: RESOURCES.todos, action: ACTIONS.edit },
  },

  // 通用上传入口：这里只做登录态和基础上传入口授权，具体 bucket 仍由路由内二次校验
  '/api/upload': {
    POST: { resource: RESOURCES.uploads, action: ACTIONS.create },
  },
  '/api/upload/sign': {
    POST: { resource: RESOURCES.uploads, action: ACTIONS.create },
  },

  // 用户档案与调试
  '/api/user-profiles': {
    GET: { resource: RESOURCES.users, action: ACTIONS.view },
  },
  '/api/debug/current-user': {
    GET: { resource: RESOURCES.users, action: ACTIONS.delete },
  },
  '/api/debug/network-test': {
    GET: { resource: RESOURCES.users, action: ACTIONS.delete },
  },
  '/api/cleanup-all-admins': {
    POST: { resource: RESOURCES.users, action: ACTIONS.delete },
  },

  // 老师入库
  '/api/teacher-entries': {
    POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.interview },
  },
  '/api/teacher-entries/confirm': {
    POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.confirmEntry },
  },
  '/api/teacher-entries/register-classin': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },

  // ClassIn 本地镜像与 SDK 操作
  '/api/classin/login': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin/classes': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.notes },
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin/students': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin/teachers': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin/classrooms': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.notes },
    PUT: { resource: RESOURCES.teachers, action: ACTIONS.notes },
    DELETE: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin/classrooms/test': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.notes },
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/course': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/unit': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/classroom': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/complete': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/register/student': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/register/teacher': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/classin-sdk/diagnostics': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.notes },
  },
  '/api/sync/students': {
    POST: { resource: RESOURCES.students, action: ACTIONS.edit },
  },
  '/api/sync/teachers': {
    POST: { resource: RESOURCES.teachers, action: ACTIONS.edit },
  },
  '/api/sync/classes': {
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.edit },
  },
  '/api/sync/classrooms': {
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.edit },
  },
  '/api/schedule/batch/create-classin': {
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.create },
  },
  '/api/schedule/batch/precheck': {
    POST: { resource: RESOURCES.classSessions, action: ACTIONS.create },
  },
} as const

function routePatternMatches(routePath: string, requestPath: string): boolean {
  const routeSegments = routePath.split('/').filter(Boolean)
  const requestSegments = requestPath.split('/').filter(Boolean)

  if (routeSegments.length !== requestSegments.length) return false

  return routeSegments.every((segment, index) => {
    return /^\[[^\]]+\]$/.test(segment) || segment === requestSegments[index]
  })
}

/**
 * 获取路由的权限要求
 */
export function getRoutePermission(path: string, method: string) {
  // 1. 先精确匹配
  if (path in ROUTE_PERMISSIONS) {
    const routePermissions = ROUTE_PERMISSIONS[path as keyof typeof ROUTE_PERMISSIONS]
    const methodPermissions = routePermissions[method as keyof typeof routePermissions]
    if (methodPermissions) {
      return methodPermissions
    }
  }

  // 2. 动态段匹配，例如 /api/leads/[id] -> /api/leads/123
  const sortedPaths = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)

  for (const routePath of sortedPaths) {
    if (routePatternMatches(routePath, path)) {
      const routeConfig = ROUTE_PERMISSIONS[routePath as keyof typeof ROUTE_PERMISSIONS]
      const methodConfig = routeConfig[method as keyof typeof routeConfig]
      if (methodConfig) {
        return methodConfig
      }
    }
  }

  return null
}

/**
 * 跳过权限检查的路径
 */
export const PUBLIC_PATHS = [
  '/api/health',
  '/api/init-admin', // 启动专用接口，生产需 ENABLE_INIT_ADMIN_API=true 且强制校验 INIT_ADMIN_SECRET
  '/api/classin/callback', // ClassIn 回调用 SafeKey 校验
]

export const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/teacher-form', // 外部老师二维码信息采集
]

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path) ||
    PUBLIC_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}
