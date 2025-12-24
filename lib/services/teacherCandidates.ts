/**
 * 教师候选服务层
 * 提供教师候选 CRUD 操作的统一接口
 */

import { api } from '@/lib/fetch'

/**
 * 教师候选类型定义
 */
export interface TeacherCandidate {
  id: string
  created_at: string
  updated_at: string

  // 基本信息
  name: string
  wechat_id: string
  daily_lead_id?: string
  resume_url?: string
  profile_photo_url?: string

  // 岗位信息
  grade_level?: string
  subjects_taught?: string[]
  teacher_type?: string
  trial_subject?: string
  teaching_style?: string

  // 约面信息
  interview_date?: string
  interviewer_name?: string
  interview_time?: string
  interview_link?: string
  interview_officer?: string

  // 面试过程
  interview_exception?: string
  video_recording_url?: string
  trial_video_url?: string

  // 面试评分
  interview_month?: string
  interview_week?: number
  appointment_week?: number
  registration_date?: string
  interview_score?: number
  interview_score_total?: number
  logical_expression_score?: number
  dress_appearance_score?: number
  material_preparation_score?: number
  exam_score?: string

  // 素质评价
  initial_evaluation?: string
  interview_evaluation?: string
  teacher_characteristics?: string
  mandarin_level?: string
  research_ability?: string
  service_awareness?: string
  affinity?: string

  // 复核状态
  review_status?: '待复核' | '已复核' | '不符合'
  reviewer_name?: string
  review_result?: string
  review_evaluation_comment?: string
  review_date?: string
  reviewed_by?: string
  teacher_level?: string
  can_teach_graduation_class?: boolean

  // 招聘决定
  is_hired?: boolean
  teacher_feeling?: string
  suitable_for_students?: string
  scheduling_preference?: string
  enrolled_teacher_name?: string
  hired_notes?: string
  qr_code?: string

  // 薪资信息
  current_rate?: number
  approved_hourly_rate?: number
}

/**
 * 新建教师候选类型（不包含 id, created_at, updated_at）
 */
export type NewTeacherCandidate = Omit<TeacherCandidate, 'id' | 'created_at' | 'updated_at'>

/**
 * 获取所有教师候选
 */
export async function getTeacherCandidates(): Promise<TeacherCandidate[]> {
  const response = await api.get("/api/teacher-candidates")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取教师候选列表失败' }))
    throw new Error(error.error || '获取教师候选列表失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate[]
}

/**
 * 根据ID获取单个教师候选
 */
export async function getTeacherCandidateById(id: string): Promise<TeacherCandidate> {
  const response = await api.get(`/api/teacher-candidates?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取教师候选失败' }))
    throw new Error(error.error || '获取教师候选失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate
}

/**
 * 创建新教师候选
 */
export async function createTeacherCandidate(candidate: NewTeacherCandidate): Promise<TeacherCandidate> {
  const response = await api.post("/api/teacher-candidates", candidate)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建教师候选失败' }))
    throw new Error(error.error || '创建教师候选失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate
}

/**
 * 更新教师候选信息
 */
export async function updateTeacherCandidate(candidate: TeacherCandidate & { id?: string }): Promise<TeacherCandidate> {
  const { id, ...updateData } = candidate

  if (!id) {
    throw new Error('教师候选ID不能为空')
  }

  const response = await api.put("/api/teacher-candidates", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新教师候选失败' }))
    throw new Error(error.error || '更新教师候选失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate
}

/**
 * 删除教师候选
 */
export async function deleteTeacherCandidate(id: string): Promise<boolean> {
  const response = await api.delete(`/api/teacher-candidates?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除教师候选失败' }))
    throw new Error(error.error || '删除教师候选失败')
  }

  return true
}

/**
 * 教师候选服务对象
 */
export const TeacherCandidatesService = {
  getTeacherCandidates,
  getTeacherCandidateById,
  createTeacherCandidate,
  updateTeacherCandidate,
  deleteTeacherCandidate,
}
