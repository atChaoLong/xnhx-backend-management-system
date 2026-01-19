/**
 * 学生服务层
 * 提供学生 CRUD 操作的统一接口
 * 字段命名与在线 Supabase 数据库保持一致
 */

import { api } from '@/lib/fetch'

/**
 * 生成学生学号
 * 格式: S + YYYYMMDDHHmm + RRRR (17位)
 * 示例: S2025102711401160
 */
export function generateStudentCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  return `S${year}${month}${day}${hour}${minute}${random}`
}

/**
 * 学生类型定义
 */
export interface Student {
  id: string
  created_at: string
  updated_at: string
  student_code?: string
  student_name: string
  grade_code?: string
  region?: string
  school?: string
  status?: string
  parent_phone?: string
  head_teacher_id?: string
  head_teacher_name?: string  // 班主任姓名（关联查询）
  classin_initial_password?: string
  classin_uid?: number
}

/**
 * 新建学生类型（不包含 id, created_at, updated_at）
 */
export interface NewStudent {
  student_code?: string
  student_name: string
  parent_phone?: string
  status?: string
  classin_initial_password?: string
  grade_code?: string
  region?: string
  school?: string
  head_teacher_id?: string
}

/**
 * 获取学生列表（支持分页）
 */
export async function getStudents(from: number = 0, to: number = 19): Promise<{ data: Student[], count: number }> {
  const response = await api.get(`/api/students?from=${from}&to=${to}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取学生列表失败' }))
    throw new Error(error.error || '获取学生列表失败')
  }

  const result = await response.json()
  return { data: result.data as Student[], count: result.count || 0 }
}

/**
 * 获取所有学生（不带分页，用于兼容旧代码）
 */
export async function getAllStudents(): Promise<Student[]> {
  const response = await api.get("/api/students")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取学生列表失败' }))
    throw new Error(error.error || '获取学生列表失败')
  }

  const { data } = await response.json()
  return data as Student[]
}

/**
 * 根据ID获取单个学生
 */
export async function getStudentById(id: string): Promise<Student> {
  const response = await api.get(`/api/students?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取学生失败' }))
    throw new Error(error.error || '获取学生失败')
  }

  const { data } = await response.json()
  return data as Student
}

/**
 * 创建新学生
 */
export async function createStudent(student: NewStudent): Promise<Student> {
  const response = await api.post("/api/students", student)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建学生失败' }))
    throw new Error(error.error || '创建学生失败')
  }

  const { data } = await response.json()
  return data as Student
}

/**
 * 更新学生信息
 */
export async function updateStudent(student: Student & { id?: string }): Promise<Student> {
  const { id, ...updateData } = student

  if (!id) {
    throw new Error('学生ID不能为空')
  }

  const response = await api.put("/api/students", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新学生失败' }))
    throw new Error(error.error || '更新学生失败')
  }

  const { data } = await response.json()
  return data as Student
}

/**
 * 删除学生
 */
export async function deleteStudent(id: string): Promise<boolean> {
  const response = await api.delete(`/api/students?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除学生失败' }))
    throw new Error(error.error || '删除学生失败')
  }

  return true
}

/**
 * 学生服务对象
 */
export const StudentsService = {
  getStudents,
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  generateStudentCode,
}
