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
  teacher_recruiter: 'teacher_recruiter', // 招师
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
  uploads: 'uploads',                // 通用上传入口
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
  confirmEntry: 'confirmEntry',      // 入库确认
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
    trialLessons: ['view', 'edit', 'delete', 'addLink'], // 移除 create, convert - 管理员不创建试听
    students: ['view', 'create', 'edit', 'delete', 'visit'], // 保留学生管理，含回访
    formalOrders: ['view', 'create', 'edit', 'delete'], // 保留订单管理
    classSessions: ['view', 'create', 'edit', 'delete'], // 课节管理
    courses: ['view', 'create', 'edit', 'delete'], // 课程管理
    transactions: ['view', 'create', 'edit', 'delete', 'verifyHours', 'payment', 'verifyPerformance'],
    teacherCandidates: ['view', 'create', 'interview', 'evaluate', 'confirmEntry', 'uploadVideo', 'reviewVideo', 'delete'],
    teachers: ['view', 'create', 'edit', 'delete', 'notes'],
    dictionaries: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete'],
    todos: ['view', 'create', 'edit', 'delete'], // 待办管理
    uploads: ['create'],
  },

  // 运营人员：线索管理
  operator: {
    leads: ['view', 'create', 'edit'],
    trialLessons: ['view'],
    students: ['view'],
    formalOrders: ['view'],
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view'],
    teacherCandidates: [],
    teachers: ['view', 'create'],
    dictionaries: ['view'],
    users: ['view'],
    todos: ['view', 'create'], // 可以查看和创建待办（分配给销售）
    uploads: ['create'],
  },

  // 销售顾问：线索跟进、学生管理、订单录入
  sales: {
    leads: ['view', 'create', 'edit', 'feedback', 'convert', 'assign'], // 可录入自己的线索，并可编辑/抢单/反馈/转试听
    trialLessons: ['view', 'create', 'edit', 'confirmTime', 'convert'],
    students: ['view', 'create', 'edit'],
    formalOrders: ['view', 'create'], // 可从试听转正式，正式订单列表不允许普通角色随意修改
    classSessions: ['view'],
    courses: ['view'],
    transactions: ['view'],
    teacherCandidates: [],
    teachers: ['view', 'create'],
    dictionaries: ['view'],
    users: ['view'],
    todos: ['view', 'create', 'edit'], // 可查看/完成待办；创建仅允许催促自己负责线索的负责运营
    uploads: ['create'],
  },

  // 班主任：学生管理、排课、回访、续费
  head_teacher: {
    leads: ['view', 'create', 'convert'], // 班主任可以录入自己的线索并创建试听
    trialLessons: ['view', 'edit'],
    students: ['view', 'create', 'edit', 'schedule', 'visit'],
    formalOrders: ['view', 'create'],
    classSessions: ['view', 'create', 'edit'], // 课节管理
    courses: ['view', 'create', 'edit'], // 课程管理
    transactions: ['view', 'create'],
    teacherCandidates: [],
    teachers: ['view'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    uploads: ['create'],
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
    teacherCandidates: [],
    teachers: ['view', 'create', 'edit'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    uploads: ['create'],
  },

  // 教务：教学、排课与入库流程
  academic_affairs: {
    leads: [],
    trialLessons: ['view', 'edit', 'matchTeacher', 'confirmTeacher', 'confirmTime', 'addLink'],
    students: ['view', 'edit'],
    formalOrders: ['view'],
    classSessions: ['view', 'create', 'edit'],
    courses: ['view', 'edit'],
    transactions: ['view', 'create', 'edit', 'verifyHours', 'payment', 'verifyPerformance'],
    teacherCandidates: ['view', 'evaluate', 'confirmEntry', 'reviewVideo'],
    teachers: ['view', 'edit', 'notes'],
    dictionaries: ['view'],
    users: ['view'],
    todos: ['view', 'create', 'edit'],
    uploads: ['create'],
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
    teacherCandidates: ['view', 'confirmEntry'],
    teachers: ['view'],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    uploads: ['create'],
  },

  // 招师：候选人约面、初试录入、录像上传
  teacher_recruiter: {
    leads: [],
    trialLessons: [],
    students: [],
    formalOrders: [],
    classSessions: [],
    courses: [],
    transactions: [],
    teacherCandidates: ['view', 'create', 'edit', 'interview', 'evaluate', 'uploadVideo'],
    teachers: [],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    uploads: ['create'],
  },

  // 人事：保留人力相关能力，不承载招师流程
  hr: {
    leads: [],
    trialLessons: [],
    students: [],
    formalOrders: [],
    classSessions: [],
    courses: [],
    transactions: ['view', 'verifyPerformance'],
    teacherCandidates: ['view', 'confirmEntry'],
    teachers: [],
    dictionaries: ['view'],
    todos: ["view", "edit"],
    users: ['view'],
    uploads: [],
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
