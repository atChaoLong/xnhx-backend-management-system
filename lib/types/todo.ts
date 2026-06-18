/**
 * 待办事项类型定义
 */

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TodoStatus = 'pending' | 'completed' | 'cancelled'
export type TodoEntityType = 'lead' | 'student' | 'trial_lesson' | 'formal_order' | null
export type TodoSlaStatus = 'normal' | 'due_today' | 'overdue' | 'completed' | 'cancelled' | 'no_due_date'
export type TodoEscalationLevel = 'none' | 'watch' | 'urgent' | 'critical'

export interface TodoStats {
  total: number
  pending: number
  completed: number
  cancelled: number
  due_today: number
  overdue: number
  urgent_pending: number
  urgent_overdue: number
  escalation_watch: number
  escalation_urgent: number
  escalation_critical: number
  escalated_total: number
}

export interface Todo {
  id: string
  created_at: string
  updated_at: string
  created_by: string
  completed_at: string | null
  assigned_to: string
  assigned_by: string
  title: string
  description: string | null
  priority: TodoPriority
  entity_type: TodoEntityType
  entity_id: string | null
  status: TodoStatus
  due_date: string | null
  metadata: Record<string, any> | null
  is_auto_created: boolean
  auto_trigger_type: string | null
  sla_status?: TodoSlaStatus
  sla_status_name?: string
  is_overdue?: boolean
  days_overdue?: number
  escalation_level?: TodoEscalationLevel
  escalation_level_name?: string
  escalation_reason?: string | null

  // 关联数据（查询时join）
  assigned_to_name?: string
  created_by_name?: string
  entity_info?: any
}

export interface CreateTodoRequest {
  assigned_to: string
  title: string
  description?: string
  priority?: TodoPriority
  entity_type?: TodoEntityType
  entity_id?: string
  due_date?: string
  metadata?: Record<string, any>
}

export interface UpdateTodoRequest {
  title?: string
  description?: string
  priority?: TodoPriority
  status?: TodoStatus
  due_date?: string
}

export interface TodoFilters {
  status?: TodoStatus
  priority?: TodoPriority
}
