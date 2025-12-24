/**
 * 微信号管理服务层
 * 提供微信号 CRUD 操作的统一接口
 */

import { api } from '@/lib/fetch'

/**
 * 微信号账号类型定义
 */
export interface WechatAccount {
  id: string
  created_at: string
  updated_at: string

  priority: number                // 优先级
  wechat_id: string               // 微信号
  wechat_name: string             // 微信昵称
  responsible_consultant?: string // 负责顾问
  team?: string                   // 所属团队
  account_type: string            // 账号类型
  phone: string                   // 手机号
  login_password: string          // 登录密码
  payment_password: string        // 支付密码
  real_name_person: string        // 实名人
  status: 'active' | 'inactive'   // 状态
}

/**
 * 新建微信号类型（不包含 id, created_at, updated_at）
 */
export type NewWechatAccount = Omit<WechatAccount, 'id' | 'created_at' | 'updated_at'>

/**
 * 获取所有微信号（按优先级降序）
 */
export async function getWechatAccounts(): Promise<WechatAccount[]> {
  const response = await api.get("/api/wechat-accounts")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取微信号列表失败' }))
    throw new Error(error.error || '获取微信号列表失败')
  }

  const { data } = await response.json()
  return data as WechatAccount[]
}

/**
 * 根据ID获取单个微信号
 */
export async function getWechatAccountById(id: string): Promise<WechatAccount> {
  const response = await api.get(`/api/wechat-accounts?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取微信号失败' }))
    throw new Error(error.error || '获取微信号失败')
  }

  const { data } = await response.json()
  return data as WechatAccount
}

/**
 * 创建新微信号
 */
export async function createWechatAccount(account: NewWechatAccount): Promise<WechatAccount> {
  const response = await api.post("/api/wechat-accounts", account)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建微信号失败' }))
    throw new Error(error.error || '创建微信号失败')
  }

  const { data } = await response.json()
  return data as WechatAccount
}

/**
 * 更新微信号信息
 */
export async function updateWechatAccount(account: WechatAccount & { id?: string }): Promise<WechatAccount> {
  const { id, ...updateData } = account

  if (!id) {
    throw new Error('微信号ID不能为空')
  }

  const response = await api.put("/api/wechat-accounts", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新微信号失败' }))
    throw new Error(error.error || '更新微信号失败')
  }

  const { data } = await response.json()
  return data as WechatAccount
}

/**
 * 删除微信号
 */
export async function deleteWechatAccount(id: string): Promise<boolean> {
  const response = await api.delete(`/api/wechat-accounts?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除微信号失败' }))
    throw new Error(error.error || '删除微信号失败')
  }

  return true
}

/**
 * 微信号管理服务对象
 */
export const WechatAccountsService = {
  getWechatAccounts,
  getWechatAccountById,
  createWechatAccount,
  updateWechatAccount,
  deleteWechatAccount,
}
