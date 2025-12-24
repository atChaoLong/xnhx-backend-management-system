/**
 * 每日线索服务层
 * 提供每日线索 CRUD 操作的统一接口
 */

import { api } from '@/lib/fetch'

/**
 * 每日线索类型定义
 */
export interface DailyLead {
  id: string
  created_at: string
  updated_at: string
  name: string                    // 姓名（必填）
  wechat_number: string           // 微信号（必填）
  assigned_person: string         // 归属人员（必填）
  received_date: string           // 领取日期（必填）
  is_added?: boolean              // 是否已添加
  resume_attachment?: string      // 简历附件
  notes?: string                  // 备注
}

/**
 * 新建每日线索类型（不包含 id, created_at, updated_at）
 */
export interface NewDailyLead {
  name: string
  wechat_number: string
  assigned_person: string
  received_date: string
  is_added?: boolean
  resume_attachment?: string
  notes?: string
}

/**
 * 获取所有每日线索
 */
export async function getDailyLeads(): Promise<DailyLead[]> {
  const response = await api.get("/api/daily-leads")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取每日线索列表失败' }))
    throw new Error(error.error || '获取每日线索列表失败')
  }

  const { data } = await response.json()
  return data as DailyLead[]
}

/**
 * 根据ID获取单个每日线索
 */
export async function getDailyLeadById(id: string): Promise<DailyLead> {
  const response = await api.get(`/api/daily-leads?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取每日线索失败' }))
    throw new Error(error.error || '获取每日线索失败')
  }

  const { data } = await response.json()
  return data as DailyLead
}

/**
 * 创建新每日线索
 */
export async function createDailyLead(lead: NewDailyLead): Promise<DailyLead> {
  const response = await api.post("/api/daily-leads", lead)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建每日线索失败' }))
    throw new Error(error.error || '创建每日线索失败')
  }

  const { data } = await response.json()
  return data as DailyLead
}

/**
 * 更新每日线索信息
 */
export async function updateDailyLead(lead: DailyLead & { id?: string }): Promise<DailyLead> {
  const { id, ...updateData } = lead

  if (!id) {
    throw new Error('每日线索ID不能为空')
  }

  const response = await api.put("/api/daily-leads", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新每日线索失败' }))
    throw new Error(error.error || '更新每日线索失败')
  }

  const { data } = await response.json()
  return data as DailyLead
}

/**
 * 删除每日线索
 */
export async function deleteDailyLead(id: string): Promise<boolean> {
  const response = await api.delete(`/api/daily-leads?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除每日线索失败' }))
    throw new Error(error.error || '删除每日线索失败')
  }

  return true
}

/**
 * 每日线索服务对象
 */
export const DailyLeadsService = {
  getDailyLeads,
  getDailyLeadById,
  createDailyLead,
  updateDailyLead,
  deleteDailyLead,
}
