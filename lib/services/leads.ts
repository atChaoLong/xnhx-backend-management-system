/**
 * 线索服务层
 * 提供线索 CRUD 操作的统一接口
 * 字段命名与在线 Supabase 数据库保持一致
 */

import { api } from '@/lib/fetch'

export interface Lead {
  id: string
  created_at: string
  updated_at: string

  // 必填字段
  report_number: string           // 报单序号
  entry_date: string              // 录单日期
  xhs_source: string              // 小红书账号来源
  add_method_code: string         // 添加方式代码
  operator_id: string             // 运营人员ID
  operator_name?: string          // 运营人员名字

  // 可选字段
  grade_code?: string             // 年级代码（可选）
  channel_platform?: string        // 渠道平台
  customer_social_id?: string      // 客户社媒账号ID
  subject_codes?: string[]        // 学科代码数组
  region_ip?: string              // 地域IP
  parent_wechat?: string          // 家长微信号
  chat_screenshots?: string       // 聊天截图

  // 业务字段
  duplicate_mark?: boolean        // 重复标记
  collision_operator?: string     // 冲突运营人员
  grab_wechat?: string            // 抢单微信号
  grab_user_id?: string           // 抢单用户ID
  add_feedback?: string           // 添加反馈
  feedback_time?: string          // 反馈时间
  add_status?: string             // 添加状态（已添加/未添加）
  conversion_status?: string      // 转化状态

  // 创建人和更新人信息
  created_by?: string             // 创建人姓名
  updated_by?: string             // 最后更新人姓名
}

export interface NewLead {
  report_number?: string
  entry_date: string
  xhs_source: string
  add_method_code: string
  operator_id: string
  grade_code?: string              // 年级代码（可选）
  channel_platform?: string
  customer_social_id?: string
  subject_codes?: string[]
  region_ip?: string
  parent_wechat?: string
  chat_screenshots?: string
  duplicate_mark?: boolean
  collision_operator?: string
  grab_wechat?: string
  grab_user_id?: string
  add_feedback?: string
  feedback_time?: string
  add_status?: string              // 添加状态（已添加/未添加）
  conversion_status?: string
}

export interface GetLeadsOptions {
  scope?: 'public' | 'owned'
}

export const LeadsService = {
  /**
   * 获取所有线索（支持分页）
   */
  async getLeads(from: number = 0, to: number = 19, options: GetLeadsOptions = {}): Promise<{ data: Lead[], count: number }> {
    const params = new URLSearchParams({
      from: String(from),
      to: String(to),
    })

    if (options.scope) {
      params.set('scope', options.scope)
    }

    const response = await api.get(`/api/leads?${params.toString()}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取线索失败' }))
      throw new Error(error.error || '获取线索失败')
    }

    const result = await response.json()
    return { data: result.data as Lead[], count: result.count || 0 }
  },

  /**
   * 获取所有线索（不带分页，用于兼容旧代码）
   */
  async getAllLeads(): Promise<Lead[]> {
    const response = await api.get('/api/leads')

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取线索失败' }))
      throw new Error(error.error || '获取线索失败')
    }

    const { data } = await response.json()
    return data as Lead[]
  },

  /**
   * 根据ID获取线索
   */
  async getLeadById(id: string): Promise<Lead> {
    const response = await api.get(`/api/leads/${id}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取线索失败' }))
      throw new Error(error.error || '获取线索失败')
    }

    const { data } = await response.json()
    return data as Lead
  },

  /**
   * 创建新线索
   */
  async createLead(lead: NewLead): Promise<Lead> {
    const response = await api.post('/api/leads', lead)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '创建线索失败' }))
      throw new Error(error.error || '创建线索失败')
    }

    const { data } = await response.json()
    return data as Lead
  },

  /**
   * 更新线索
   */
  async updateLead(lead: Partial<Lead> & { id: string }): Promise<Lead> {
    const response = await api.put('/api/leads', lead)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '更新线索失败' }))
      throw new Error(error.error || '更新线索失败')
    }

    const { data } = await response.json()
    return data as Lead
  },

  /**
   * 删除线索
   */
  async deleteLead(id: string): Promise<boolean> {
    const response = await api.delete(`/api/leads/${id}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '删除线索失败' }))
      throw new Error(error.error || '删除线索失败')
    }

    return true
  },
}
