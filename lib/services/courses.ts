import { api } from "@/lib/fetch"
import type { Course, NewCourse, UpdateCourse, ClassSession, NewClassSession, UpdateClassSession } from "@/lib/types"

/**
 * 课程消耗信息接口
 */
export interface CourseConsumptionInfo {
  totalSessions: number           // 总课时数（来自 class_classin.total_class_num）
  completedSessions: number       // 已完成课时数（来自 class_classin.complete_class_num）
  progress: number                // 进度百分比（0-100）
  totalHours?: number             // 总小时数（来自订单）
  actualHours?: number            // 实际上课小时数（从 classroom_classin 统计）
  lastSyncTime?: string           // 最后同步时间
}

/**
 * 获取课程列表（支持分页和按学生筛选）
 */
export async function getCourses(from: number = 0, to: number = 19, studentId?: string): Promise<{ data: Course[], count: number }> {
  const url = studentId
    ? `/api/courses?from=${from}&to=${to}&student_id=${studentId}`
    : `/api/courses?from=${from}&to=${to}`

  const response = await api.get(url)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取课程列表失败' }))
    throw new Error(error.error || '获取课程列表失败')
  }

  const result = await response.json()
  return { data: result.data as Course[], count: result.count || 0 }
}

/**
 * 根据学生ID获取课程列表
 */
export async function getCoursesByStudentId(studentId: string): Promise<Course[]> {
  const response = await api.get(`/api/courses?student_id=${studentId}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取学生课程失败' }))
    throw new Error(error.error || '获取学生课程失败')
  }

  const { data } = await response.json()
  return data as Course[]
}

/**
 * 根据订单ID获取课程（一对一关系）
 */
export async function getCourseByOrderId(orderId: string): Promise<Course | null> {
  const response = await api.get(`/api/courses/by-order/${orderId}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取课程失败' }))
    throw new Error(error.error || '获取课程失败')
  }

  const { data } = await response.json()
  return data as Course
}

/**
 * 根据ID获取课程
 */
export async function getCourseById(id: string): Promise<Course> {
  const response = await api.get(`/api/courses?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取课程失败' }))
    throw new Error(error.error || '获取课程失败')
  }

  const { data } = await response.json()
  return data as Course
}

/**
 * 创建课程
 */
export async function createCourse(course: NewCourse): Promise<Course> {
  const response = await api.post("/api/courses", course)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建课程失败' }))
    throw new Error(error.error || '创建课程失败')
  }

  const { data } = await response.json()
  return data as Course
}

/**
 * 更新课程
 */
export async function updateCourse(course: UpdateCourse): Promise<Course> {
  const { id, ...updateData } = course

  if (!id) {
    throw new Error('课程ID不能为空')
  }

  const response = await api.put("/api/courses", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新课程失败' }))
    throw new Error(error.error || '更新课程失败')
  }

  const { data } = await response.json()
  return data as Course
}

/**
 * 删除课程
 */
export async function deleteCourse(id: string): Promise<boolean> {
  const response = await api.delete(`/api/courses?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除课程失败' }))
    throw new Error(error.error || '删除课程失败')
  }

  return true
}

/**
 * 关联 ClassIn 课程
 * 将 ClassIn 课程ID关联到本地课程
 */
export async function linkClassInCourse(orderId: string, classinCourseId: number): Promise<Course> {
  const response = await api.post("/api/courses/link-classin", {
    orderId,
    classinCourseId,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '关联 ClassIn 课程失败' }))
    throw new Error(error.error || '关联 ClassIn 课程失败')
  }

  const { data } = await response.json()
  return data as Course
}

// ============================================
// 课时相关方法
// ============================================

/**
 * 获取课程的所有课时
 */
export async function getClassSessions(courseId: string): Promise<ClassSession[]> {
  const response = await api.get(`/api/courses/${courseId}/sessions`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取课时列表失败' }))
    throw new Error(error.error || '获取课时列表失败')
  }

  const { data } = await response.json()
  return data as ClassSession[]
}

/**
 * 创建课时
 */
export async function createClassSession(session: NewClassSession): Promise<ClassSession> {
  const response = await api.post("/api/class-sessions", session)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建课时失败' }))
    throw new Error(error.error || '创建课时失败')
  }

  const { data } = await response.json()
  return data as ClassSession
}

/**
 * 批量创建课时
 */
export async function createClassSessions(sessions: NewClassSession[]): Promise<ClassSession[]> {
  const response = await api.post("/api/class-sessions/batch", { sessions })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '批量创建课时失败' }))
    throw new Error(error.error || '批量创建课时失败')
  }

  const { data } = await response.json()
  return data as ClassSession[]
}

/**
 * 更新课时
 */
export async function updateClassSession(session: UpdateClassSession): Promise<ClassSession> {
  const { id, ...updateData } = session

  if (!id) {
    throw new Error('课时ID不能为空')
  }

  const response = await api.put("/api/class-sessions", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新课时失败' }))
    throw new Error(error.error || '更新课时失败')
  }

  const { data } = await response.json()
  return data as ClassSession
}

/**
 * 删除课时
 */
export async function deleteClassSession(id: string): Promise<boolean> {
  const response = await api.delete(`/api/class-sessions?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除课时失败' }))
    throw new Error(error.error || '删除课时失败')
  }

  return true
}

/**
 * 同步课程统计信息（从 class_classin）
 */
export async function syncCourseStats(courseId: string): Promise<Course> {
  const response = await api.post(`/api/courses/${courseId}/sync-stats`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '同步课程统计失败' }))
    throw new Error(error.error || '同步课程统计失败')
  }

  const { data } = await response.json()
  return data as Course
}

/**
 * 计算课程实际消耗（基于 classroom_classin）
 */
export async function calculateCourseConsumption(courseId: string): Promise<CourseConsumptionInfo> {
  const response = await api.get(`/api/courses/${courseId}/consumption`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '计算课程消耗失败' }))
    throw new Error(error.error || '计算课程消耗失败')
  }

  const { data } = await response.json()
  return data as CourseConsumptionInfo
}

// Service objects for compatibility
export const CourseService = {
  getCourses,
  getCoursesByStudentId,
  getCourseByOrderId,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  linkClassInCourse,
  syncCourseStats,
  calculateCourseConsumption,
}

export const ClassSessionService = {
  getClassSessions,
  createClassSession,
  createClassSessions,
  updateClassSession,
  deleteClassSession,
}
