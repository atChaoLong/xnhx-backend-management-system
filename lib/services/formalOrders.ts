import { api } from "@/lib/fetch"

export interface FormalOrder {
  id: string
  created_at: string
  updated_at: string

  // 关联字段
  student_id: string
  lead_id?: string
  trial_lesson_id?: string
  previous_order_id?: string

  // 学生信息（关联查询）
  students?: {
    student_name: string
  }
  student_name?: string

  // 订单基本信息
  order_number: string
  order_type: string
  consultant_teacher: string
  order_notes?: string

  // 课程安排
  teacher_names: string[]
  subjects: string[]
  total_sessions: number
  session_duration: number
  fixed_mode: string
  frequency: string
  official_start_time: string
  first_class_time: string

  // 费用信息
  total_hours: number
  payment_channel: string
  payment_amount: number
  hourly_rate: number
  payment_proof: string | null
  payment_time: string

  // 状态管理
  status: string
  computed_status?: string
  computed_status_label?: string
}

export interface NewFormalOrder {
  // 关联字段
  student_id: string
  lead_id?: string
  trial_lesson_id?: string
  previous_order_id?: string

  // 订单基本信息
  order_number?: string
  order_type: string
  consultant_teacher: string
  order_notes?: string

  // 课程安排
  teacher_names: string[]
  subjects: string[]

  // 费用信息
  total_hours: number
  payment_channel: string
  payment_amount: number
  hourly_rate: number
  payment_proof: string
  payment_time: string

  // 状态管理
  status?: string
}

/**
 * 生成订单号
 * 格式: L + YYYYMMDDHHmm + RRRR (17位)
 * 示例: L2025102711401160
 */
export function generateOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  return `L${year}${month}${day}${hour}${minute}${random}`
}

/**
 * 获取所有正式订单（支持分页）
 */
export async function getFormalOrders(from: number = 0, to: number = 19): Promise<{ data: FormalOrder[], count: number }> {
  const response = await api.get(`/api/formal-orders?from=${from}&to=${to}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取正式订单列表失败' }))
    throw new Error(error.error || '获取正式订单列表失败')
  }

  const result = await response.json()
  return { data: result.data as FormalOrder[], count: result.count || 0 }
}

/**
 * 获取所有正式订单（不带分页，用于兼容旧代码）
 */
export async function getAllFormalOrders(): Promise<FormalOrder[]> {
  const response = await api.get("/api/formal-orders")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取正式订单列表失败' }))
    throw new Error(error.error || '获取正式订单列表失败')
  }

  const { data } = await response.json()
  return data as FormalOrder[]
}

/**
 * 根据ID获取正式订单
 */
export async function getFormalOrderById(id: string): Promise<FormalOrder> {
  const response = await api.get(`/api/formal-orders?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取正式订单失败' }))
    throw new Error(error.error || '获取正式订单失败')
  }

  const { data } = await response.json()
  return data as FormalOrder
}

/**
 * 创建正式订单
 */
export async function createFormalOrder(order: NewFormalOrder): Promise<FormalOrder> {
  const response = await api.post("/api/formal-orders", order)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建正式订单失败' }))
    throw new Error(error.error || '创建正式订单失败')
  }

  const { data } = await response.json()
  return data as FormalOrder
}

/**
 * 更新正式订单
 */
export async function updateFormalOrder(order: Partial<FormalOrder> & { id: string }): Promise<FormalOrder> {
  const { id, ...updateData } = order

  if (!id) {
    throw new Error('正式订单ID不能为空')
  }

  const response = await api.put("/api/formal-orders", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新正式订单失败' }))
    throw new Error(error.error || '更新正式订单失败')
  }

  const { data } = await response.json()
  return data as FormalOrder
}

/**
 * 删除正式订单
 */
export async function deleteFormalOrder(id: string): Promise<boolean> {
  const response = await api.delete(`/api/formal-orders?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除正式订单失败' }))
    throw new Error(error.error || '删除正式订单失败')
  }

  return true
}

// Service object for compatibility
export const FormalOrdersService = {
  getFormalOrders,
  getAllFormalOrders,
  getFormalOrderById,
  createFormalOrder,
  updateFormalOrder,
  deleteFormalOrder,
}
