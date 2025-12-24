/**
 * 老师管理服务层
 * 提供老师 CRUD 操作的统一接口
 */

import { api } from '@/lib/fetch'

/**
 * 老师类型定义
 */
export interface Teacher {
  id: string
  created_at: string
  updated_at: string

  // 基本信息
  teacher_name: string
  gender: string
  wechat: string
  classin_phone: string
  location: string

  // 教学信息
  subjects: string[]
  grade_levels: string[]
  used_classin?: boolean
  has_certificate?: boolean

  // 学历背景
  education: string
  university: string

  // 教学能力
  available_times?: string[]
  textbook_versions?: string[]
  student_regions?: string[]
  student_levels?: string[]
  teaching_years?: number

  // 教学经历
  teaching_style?: string
  teaching_experience?: string
  success_cases?: string

  // 附件
  photo_url?: string
  review_screenshots?: string[]

  // 其他
  notes?: string
  bank_card_info?: object
}

/**
 * 新建老师类型（不包含 id, created_at, updated_at）
 */
export type NewTeacher = Omit<Teacher, 'id' | 'created_at' | 'updated_at'>

/**
 * 获取所有老师
 */
export async function getTeachers(): Promise<Teacher[]> {
  const response = await api.get("/api/teachers")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取老师列表失败' }))
    throw new Error(error.error || '获取老师列表失败')
  }

  const { data } = await response.json()
  return data as Teacher[]
}

/**
 * 根据ID获取单个老师
 */
export async function getTeacherById(id: string): Promise<Teacher> {
  const response = await api.get(`/api/teachers?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取老师失败' }))
    throw new Error(error.error || '获取老师失败')
  }

  const { data } = await response.json()
  return data as Teacher
}

/**
 * 创建新老师
 */
export async function createTeacher(teacher: NewTeacher): Promise<Teacher> {
  const response = await api.post("/api/teachers", teacher)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建老师失败' }))
    throw new Error(error.error || '创建老师失败')
  }

  const { data } = await response.json()
  return data as Teacher
}

/**
 * 更新老师信息
 */
export async function updateTeacher(teacher: Teacher & { id?: string }): Promise<Teacher> {
  const { id, ...updateData } = teacher

  if (!id) {
    throw new Error('老师ID不能为空')
  }

  const response = await api.put("/api/teachers", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新老师失败' }))
    throw new Error(error.error || '更新老师失败')
  }

  const { data } = await response.json()
  return data as Teacher
}

/**
 * 删除老师
 */
export async function deleteTeacher(id: string): Promise<boolean> {
  const response = await api.delete(`/api/teachers?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除老师失败' }))
    throw new Error(error.error || '删除老师失败')
  }

  return true
}

/**
 * 老师管理服务对象
 */
export const TeachersService = {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
}
