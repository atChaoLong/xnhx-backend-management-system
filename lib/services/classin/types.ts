/**
 * ClassIn API 类型定义
 * 用于对接 https://dynamic.eeo.cn 页面端接口
 */

// ============================================
// 通用类型
// ============================================

export interface ClassInErrorInfo {
  errno: number
  error: string
}

export interface ClassInApiResponse<T = any> {
  error_info: ClassInErrorInfo
  data: T
}

export interface PageParams {
  page: number
  pageSize?: number
  sid?: string // 可能需要的学生ID
}

export interface PageResponse<T> {
  list: T[]
  totalNum: number // 总数
  page: number // 当前页码
  pageSize?: number // 每页大小（可选）
  serverTime?: number // 服务器时间戳（可选）
}

export interface ClassInSession {
  sessionId: string
  cookies: string
  expiresAt: number
  userInfo?: {
    uid: number
    username: string
  }
}

// ============================================
// 老师相关类型
// ============================================

export interface ClassInTeacher {
  uid: number
  name: string
  telephone: string
  email?: string
  subject?: string
  status: number
  created_at?: string
}

// ============================================
// 学生相关类型
// ============================================

export interface ClassInStudent {
  uid: number
  name: string
  telephone: string
  email?: string
  grade?: string
  class_name?: string
  status: number
  created_at?: string
}

// ============================================
// 课程相关类型
// ============================================

export interface ClassInCourse {
  id: number
  name: string
  subject?: string
  grade?: string
  teacher_id?: number
  teacher_name?: string
  status: number
  created_at?: string
}

// ============================================
// 课节相关类型
// ============================================

export interface ClassInClass {
  id: number
  course_id: number
  course_name: string
  class_name: string
  teacher_id: number
  teacher_name: string
  start_time: string
  end_time: string
  status: number
  attend_count?: number
  created_at?: string
}

// ============================================
// 搜索参数类型
// ============================================

export interface TeacherSearchParams extends PageParams {
  name?: string
  telephone?: string
  status?: number
}

export interface StudentSearchParams extends PageParams {
  name?: string
  telephone?: string
  grade?: string
  status?: number
}

export interface CourseSearchParams extends PageParams {
  name?: string
  subject?: string
  teacher_id?: number
  status?: number
}

export interface ClassSearchParams extends PageParams {
  course_id?: number
  teacher_id?: number
  start_time?: string
  end_time?: string
  status?: number
}
