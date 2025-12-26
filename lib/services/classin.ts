/**
 * ClassIn 服务层
 * 提供业务逻辑封装和统一的接口
 */

import {
  ClassInTeacher,
  ClassInStudent,
  ClassInCourse,
  ClassInClass,
  PageParams,
  TeacherSearchParams,
  StudentSearchParams,
  CourseSearchParams,
  ClassSearchParams,
  AddStudentParams,
} from './classin/types'
import { getClassInApiClient } from './classin/api'

/**
 * ClassIn 服务类
 */
export class ClassInService {
  private apiClient = getClassInApiClient()

  /**
   * 登录 ClassIn
   * @param cookieString 从浏览器获取的 Cookie
   */
  login(cookieString: string): void {
    this.apiClient.loginWithCookie(cookieString)
  }

  /**
   * 登出
   */
  logout(): void {
    this.apiClient.clearSession()
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    return this.apiClient.isSessionValid()
  }

  // ============================================
  // 老师相关方法
  // ============================================

  /**
   * 获取老师列表
   */
  async getTeachers(params?: PageParams): Promise<{
    list: ClassInTeacher[]
    total: number
  }> {
    const result = await this.apiClient.getTeacherList(params)
    return {
      list: result.list,
      total: result.totalNum,
    }
  }

  /**
   * 搜索老师
   */
  async searchTeachers(params: TeacherSearchParams): Promise<{
    list: ClassInTeacher[]
    total: number
  }> {
    const result = await this.apiClient.getTeacherList(params)
    return {
      list: result.list,
      total: result.totalNum,
    }
  }

  // ============================================
  // 学生相关方法
  // ============================================

  /**
   * 获取学生列表
   */
  async getStudents(params?: PageParams): Promise<{
    list: ClassInStudent[]
    total: number
  }> {
    const result = await this.apiClient.getStudentList(params)
    return {
      list: result.list,
      total: result.totalStudentNum, // 学生列表使用 totalStudentNum 字段
    }
  }

  /**
   * 搜索学生
   */
  async searchStudents(params: StudentSearchParams): Promise<{
    list: ClassInStudent[]
    total: number
  }> {
    const result = await this.apiClient.getStudentList(params)
    return {
      list: result.list,
      total: result.totalStudentNum, // 学生列表使用 totalStudentNum 字段
    }
  }

  /**
   * 添加单个学生
   */
  async addStudent(params: AddStudentParams): Promise<any> {
    return await this.apiClient.addStudent(params)
  }

  // ============================================
  // 课程相关方法
  // ============================================

  /**
   * 获取课程列表
   */
  async getCourses(params?: PageParams): Promise<{
    list: ClassInCourse[]
    total: number
  }> {
    const result = await this.apiClient.getCourseList(params)
    return {
      list: result.list,
      total: result.totalNum,
    }
  }

  /**
   * 搜索课程
   */
  async searchCourses(params: CourseSearchParams): Promise<{
    list: ClassInCourse[]
    total: number
  }> {
    const result = await this.apiClient.getCourseList(params)
    return {
      list: result.list,
      total: result.totalNum,
    }
  }

  // ============================================
  // 课节相关方法
  // ============================================

  /**
   * 获取课节列表
   */
  async getClasses(params?: PageParams & { courseId?: number }): Promise<{
    list: ClassInClass[]
    total: number
  }> {
    const result = await this.apiClient.getClassList(params)
    return {
      list: result.list,
      total: result.totalNum,
    }
  }

  /**
   * 搜索课节
   */
  async searchClasses(params: ClassSearchParams): Promise<{
    list: ClassInClass[]
    total: number
  }> {
    const result = await this.apiClient.getClassList(params)
    return {
      list: result.list,
      total: result.totalNum,
    }
  }
}

// 导出服务实例
export const classInService = new ClassInService()

// 导出所有类型
export * from './classin/types'
export { getClassInApiClient } from './classin/api'
