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

  // 试听管理
  '/api/trial-lessons': {
    GET: { resource: RESOURCES.trialLessons, action: ACTIONS.view },
    POST: { resource: RESOURCES.trialLessons, action: ACTIONS.create },
    PUT: { resource: RESOURCES.trialLessons, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.trialLessons, action: ACTIONS.delete },
  },

  // 学生管理
  '/api/students': {
    GET: { resource: RESOURCES.students, action: ACTIONS.view },
    POST: { resource: RESOURCES.students, action: ACTIONS.create },
    PUT: { resource: RESOURCES.students, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.students, action: ACTIONS.delete },
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
    PUT: { resource: RESOURCES.transactions, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.transactions, action: ACTIONS.delete },
  },

  // 老师面试
  '/api/teacher-candidates': {
    GET: { resource: RESOURCES.teacherCandidates, action: ACTIONS.view },
    POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.interview },
    PUT: { resource: RESOURCES.teacherCandidates, action: ACTIONS.evaluate },
    DELETE: { resource: RESOURCES.teacherCandidates, action: ACTIONS.delete },
  },

  // 老师库
  '/api/teachers': {
    GET: { resource: RESOURCES.teachers, action: ACTIONS.view },
    POST: { resource: RESOURCES.teachers, action: ACTIONS.create },
    PUT: { resource: RESOURCES.teachers, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.teachers, action: ACTIONS.delete },
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

  // 微信号管理
  '/api/wechat-accounts': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },
} as const

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

  // 2. 前缀匹配（用于动态路由，按路径长度降序排序，避免短路径误匹配）
  const sortedPaths = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)

  for (const routePath of sortedPaths) {
    if (path.startsWith(routePath)) {
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
  '/api/auth',
  '/api/upload',
  '/api/init-admin',
  '/api/cleanup-all-admins',
  '/api/classin',          // ClassIn 集成相关
  '/api/classin-sdk',      // ClassIn SDK 相关
  '/api/sync',             // 第三方同步相关
  '/api/teachers/classin', // 教师ClassIn数据，所有人可查看
]
