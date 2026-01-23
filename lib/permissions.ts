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
  classSessions: 'classSessions',    // 课节
  courses: 'courses',                // 课程
  transactions: 'transactions',      // 课程异动
  teacherCandidates: 'teacherCandidates', // 老师面试
  teachers: 'teachers',              // 老师库
  dictionaries: 'dictionaries',      // 字典管理
  users: 'users',                    // 用户管理
  todos: 'todos',                    // 待办事项
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
  assign: 'assign',                  // 分配（抢单/释放）
} as const

export type Action = typeof ACTIONS[keyof typeof ACTIONS]

// 权限矩阵
const PERMISSION_MATRIX: Record<Role, Record<Resource, Action[]>> = {
  // 超级管理员：只保留管理和查看权限，不参与日常业务操作
  admin: {
    leads: ['view', 'create', 'edit', 'delete'], // 移除 feedback - 管理员不直接反馈线索
    trialLessons: ['view', 'edit', 'delete'], // 移除 create, convert - 管理员不创建试听
    students: ['view', 'create', 'edit', 'delete'], // 保留学生管理
    formalOrders: ['view', 'create', 'edit', 'delete'], // 保留订单管理
    classSessions: ['view', 'create', 'edit', 'delete'], // 课节管理
    courses: ['view', 'create', 'edit', 'delete'], // 课程管理
    transactions: ['view', 'create', 'verifyHours', 'payment', 'verifyPerformance'],
    teacherCandidates: ['view', 'interview', 'evaluate', 'uploadVideo', 'reviewVideo'],
    teachers: ['view', 'create', 'edit', 'delete', 'notes'],
    dictionaries: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete'],
    todos: ['view', 'create', 'edit', 'delete'], // 待办管理
  },

  // 运营人员：线索管理
  operator: {
    leads: ['view', 'create', 'edit', 'delete'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view'],
    teacherCandidates: ['view'],
    teachers: ['view', 'create'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    todos: ['view', 'create'], // 可以查看和创建待办（分配给销售）
  },

  // 销售顾问：线索跟进、学生管理、订单录入
  sales: {
    leads: ['view', 'feedback', 'convert', 'assign'], // 授予分配权限（抢单/释放），不授予 edit
    trialLessons: ['view', 'create', 'edit', 'matchTeacher', 'confirmTeacher', 'confirmTime', 'addLink', 'convert'], // 添加 confirmTeacher, addLink - 销售可以确认老师和开课
    students: ['view', 'create', 'edit'],
    formalOrders: ['view', 'create', 'edit', 'addLink'], // 添加 addLink - 销售可以为正式订单开课
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view'],
    teacherCandidates: ['view'],
    teachers: ['view', 'create'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    todos: ['view', 'edit'], // 可以查看和编辑（标记完成）待办
  },

  // 班主任：学生管理、排课、回访、续费
  head_teacher: {
    leads: ['view', 'convert'], // 添加 convert - 班主任可以创建试听
    trialLessons: ['view', 'edit'],
    students: ['view', 'create', 'edit', 'schedule', 'visit'],
    formalOrders: ['view', 'create', 'edit'],
    classSessions: ['view', 'create', 'edit', 'delete'], // 课节管理
    courses: ['view', 'create', 'edit'], // 课程管理
    transactions: ['view', 'create'],
    teacherCandidates: ['view'],
    teachers: ['view'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
  },

  // 教师：信息录入
  teacher: {
    leads: ['view'],
    trialLessons: ['view', 'edit'],
    students: ['view', 'edit'],
    formalOrders: ['view'],
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view'],
    teacherCandidates: ['view'],
    teachers: ['view', 'create', 'edit'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
  },

  // 教务：全部权限
  academic_affairs: {
    leads: ['view', 'create', 'edit', 'delete'],
    trialLessons: ['view', 'create', 'edit', 'delete', 'matchTeacher', 'confirmTeacher', 'confirmTime', 'addLink', 'convert'],
    students: ['view', 'create', 'edit', 'delete'],
    formalOrders: ['view', 'create', 'edit', 'delete', 'addLink'],
    classSessions: ['view', 'create', 'edit', 'delete'],
    courses: ['view', 'create', 'edit', 'delete'],
    transactions: ['view', 'create', 'verifyHours', 'payment', 'verifyPerformance'],
    teacherCandidates: ['view', 'interview', 'evaluate', 'uploadVideo', 'reviewVideo'],
    teachers: ['view', 'create', 'edit', 'delete', 'notes'],
    dictionaries: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete'],
    todos: ['view', 'create', 'edit', 'delete'],
  },

  // 财务：财务管理、打款
  finance: {
    leads: ['view'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view', 'payment'],
    teacherCandidates: ['view'],
    teachers: ['view'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
  },

  // 人事：招师面试、业绩核对
  hr: {
    leads: ['view'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view', 'verifyPerformance'],
    teacherCandidates: ['view', 'create', 'edit', 'interview', 'evaluate', 'uploadVideo', 'reviewVideo'],
    teachers: ['view'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
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

  // 所有角色（包括admin）都必须在权限矩阵中明确定义权限
  // admin不再自动拥有所有权限，需要在PERMISSION_MATRIX中明确配置
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

  // 所有角色（包括admin）都从权限矩阵中获取权限
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
