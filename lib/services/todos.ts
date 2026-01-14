/**
 * 待办事项服务层
 */

import { api } from '@/lib/fetch'
import type { Todo, CreateTodoRequest, UpdateTodoRequest, TodoFilters } from '@/lib/types/todo'

export const TodosService = {
  /**
   * 获取待办列表（支持分页）
   */
  async getTodos(from: number = 0, to: number = 19, filters?: TodoFilters): Promise<{ data: Todo[], count: number }> {
    const params = new URLSearchParams({
      from: from.toString(),
      to: to.toString(),
    })

    if (filters?.status) {
      params.append('status', filters.status)
    }
    if (filters?.priority) {
      params.append('priority', filters.priority)
    }

    const response = await api.get(`/api/todos?${params.toString()}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取待办列表失败' }))
      throw new Error(error.error || '获取待办列表失败')
    }
    const result = await response.json()
    return { data: result.data as Todo[], count: result.count || 0 }
  },

  /**
   * 获取所有待办（不分页）
   */
  async getAllTodos(filters?: TodoFilters): Promise<Todo[]> {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.priority) params.append('priority', filters.priority)

    const response = await api.get(`/api/todos?${params.toString()}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取待办列表失败' }))
      throw new Error(error.error || '获取待办列表失败')
    }
    const result = await response.json()
    return result.data as Todo[]
  },

  /**
   * 根据ID获取待办
   */
  async getTodoById(id: string): Promise<Todo> {
    const response = await api.get(`/api/todos?id=${id}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取待办失败' }))
      throw new Error(error.error || '获取待办失败')
    }
    const result = await response.json()
    return result.data as Todo
  },

  /**
   * 创建待办
   */
  async createTodo(todo: CreateTodoRequest): Promise<Todo> {
    const response = await api.post('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todo),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '创建待办失败' }))
      throw new Error(error.error || '创建待办失败')
    }

    const result = await response.json()
    return result.data as Todo
  },

  /**
   * 更新待办
   */
  async updateTodo(id: string, updates: UpdateTodoRequest): Promise<Todo> {
    const response = await api.put('/api/todos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '更新待办失败' }))
      throw new Error(error.error || '更新待办失败')
    }

    const result = await response.json()
    return result.data as Todo
  },

  /**
   * 标记待办为完成
   */
  async completeTodo(id: string): Promise<Todo> {
    const response = await api.post(`/api/todos/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '标记完成失败' }))
      throw new Error(error.error || '标记完成失败')
    }

    const result = await response.json()
    return result.data as Todo
  },

  /**
   * 删除待办
   */
  async deleteTodo(id: string): Promise<void> {
    const response = await api.delete(`/api/todos?id=${id}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '删除待办失败' }))
      throw new Error(error.error || '删除待办失败')
    }
  },

  /**
   * 自动创建待办（内部使用）
   */
  async autoCreateTodo(params: {
    assigned_to: string
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    entity_type?: string
    entity_id?: string
    auto_trigger_type: string
    due_date?: string
    metadata?: Record<string, any>
  }): Promise<Todo> {
    const response = await api.post('/api/todos/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '自动创建待办失败' }))
      throw new Error(error.error || '自动创建待办失败')
    }

    const result = await response.json()
    return result.data as Todo
  },
}
