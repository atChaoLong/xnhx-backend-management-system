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

// 通用分页响应基础类型
export interface BasePageResponse<T> {
  list: T[]
  page: number
  serverTime: number
}

// 老师列表分页响应
export interface TeacherPageResponse extends BasePageResponse<ClassInTeacher> {
  totalNum: number // 老师总数
}

// 学生列表分页响应
export interface StudentPageResponse extends BasePageResponse<ClassInStudent> {
  totalStudentNum: number // 学生总数
  schoolMaxFolderNum: number // 学校最大文件夹数
  studentMaxFolderNum: number // 学生最大文件夹数
  timeRange: string | null // 时间范围
}

// 课程列表分页响应
export interface CoursePageResponse extends BasePageResponse<ClassInCourse> {
  totalNum: number // 课程总数
}

// 课节列表分页响应
export interface ClassPageResponse extends BasePageResponse<ClassInClass> {
  totalNum: number // 课节总数
}

// 通用分页响应（用于兼容）
export interface PageResponse<T> {
  list: T[]
  totalNum: number // 总数
  page: number // 当前页码
  serverTime: number // 服务器时间戳
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

export interface AddStudentParams {
  name: string // 学生姓名
  mobile: string // 手机号
  email?: string // 邮箱（可选）
  stuno?: string // 学号（可选）
  labelIds?: number[] // 标签ID数组（可选）
  autoRegister?: number // 是否自动注册（1: 是, 0: 否）
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
