/**
 * ClassIn SDK 服务层
 * 封装官方 SDK，提供 TypeScript 支持
 */

import {
  ClassInConfig,
  RegisterTeacherParams,
  RegisterStudentParams,
  AddSchoolStudentParams,
  CreateCourseParams,
  CreateUnitParams,
  CreateClassroomParams,
  AddCourseStudentParams,
  CompleteClassroomOptions,
  CompleteClassroomResult,
  APIError,
} from './types'

// 引入 CommonJS SDK
const ClassInSDK = require('./index')

/**
 * ClassIn SDK 服务类
 */
export class ClassInSDKService {
  private sdk: any

  constructor(config: ClassInConfig) {
    this.sdk = new ClassInSDK(config)
  }

  // ==================== 用户管理 ====================

  /**
   * 注册老师
   */
  async registerTeacher(params: RegisterTeacherParams): Promise<number> {
    try {
      return await this.sdk.registerTeacher(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  /**
   * 注册学生
   */
  async registerStudent(params: RegisterStudentParams): Promise<number> {
    try {
      return await this.sdk.registerStudent(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  /**
   * 添加学生到机构
   */
  async addSchoolStudent(params: AddSchoolStudentParams): Promise<any> {
    try {
      return await this.sdk.addSchoolStudent(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  // ==================== 课程管理 ====================

  /**
   * 创建课程
   */
  async createCourse(params: CreateCourseParams): Promise<number> {
    try {
      return await this.sdk.createCourse(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  // ==================== 单元管理 ====================

  /**
   * 创建单元
   */
  async createUnit(params: CreateUnitParams): Promise<number> {
    try {
      return await this.sdk.createUnit(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  // ==================== 课堂管理 ====================

  /**
   * 创建课堂活动
   */
  async createClassroom(params: CreateClassroomParams): Promise<any> {
    try {
      return await this.sdk.createClassroom(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  /**
   * 课程下添加学生/旁听（单个）
   */
  async addCourseStudent(params: AddCourseStudentParams): Promise<any> {
    try {
      return await this.sdk.addCourseStudent(params)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  // ==================== 完整流程（推荐）====================

  /**
   * 一键创建课程和课堂
   */
  async createCompleteClassroom(options: CompleteClassroomOptions): Promise<CompleteClassroomResult> {
    try {
      return await this.sdk.createCompleteClassroom(options)
    } catch (error: any) {
      throw this.handleError(error)
    }
  }

  // ==================== 错误处理 ====================

  /**
   * 统一错误处理
   */
  private handleError(error: any): Error {
    const apiError: APIError = error

    // 常见错误码处理
    if (apiError.errno || apiError.code) {
      const code = apiError.errno || apiError.code
      const message = apiError.error || apiError.msg || '未知错误'

      // 根据错误码提供更友好的提示
      switch (code) {
        case 136:
          return new Error('机构下没有该老师，请先注册')
        case 40020:
          return new Error('单元不存在，请先创建单元')
        case 101002005:
          return new Error('签名验证失败，请检查 SID 和 SECRET')
        case 101002006:
          return new Error('验签时间戳过期，请检查系统时间')
        default:
          return new Error(`ClassIn API 错误 (${code}): ${message}`)
      }
    }

    return error
  }
}

// 导出服务实例（单例）
let sdkServiceInstance: ClassInSDKService | null = null

export function getClassInSDKService(): ClassInSDKService {
  if (!sdkServiceInstance) {
    const SID = process.env.CLASSIN_SID
    const SECRET = process.env.CLASSIN_SECRET

    if (!SID || !SECRET) {
      throw new Error('环境变量 CLASSIN_SID 和 CLASSIN_SECRET 未配置')
    }

    sdkServiceInstance = new ClassInSDKService({
      SID,
      SECRET,
      BASE_URL: process.env.CLASSIN_API_URL || 'api.eeo.cn',
      debug: process.env.NODE_ENV === 'development',
    })
  }

  return sdkServiceInstance
}

// 导出所有类型
export * from './types'
