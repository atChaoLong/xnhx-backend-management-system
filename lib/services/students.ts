/**
 * 学生服务层
 * 提供学生 CRUD 操作的统一接口
 * 字段命名与在线 Supabase 数据库保持一致
 */

import { api } from '@/lib/fetch'

/**
 * 学生类型定义
 */
export interface Student {
  id: string
  created_at: string
  updated_at: string
  student_number?: string        // 学生学号
  student_name: string           // 学生姓名（必填）
  grade_code?: string            // 年级代码
  region?: string                // 地域
  school?: string                // 学校
  parent_phone?: string          // 家长电话
  head_teacher_id?: string       // 班主任ID
  status?: string                // 状态
  classin_uid?: number           // ClassIn 学生 UID
}

/**
 * 新建学生类型（不包含 id, created_at, updated_at）
 */
export interface NewStudent {
  student_number?: string
  student_name: string
  grade_code?: string
  region?: string
  school?: string
  parent_phone?: string
  head_teacher_id?: string
  status?: string
}

/**
 * 获取所有学生
 */
export async function getStudents(): Promise<Student[]> {
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
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
}
