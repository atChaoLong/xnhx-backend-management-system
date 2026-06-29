/**
 * 老师面试服务层
 * 提供老师面试 CRUD 操作的统一接口
 */

import { api } from '@/lib/fetch'

/**
 * 老师面试类型定义
 */
export interface TeacherCandidate {
  id: string
  created_at: string
  updated_at: string

  // 基本信息
  name: string
  wechat_id?: string
  phone?: string
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
  interview_notes?: string

  // 面试评分
  interview_month?: string
  interview_week?: number
  registration_date?: string
  interview_score?: number
  interview_rating?: string
  logical_expression_score?: number
  dress_appearance_score?: number
  material_preparation_score?: number
  exam_score?: string

  // 素质评价
  initial_evaluation?: string
  teacher_characteristics?: string
  mandarin_level?: string
  research_ability?: string
  service_awareness?: string
  affinity?: string

  // 复核状态
  review_status?: '待复核' | '已复核' | '不符合'
  reviewed_by?: string
  review_result?: string
  review_evaluation_comment?: string
  review_notes?: string
  review_date?: string
  teacher_level?: string
  can_teach_graduation_class?: boolean

  // 招聘决定
  is_hired?: boolean
  teacher_feeling?: string
  suitable_for_students?: string
  scheduling_preference?: string
  hired_notes?: string
  qr_code_url?: string

  // 薪资信息
  current_rate?: number
  approved_hourly_rate?: number
  grade_level_rates?: Record<string, number>  // 年级-时薪映射（已废弃）
  grade_level_settings?: Array<{
    grade: string
    workload: number
    hourlyRate: number
  }>  // 年级配置数组（包含年级、带课量、时薪）

  // 银行信息
  bank_account?: string
  bank_account_name?: string
  bank_name?: string
  bank_branch?: string
  notes_external?: string

  // 招聘流程
  recruitment_step?: 'scheduling' | 'interview_video' | 'teaching_review' | 'salary_negotiation' | 'final_entry' | 'rejected'
  recruitment_status?: 'waiting_contact' | 'scheduled' | 'video_uploaded' | 'pending_teaching_review' | 'teaching_review_approved' | 'pending_salary' | 'in_teacher_pool' | 'review_rejected'
  video_reviewed_at?: string
  salary_reviewed_by?: string
  salary_confirmed_at?: string
  salary_confirmed_by?: string

  // 后期使用（目前未启用）
  candidate_status?: 'waiting_contact' | 'contacted' | 'interviewing' | 'pending_review' | 'pending_entry' | 'review_rejected' | 'can_trial_lesson' | 'trial_review_pending' | 'can_formal' | 'pause_scheduling' | 'disabled'
  interview_status?: string
  interview_status_name?: string

  // 抢单
  grab_user_id?: string
  grab_user_name?: string
  grabbed_at?: string
}

/**
 * 新建老师面试类型（不包含 id, created_at, updated_at）
 */
export type NewTeacherCandidate = Omit<TeacherCandidate, 'id' | 'created_at' | 'updated_at'>

export interface TeacherCandidateFilters {
  queue?: 'scheduling' | 'pending_entry' | 'video_upload' | 'teaching_review' | 'reserve'
}

/**
 * 获取老师面试列表（支持分页）
 */
export async function getTeacherCandidates(
  from: number = 0,
  to: number = 19,
  filters: TeacherCandidateFilters = {}
): Promise<{ data: TeacherCandidate[], count: number }> {
  const params = new URLSearchParams({
    from: from.toString(),
    to: to.toString(),
  })

  if (filters.queue) {
    params.set('queue', filters.queue)
  }

  const response = await api.get(`/api/teacher-candidates?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取老师面试列表失败' }))
    throw new Error(error.error || '获取老师面试列表失败')
  }

  const result = await response.json()
  return { data: result.data as TeacherCandidate[], count: result.count || 0 }
}

/**
 * 获取所有老师面试（不带分页，用于兼容旧代码）
 */
export async function getAllTeacherCandidates(): Promise<TeacherCandidate[]> {
  const response = await api.get("/api/teacher-candidates")

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取老师面试列表失败' }))
    throw new Error(error.error || '获取老师面试列表失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate[]
}

/**
 * 根据ID获取单个老师面试
 */
export async function getTeacherCandidateById(id: string): Promise<TeacherCandidate> {
  const response = await api.get(`/api/teacher-candidates?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取老师面试失败' }))
    throw new Error(error.error || '获取老师面试失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate
}

/**
 * 创建新老师面试
 */
export async function createTeacherCandidate(candidate: NewTeacherCandidate): Promise<TeacherCandidate> {
  const response = await api.post("/api/teacher-candidates", candidate)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建老师面试失败' }))
    throw new Error(error.error || '创建老师面试失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate
}

/**
 * 更新老师面试信息
 */
export async function updateTeacherCandidate(candidate: TeacherCandidate & { id?: string }): Promise<TeacherCandidate> {
  const { id, ...updateData } = candidate

  if (!id) {
    throw new Error('老师面试ID不能为空')
  }

  const response = await api.put("/api/teacher-candidates", { id, ...updateData })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新老师面试失败' }))
    throw new Error(error.error || '更新老师面试失败')
  }

  const { data } = await response.json()
  return data as TeacherCandidate
}

/**
 * 删除老师面试
 */
export async function deleteTeacherCandidate(id: string): Promise<boolean> {
  const response = await api.delete(`/api/teacher-candidates?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除老师面试失败' }))
    throw new Error(error.error || '删除老师面试失败')
  }

  return true
}

/**
 * 老师面试服务对象
 */
export const TeacherCandidatesService = {
  getTeacherCandidates,
  getAllTeacherCandidates,
  getTeacherCandidateById,
  createTeacherCandidate,
  updateTeacherCandidate,
  deleteTeacherCandidate,
}
