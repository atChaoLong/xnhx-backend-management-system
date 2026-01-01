import { api } from "@/lib/fetch"

export interface TrialLesson {
  id: string
  created_at: string
  updated_at: string

  // 基本信息
  child_name: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  lead_id?: string

  // 课程信息
  region: string
  grade: string
  trial_subject: string
  trial_time: string
  trial_duration: number

  // 联系信息
  phone: string
  channel: string

  // 财务信息
  trial_amount?: number
  payment_proof: string

  // 优先级
  urgency_level?: 'low' | 'medium' | 'high' | 'urgent'

  // 业务信息
  notes?: string
  assigned_consultant?: string
  course_status?: string
  student_type?: string

  // 教务信息
  matched_teacher?: string
  confirmed_teacher?: string

  // ClassIn 集成
  classin_course_id?: number
  classin_class_id?: number
  classin_unit_id?: number
  classin_activity_id?: number
}

export interface NewTrialLesson {
  // 基本信息
  child_name: string
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  lead_id?: string

  // 课程信息
  region: string
  grade: string
  trial_subject: string
  trial_time: string
  trial_duration: number

  // 联系信息
  phone: string
  channel: string

  // 财务信息
  trial_amount?: number
  payment_proof: string

  // 优先级
  urgency_level?: 'low' | 'medium' | 'high' | 'urgent'

  // 业务信息
  notes?: string
  assigned_consultant?: string
  course_status?: string
  student_type?: string

  // 教务信息
  matched_teacher?: string
  confirmed_teacher?: string
}

/**
 * 获取所有试听课程（支持分页）
 */
export async function getTrialLessons(from: number = 0, to: number = 19): Promise<{ data: TrialLesson[], count: number }> {
  const response = await api.get(`/api/trial-lessons?from=${from}&to=${to}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取试听课程列表失败' }))
    throw new Error(error.error || '获取试听课程列表失败')
  }

  const result = await response.json()
  return { data: result.data as TrialLesson[], count: result.count || 0 }
}

/**
 * 获取所有试听课程（不带分页，用于兼容旧代码）
 */
export async function getAllTrialLessons(): Promise<TrialLesson[]> {
  const response = await api.get("/api/trial-lessons")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取试听课程列表失败' }))
    throw new Error(error.error || '获取试听课程列表失败')
  }

  const { data } = await response.json()
  return data as TrialLesson[]
}

/**
 * 根据ID获取试听课程
 */
export async function getTrialLessonById(id: string): Promise<TrialLesson> {
  const response = await api.get(`/api/trial-lessons?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取试听课程失败' }))
    throw new Error(error.error || '获取试听课程失败')
  }

  const { data } = await response.json()
  return data as TrialLesson
}

/**
 * 创建试听课程
 */
export async function createTrialLesson(lesson: NewTrialLesson): Promise<TrialLesson> {
  const response = await api.post("/api/trial-lessons", lesson)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建试听课程失败' }))
    throw new Error(error.error || '创建试听课程失败')
  }

  const { data } = await response.json()
  return data as TrialLesson
}

/**
 * 更新试听课程
 */
export async function updateTrialLesson(lesson: Partial<TrialLesson> & { id: string }): Promise<TrialLesson> {
  const { id, ...updateData } = lesson

  if (!id) {
    throw new Error('试听课程ID不能为空')
  }

  const response = await api.put("/api/trial-lessons", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新试听课程失败' }))
    throw new Error(error.error || '更新试听课程失败')
  }

  const { data } = await response.json()
  return data as TrialLesson
}

/**
 * 删除试听课程
 */
export async function deleteTrialLesson(id: string): Promise<boolean> {
  const response = await api.delete(`/api/trial-lessons?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除试听课程失败' }))
    throw new Error(error.error || '删除试听课程失败')
  }

  return true
}

// Service object for compatibility
export const TrialLessonsService = {
  getTrialLessons,
  getTrialLessonById,
  createTrialLesson,
  updateTrialLesson,
  deleteTrialLesson,
}
