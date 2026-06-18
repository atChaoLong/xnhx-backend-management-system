import { api } from "@/lib/fetch"

export interface TransactionRecord {
  id: string
  created_at: string
  updated_at: string

  // 基本信息
  student_id?: string
  order_id?: string
  creation_date: string
  course_name?: string
  student_name: string
  teacher_name?: string
  schedule_consumption?: number
  order_type?: string
  original_consultant?: string
  class_teacher?: string
  refund_reason?: string
  transaction_type: string
  remaining_duration?: number
  refund_amount?: number
  bank_card_name?: string
  bank_card_number?: string
  bank_name?: string
  bank_branch?: string
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  academic_verified_at?: string
  academic_verified_by?: string
  paid_at?: string
  paid_by?: string
  performance_verified_at?: string
  performance_verified_by?: string
  refund_status?: string
  refund_status_name?: string
  unit_price?: number
  workflow_events?: TransactionWorkflowEvent[]
}

export interface TransactionWorkflowEvent {
  id: string
  transaction_id: string
  created_at: string
  action: 'submitted' | 'verify_amount' | 'mark_paid' | 'verify_performance' | 'reject' | 'status_change'
  from_status?: string | null
  to_status?: string | null
  actor_id?: string | null
  actor_name?: string | null
  actor_role?: string | null
  note?: string | null
}

export interface TransactionStatusSummary {
  status: TransactionRecord['status']
  count: number
  amount: number
}

export interface TransactionStats {
  total_count: number
  total_amount: number
  by_status: Record<TransactionRecord['status'], TransactionStatusSummary>
}

export interface NewTransactionRecord {
  student_id?: string
  order_id?: string
  creation_date: string
  course_name?: string
  student_name: string
  teacher_name?: string
  schedule_consumption?: number
  order_type?: string
  original_consultant?: string
  class_teacher?: string
  refund_reason?: string
  transaction_type: string
  remaining_duration?: number
  refund_amount?: number
  bank_card_name?: string
  bank_card_number?: string
  bank_name?: string
  bank_branch?: string
  status?: 'pending' | 'processing' | 'completed' | 'rejected'
  unit_price?: number
}

export type TransactionWorkflowAction = 'verify_amount' | 'mark_paid' | 'verify_performance' | 'reject'

/**
 * 获取异动记录列表（支持分页）
 */
export async function getTransactionRecords(from: number = 0, to: number = 19): Promise<{ data: TransactionRecord[], count: number }> {
  const response = await api.get(`/api/transactions?from=${from}&to=${to}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取异动记录列表失败' }))
    throw new Error(error.error || '获取异动记录列表失败')
  }

  const result = await response.json()
  return { data: result.data as TransactionRecord[], count: result.count || 0 }
}

/**
 * 获取异动状态统计
 */
export async function getTransactionStats(): Promise<TransactionStats> {
  const response = await api.get("/api/transactions?stats=true")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取异动统计失败' }))
    throw new Error(error.error || '获取异动统计失败')
  }

  const { data } = await response.json()
  return data as TransactionStats
}

/**
 * 获取所有异动记录（不带分页，用于兼容旧代码）
 */
export async function getAllTransactionRecords(): Promise<TransactionRecord[]> {
  const response = await api.get("/api/transactions")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取异动记录列表失败' }))
    throw new Error(error.error || '获取异动记录列表失败')
  }

  const { data } = await response.json()
  return data as TransactionRecord[]
}

/**
 * 根据ID获取异动记录
 */
export async function getTransactionRecordById(id: string): Promise<TransactionRecord> {
  const response = await api.get(`/api/transactions?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取异动记录失败' }))
    throw new Error(error.error || '获取异动记录失败')
  }

  const { data } = await response.json()
  return data as TransactionRecord
}

/**
 * 创建异动记录
 */
export async function createTransactionRecord(record: NewTransactionRecord): Promise<TransactionRecord> {
  const response = await api.post("/api/transactions", record)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建异动记录失败' }))
    throw new Error(error.error || '创建异动记录失败')
  }

  const { data } = await response.json()
  return data as TransactionRecord
}

/**
 * 更新异动记录
 */
export async function updateTransactionRecord(record: Partial<TransactionRecord> & { id: string }): Promise<TransactionRecord> {
  const { id, ...updateData } = record

  if (!id) {
    throw new Error('异动记录ID不能为空')
  }

  const response = await api.put("/api/transactions", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新异动记录失败' }))
    throw new Error(error.error || '更新异动记录失败')
  }

  const { data } = await response.json()
  return data as TransactionRecord
}

/**
 * 推进异动流程
 */
export async function advanceTransactionWorkflow(id: string, workflowAction: TransactionWorkflowAction): Promise<TransactionRecord> {
  if (!id) {
    throw new Error('异动记录ID不能为空')
  }

  const response = await api.put("/api/transactions", { id, workflow_action: workflowAction })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新异动流程失败' }))
    throw new Error(error.error || '更新异动流程失败')
  }

  const { data } = await response.json()
  return data as TransactionRecord
}

/**
 * 删除异动记录
 */
export async function deleteTransactionRecord(id: string): Promise<boolean> {
  const response = await api.delete(`/api/transactions?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除异动记录失败' }))
    throw new Error(error.error || '删除异动记录失败')
  }

  return true
}

// Service object for compatibility
export const TransactionsService = {
  getTransactionRecords,
  getAllTransactionRecords,
  getTransactionStats,
  getTransactionRecordById,
  createTransactionRecord,
  updateTransactionRecord,
  advanceTransactionWorkflow,
  deleteTransactionRecord,
  // 向后兼容的方法名
  getTransactions: getTransactionRecords,
  getAllTransactions: getAllTransactionRecords,
  getStats: getTransactionStats,
  getTransactionById: getTransactionRecordById,
  createTransaction: createTransactionRecord,
  updateTransaction: updateTransactionRecord,
  advanceWorkflow: advanceTransactionWorkflow,
  deleteTransaction: deleteTransactionRecord,
}
