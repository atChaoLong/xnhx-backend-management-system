/**
 * ClassIn SDK 类型定义
 */

// ============================================
// 请求参数类型
// ============================================

export interface ClassInConfig {
  SID: string
  SECRET: string
  BASE_URL?: string
  debug?: boolean
}

export interface RegisterTeacherParams {
  telephone: string
  nickname: string
  password: string
}

export interface RegisterStudentParams {
  telephone: string
  nickname: string
  password: string
}

export interface AddSchoolStudentParams {
  studentAccount: string
  studentName: string
}

export interface CreateCourseParams {
  courseName: string
}

export interface CreateUnitParams {
  courseId: number
  name: string
  publishFlag?: number
}

export interface CreateClassroomParams {
  courseId: number
  unitId?: number
  name: string
  teacherUid: number
  startTime: string | number | Date
  endTime: string | number | Date
  liveState?: number
  openState?: number
  recordState?: number
  recordType?: number
}

export interface AddCourseStudentParams {
  courseId: number
  studentUid: number
  identity?: number
  studentName?: string
}

export interface CompleteClassroomOptions {
  teacher: RegisterTeacherParams
  course: CreateCourseParams
  unit?: CreateUnitParams
  classroom: Omit<CreateClassroomParams, 'courseId' | 'unitId' | 'teacherUid'>
}

// ============================================
// 返回结果类型
// ============================================

export interface CompleteClassroomResult {
  teacherUid: number
  courseId: number
  unitId: number
  classId: number
  activityId: number
}

// ============================================
// API 响应类型
// ============================================

export interface APIV1Response<T = any> {
  error_info: {
    errno: number
    error: string
  }
  data: T
}

export interface APIV2Response<T = any> {
  code: number
  msg: string
  data: T
}

export interface APIError {
  errno?: number
  code?: number
  error?: string
  msg?: string
}
