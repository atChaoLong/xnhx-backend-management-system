/**
 * 用户管理服务层
 * 提供用户管理的统一接口
 */

import { api } from '@/lib/fetch'

/**
 * 用户档案类型定义
 */
export interface UserProfile {
  id: string              // 主键，直接对应 auth.users.id
  username?: string       // 用户名
  name: string            // 姓名
  role: string            // 用户角色（admin, sales, operations, academic, finance）
  phone?: string          // 手机号
  wechat?: string         // 微信号
  email?: string          // 邮箱
  team_name?: string      // 团队名称（替代 organization）
  is_active: boolean      // 是否启用
  created_at: string
  updated_at: string
}

/**
 * 创建用户类型（包含认证信息和档案信息）
 */
export interface CreateUserRequest {
  email: string          // 登录邮箱
  password: string       // 登录密码
  username?: string      // 用户名
  name?: string          // 姓名
  role: string           // 用户角色（admin, sales, operations, academic, finance）
  phone?: string         // 手机号
  wechat?: string        // 微信号
  team_name?: string     // 团队名称
}

/**
 * 创建用户响应（包含user_id）
 */
export interface CreateUserResponse {
  user_id: string
  profile: UserProfile
}

/**
 * 角色定义
 */
export const ROLES = {
  admin: { code: 'admin', name: '超级管理员', description: '拥有系统所有权限' },
  sales: { code: 'sales', name: '销售顾问', description: '负责线索跟进和转化' },
  operations: { code: 'operations', name: '运营人员', description: '负责日常运营管理' },
  academic: { code: 'academic', name: '教务管理', description: '负责教务安排和教师管理' },
  finance: { code: 'finance', name: '财务人员', description: '负责财务管理' },
} as const

export type RoleCode = keyof typeof ROLES

/**
 * 获取所有用户档案（包含角色信息）
 */
export async function getUsers(): Promise<UserProfile[]> {
  const response = await api.get("/api/users")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取用户列表失败' }))
    throw new Error(error.error || '获取用户列表失败')
  }

  const { data } = await response.json()
  return data as UserProfile[]
}

/**
 * 根据ID获取用户档案
 */
export async function getUserById(id: string): Promise<UserProfile> {
  const response = await api.get(`/api/users?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取用户失败' }))
    throw new Error(error.error || '获取用户失败')
  }

  const { data } = await response.json()
  return data as UserProfile
}

/**
 * 创建新用户（同时创建auth.users和user_profiles）
 */
export async function createUser(user: CreateUserRequest): Promise<CreateUserResponse> {
  const response = await api.post("/api/users", user)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建用户失败' }))
    throw new Error(error.error || '创建用户失败')
  }

  const { data } = await response.json()
  return data as CreateUserResponse
}

/**
 * 更新用户档案信息
 */
export async function updateUser(profile: UserProfile & { user_id?: string }): Promise<UserProfile> {
  const { user_id, ...updateData } = profile

  if (!user_id) {
    throw new Error('用户ID不能为空')
  }

  const response = await api.put("/api/users", { user_id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新用户失败' }))
    throw new Error(error.error || '更新用户失败')
  }

  const { data } = await response.json()
  return data as UserProfile
}

/**
 * 删除用户（同时删除auth.users和user_profiles）
 */
export async function deleteUser(id: string): Promise<boolean> {
  const response = await api.delete(`/api/users?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除用户失败' }))
    throw new Error(error.error || '删除用户失败')
  }

  return true
}

/**
 * 用户管理服务对象
 */
export const UsersService = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
}
