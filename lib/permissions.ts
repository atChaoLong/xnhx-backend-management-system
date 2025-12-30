/**
 * 权限管理系统
 * 基于角色的访问控制 (RBAC)
 */

// 角色定义
export const ROLES = {
  admin: 'admin',                    // 超级管理员
  operator: 'operator',              // 运营人员
  sales: 'sales',                    // 销售顾问
  head_teacher: 'head_teacher',      // 班主任
  teacher: 'teacher',                // 教师
  academic_affairs: 'academic_affairs', // 教务
  finance: 'finance',                // 财务
  hr: 'hr',                          // 人事
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// 资源定义
export const RESOURCES = {
  leads: 'leads',                    // 线索
  trialLessons: 'trialLessons',      // 试听
  students: 'students',              // 学生
  formalOrders: 'formalOrders',      // 正式订单
  transactions: 'transactions',      // 课程异动
  teacherCandidates: 'teacherCandidates', // 老师面试
  teachers: 'teachers',              // 老师库
  dictionaries: 'dictionaries',      // 字典管理
  users: 'users',                    // 用户管理
} as const

export type Resource = typeof RESOURCES[keyof typeof RESOURCES]

// 操作定义
export const ACTIONS = {
  view: 'view',                      // 查看
  create: 'create',                  // 创建
  edit: 'edit',                      // 编辑
  delete: 'delete',                  // 删除
  feedback: 'feedback',              // 反馈
  matchTeacher: 'matchTeacher',      // 匹配老师
  confirmTeacher: 'confirmTeacher',  // 确认老师
  confirmTime: 'confirmTime',        // 确定时间
  addLink: 'addLink',                // 上课链接
  convert: 'convert',                // 转化
  schedule: 'schedule',              // 排课
  manageHours: 'manageHours',        // 课时管理
  visit: 'visit',                    // 回访
  verifyHours: 'verifyHours',        // 核对课时
  payment: 'payment',                // 打款
  verifyPerformance: 'verifyPerformance', // 核对业绩
  interview: 'interview',            // 约面
  evaluate: 'evaluate',              // 评价
  uploadVideo: 'uploadVideo',        // 录像上传
  reviewVideo: 'reviewVideo',        // 录像复核
  notes: 'notes',                    // 备注
} as const

export type Action = typeof ACTIONS[keyof typeof ACTIONS]

// 权限矩阵
const PERMISSION_MATRIX: Record<Role, Record<Resource, Action[]>> = {
  // 超级管理员：所有权限
  admin: {
    leads: ['view', 'create', 'edit', 'delete', 'feedback'],
    trialLessons: ['view', 'create', 'edit', 'delete', 'matchTeacher', 'confirmTeacher', 'confirmTime', 'addLink', 'convert'],
    students: ['view', 'create', 'edit', 'delete', 'schedule', 'manageHours', 'visit'],
    formalOrders: ['view', 'create', 'edit', 'delete'],
    transactions: ['view', 'create', 'verifyHours', 'payment', 'verifyPerformance'],
    teacherCandidates: ['view', 'interview', 'evaluate', 'uploadVideo', 'reviewVideo'],
    teachers: ['view', 'create', 'edit', 'delete', 'notes'],
    dictionaries: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete'],
  },

  // 运营人员：线索管理
  operator: {
    leads: ['view', 'create', 'edit', 'delete'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    transactions: ['view'],
    teacherCandidates: ['view'],
    teachers: ['view'],
    dictionaries: ['view'],
    users: ['view'],
  },

  // 销售顾问：线索跟进、学生管理、订单录入
  sales: {
    leads: ['view', 'edit', 'feedback', 'convert'],
    trialLessons: ['view', 'create', 'edit', 'confirmTime', 'convert'],
    students: ['view', 'create', 'edit'],
    formalOrders: ['view', 'create', 'edit'],
    transactions: ['view'],
    teacherCandidates: ['view'],
    teachers: ['view'],
    dictionaries: ['view'],
    users: ['view'],
  },

  // 班主任：学生管理、排课、回访、续费
  head_teacher: {
    leads: ['view'],
    trialLessons: ['view', 'edit'],
    students: ['view', 'create', 'edit', 'schedule', 'visit'],
    formalOrders: ['view', 'create', 'edit'],
    transactions: ['view', 'create'],
    teacherCandidates: ['view'],
    teachers: ['view'],
    dictionaries: ['view'],
    users: ['view'],
  },

  // 教师：信息录入
  teacher: {
    leads: ['view'],
    trialLessons: ['view', 'edit'],
    students: ['view', 'edit'],
    formalOrders: ['view'],
    transactions: ['view'],
    teacherCandidates: ['view'],
    teachers: ['view', 'create', 'edit'],
    dictionaries: ['view'],
    users: ['view'],
  },

  // 教务：试听老师匹配、课时核对
  academic_affairs: {
    leads: ['view'],
    trialLessons: ['view', 'edit', 'matchTeacher', 'confirmTeacher', 'confirmTime', 'addLink'],
    students: ['view', 'manageHours'],
    formalOrders: ['view'],
    transactions: ['view', 'verifyHours'],
    teacherCandidates: ['view', 'evaluate', 'uploadVideo', 'reviewVideo'],
    teachers: ['view', 'edit', 'notes'],
    dictionaries: ['view'],
    users: ['view'],
  },

  // 财务：财务管理、打款
  finance: {
    leads: ['view'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    transactions: ['view', 'payment'],
    teacherCandidates: ['view'],
    teachers: ['view'],
    dictionaries: ['view'],
    users: ['view'],
  },

  // 人事：招师面试、业绩核对
  hr: {
    leads: ['view'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    transactions: ['view', 'verifyPerformance'],
    teacherCandidates: ['view', 'interview'],
    teachers: ['view'],
    dictionaries: ['view'],
    users: ['view'],
  },
}

/**
 * 检查用户是否有权限
 * @param role 用户角色
 * @param resource 资源
 * @param action 操作
 * @returns 是否有权限
 */
export function hasPermission(role: Role | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false

  // admin 拥有所有权限
  if (role === ROLES.admin) return true

  const rolePermissions = PERMISSION_MATRIX[role]
  if (!rolePermissions) return false

  const resourcePermissions = rolePermissions[resource]
  if (!resourcePermissions) return false

  return resourcePermissions.includes(action)
}

/**
 * 检查用户是否有任意一个权限
 * @param role 用户角色
 * @param permissions 权限列表 [{ resource, action }]
 * @returns 是否有任意一个权限
 */
export function hasAnyPermission(
  role: Role | undefined,
  permissions: Array<{ resource: Resource; action: Action }>
): boolean {
  return permissions.some(({ resource, action }) => hasPermission(role, resource, action))
}

/**
 * 获取用户在指定资源的所有操作权限
 * @param role 用户角色
 * @param resource 资源
 * @returns 操作列表
 */
export function getPermissions(role: Role | undefined, resource: Resource): Action[] {
  if (!role) return []

  if (role === ROLES.admin) {
    // 返回所有可能的操作
    return Object.values(ACTIONS)
  }

  const rolePermissions = PERMISSION_MATRIX[role]
  return rolePermissions?.[resource] || []
}

/**
 * 权限错误类
 */
export class PermissionDeniedError extends Error {
  constructor(resource: Resource, action: Action) {
    super(`权限不足：需要 ${resource} 资源的 ${action} 操作权限`)
    this.name = 'PermissionDeniedError'
  }
}
