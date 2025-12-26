/**
 * ClassIn API 客户端
 * 用于对接 dynamic.eeo.cn 页面端接口
 */

import {
  ClassInApiResponse,
  PageParams,
  PageResponse,
  TeacherPageResponse,
  StudentPageResponse,
  CoursePageResponse,
  ClassPageResponse,
  ClassInSession,
  AddStudentParams
} from './types'

/**
 * ClassIn API 客户端类
 */
export class ClassInApiClient {
  private baseUrl: string
  private consoleUrl: string
  private currentSession: ClassInSession | null = null

  constructor() {
    // 从环境变量读取配置，或使用默认值
    this.baseUrl = process.env.NEXT_PUBLIC_CLASSIN_API_URL || 'https://dynamic.eeo.cn'
    this.consoleUrl = process.env.NEXT_PUBLIC_CLASSIN_CONSOLE_URL || 'https://console.eeo.cn'
  }

  /**
   * 使用 Cookie 登录 ClassIn
   * @param cookieString 从浏览器开发者工具中获取的 Cookie 字符串
   * @returns Session 信息
   */
  loginWithCookie(cookieString: string): ClassInSession {
    const cookies = this.parseCookies(cookieString)
    const sessionId = cookies['PHPSESSID'] || ''

    const session: ClassInSession = {
      sessionId,
      cookies: cookieString,
      expiresAt: Date.now() + 7200000, // 2小时后过期
    }

    this.currentSession = session
    return session
  }

  /**
   * 检查 Session 是否有效
   */
  isSessionValid(): boolean {
    if (!this.currentSession) {
      return false
    }
    return Date.now() < this.currentSession.expiresAt
  }

  /**
   * 清除当前 Session
   */
  clearSession(): void {
    this.currentSession = null
  }

  /**
   * 解析 Cookie 字符串
   */
  private parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {}
    cookieString.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        cookies[key] = value
      }
    })
    return cookies
  }

  /**
   * 发送 API 请求（服务端）
   * 注意：此方法仅在服务端可用，需要使用 Node.js 的 fetch 或 axios
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    data?: any
  ): Promise<ClassInApiResponse<T>> {
    if (!this.currentSession) {
      throw new Error('未登录，请先调用 loginWithCookie()')
    }

    if (!this.isSessionValid()) {
      throw new Error('Session 已过期，请重新登录')
    }

    try {
      // 使用 Node.js fetch
      const url = `${this.baseUrl}${path}`
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Origin': this.consoleUrl,
          'Referer': this.consoleUrl,
          'Cookie': this.currentSession.cookies,
        },
      }

      if (method === 'POST' && data) {
        options.body = JSON.stringify(data)
      }

      // 添加 GET 参数
      let finalUrl = url
      if (method === 'GET' && data) {
        const params = new URLSearchParams()
        Object.keys(data).forEach(key => {
          if (data[key] !== undefined && data[key] !== null) {
            params.append(key, String(data[key]))
          }
        })
        finalUrl = `${url}?${params.toString()}`
      }

      const response = await fetch(finalUrl, options)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ClassInApiResponse<T> = await response.json()
      return result
    } catch (error) {
      console.error('ClassIn API 请求失败:', error)
      throw error
    }
  }

  /**
   * 获取老师列表
   */
  async getTeacherList(params: PageParams = { page: 1, pageSize: 1000 }): Promise<TeacherPageResponse> {
    const response = await this.request<TeacherPageResponse>(
      'POST',
      '/coreapi/teacher/v1/searchTeacherList',
      params
    )

    // errno === 1 表示成功
    if (response.error_info.errno !== 1) {
      throw new Error(`获取老师列表失败: ${response.error_info.error}`)
    }

    return response.data
  }

  /**
   * 获取学生列表
   */
  async getStudentList(params: PageParams = { page: 1, pageSize: 1000 }): Promise<StudentPageResponse> {
    const response = await this.request<StudentPageResponse>(
      'POST',
      '/coreapi/student/v1/searchStudentList',
      params
    )

    if (response.error_info.errno !== 1) {
      throw new Error(`获取学生列表失败: ${response.error_info.error}`)
    }

    return response.data
  }

  /**
   * 获取课程列表
   */
  async getCourseList(params: PageParams = { page: 1, pageSize: 1000 }): Promise<CoursePageResponse> {
    const response = await this.request<CoursePageResponse>(
      'POST',
      '/coreapi/course/v1/searchCourseList',
      params
    )

    if (response.error_info.errno !== 1) {
      throw new Error(`获取课程列表失败: ${response.error_info.error}`)
    }

    return response.data
  }

  /**
   * 获取课节列表
   */
  async getClassList(params: PageParams & { courseId?: number } = { page: 1, pageSize: 1000 }): Promise<ClassPageResponse> {
    const response = await this.request<ClassPageResponse>(
      'POST',
      '/coreapi/class/v1/searchClassList',
      params
    )

    if (response.error_info.errno !== 1) {
      throw new Error(`获取课节列表失败: ${response.error_info.error}`)
    }

    return response.data
  }

  /**
   * 添加单个学生
   */
  async addStudent(params: AddStudentParams): Promise<any> {
    const response = await this.request<any>(
      'POST',
      '/coreapi/student/v1/addOneStudent',
      params
    )

    if (response.error_info.errno !== 1) {
      throw new Error(`添加学生失败: ${response.error_info.error}`)
    }

    return response.data
  }
}

// 创建单例实例
let classInApiClient: ClassInApiClient | null = null

export function getClassInApiClient(): ClassInApiClient {
  if (!classInApiClient) {
    classInApiClient = new ClassInApiClient()
  }
  return classInApiClient
}
