/**
 * ClassIn 服务端 SDK
 * 使用 API Key + Secret 认证方式
 */

import crypto from 'crypto'

export interface ClassInSDKConfig {
  sid: string // 学校ID
  secret: string // API密钥
  apiUrl?: string // API地址，默认 api.eeo.cn
}

export interface CreateCourseParams {
  name: string // 课程名称
  subject?: string // 科目
  grade?: string // 年级
  teacher_id?: number // 教师ID
  teacher_name?: string // 教师姓名
  course_type?: number // 课程类型（1: 一对一，2: 小班课，3: 大班课）
}

export interface CreateClassParams {
  course_id: number // 课程ID
  class_name: string // 课节名称
  teacher_id: number // 教师ID
  start_time: number // 开始时间（Unix时间戳，秒）
  end_time: number // 结束时间（Unix时间戳，秒）
  student_ids?: number[] // 学生ID列表
  class_type?: number // 课节类型（1: 一对一，2: 小班课，3: 大班课）
}

export interface ClassInSDKResponse<T = any> {
  errno: number
  error: string
  data?: T
}

export class ClassInSDK {
  private config: ClassInSDKConfig
  private baseUrl: string

  constructor(config: ClassInSDKConfig) {
    this.config = config
    this.baseUrl = config.apiUrl || 'https://api.eeo.cn'
  }

  /**
   * 生成签名
   * 文档: https://www.eeo.cn/api/doc
   */
  private generateSignature(params: Record<string, any>): string {
    // 1. 参数按 key 的字母顺序排序
    const sortedKeys = Object.keys(params).sort()

    // 2. 拼接参数字符串
    const paramStr = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&')

    // 3. 拼接 secret
    const signStr = paramStr + this.config.secret

    // 4. MD5 加密
    const md5 = crypto.createHash('md5')
    md5.update(signStr, 'utf8')
    const signature = md5.digest('hex')

    return signature
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(
    path: string,
    params: Record<string, any>
  ): Promise<ClassInSDKResponse<T>> {
    try {
      // 添加公共参数
      const publicParams = {
        SID: this.config.sid,
        timeStamp: Math.floor(Date.now() / 1000),
        ...params,
      }

      // 生成签名
      const signature = this.generateSignature(publicParams)

      // 添加签名到参数
      const finalParams = {
        ...publicParams,
        safeSign: signature,
      }

      // 构建URL
      const url = `${this.baseUrl}${path}`

      // 发送请求
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalParams),
      })

      const result: ClassInSDKResponse<T> = await response.json()

      if (result.errno !== 1) {
        throw new Error(`ClassIn API Error: ${result.error}`)
      }

      return result
    } catch (error: any) {
      console.error('ClassIn SDK 请求失败:', error)
      throw error
    }
  }

  /**
   * 创建课程
   * API文档: https://www.eeo.cn/api/doc#createCourse
   */
  async createCourse(params: CreateCourseParams): Promise<{ course_id: number }> {
    const result = await this.request<{ course_id: number }>(
      '/course',
      {
        name: params.name,
        subject: params.subject || '',
        grade: params.grade || '',
        teacher_id: params.teacher_id || 0,
        teacher_name: params.teacher_name || '',
        course_type: params.course_type || 1,
      }
    )

    if (!result.data) {
      throw new Error('创建课程失败：未返回课程ID')
    }

    return result.data
  }

  /**
   * 创建课节
   * API文档: https://www.eeo.cn/api/doc#addClass
   */
  async createClass(params: CreateClassParams): Promise<{ class_id: number }> {
    const result = await this.request<{ class_id: number }>(
      '/class',
      {
        course_id: params.course_id,
        class_name: params.class_name,
        teacher_id: params.teacher_id,
        start_time: params.start_time,
        end_time: params.end_time,
        class_type: params.class_type || 1,
      }
    )

    if (!result.data) {
      throw new Error('创建课节失败：未返回课节ID')
    }

    return result.data
  }

  /**
   * 添加学生到课节
   * API文档: https://www.eeo.cn/api/doc#addStudentToClass
   */
  async addStudentToClass(classId: number, studentIds: number[]): Promise<boolean> {
    await this.request('/class/student/add', {
      class_id: classId,
      student_ids: studentIds.join(','),
    })

    return true
  }
}

// 创建单例实例
let classInSDKInstance: ClassInSDK | null = null

export function getClassInSDK(): ClassInSDK {
  if (!classInSDKInstance) {
    const sid = process.env.CLASSIN_SID
    const secret = process.env.CLASSIN_SECRET
    const apiUrl = process.env.CLASSIN_API_URL

    if (!sid || !secret) {
      throw new Error('缺少 ClassIn 配置：CLASSIN_SID 和 CLASSIN_SECRET 环境变量必须设置')
    }

    classInSDKInstance = new ClassInSDK({
      sid,
      secret,
      apiUrl,
    })
  }

  return classInSDKInstance
}
