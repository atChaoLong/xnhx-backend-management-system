/**
 * 统一日志系统
 *
 * 功能特性:
 * - 支持日志级别: error, warn, info, debug
 * - 环境区分: 开发环境显示所有，生产环境只显示 error/warn
 * - 格式化输出: 时间戳、级别、上下文标签
 * - 敏感信息过滤: 自动隐藏 password、token 等字段
 * - 支持服务端和客户端
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

// 敏感字段列表（自动过滤值）
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'secret',
  'apiKey',
  'api_key',
  'api-secret',
  'sessionToken',
]

// 当前环境
const NODE_ENV = process.env.NODE_ENV || 'development'

// 当前日志级别
const CURRENT_LOG_LEVEL: LogLevel =
  NODE_ENV === 'production' ? 'warn' : 'debug'

// 日志颜色（仅开发环境）
const COLORS = {
  error: '\x1b[31m', // 红色
  warn: '\x1b[33m',  // 黄色
  info: '\x1b[36m',  // 青色
  debug: '\x1b[90m', // 灰色
  reset: '\x1b[0m',
}

/**
 * 过滤敏感信息
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item))
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      // 隐藏敏感信息，只显示前3个字符
      const strValue = String(value)
      sanitized[key] = strValue.length > 3
        ? strValue.substring(0, 3) + '***'
        : '***'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * 格式化日志消息
 */
function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  data?: any
): string {
  const timestamp = new Date().toISOString()
  const contextStr = context ? `[${context}] ` : ''

  if (data !== undefined) {
    const sanitizedData = sanitizeData(data)
    const dataStr = JSON.stringify(sanitizedData, null, 2)
    return `${timestamp} ${level.toUpperCase()} ${contextStr}${message}\n${dataStr}`
  }

  return `${timestamp} ${level.toUpperCase()} ${contextStr}${message}`
}

/**
 * 核心日志函数
 */
function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: any
): void {
  // 检查是否应该输出此级别
  if (LOG_LEVELS[level] > LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    return
  }

  const formattedMessage = formatMessage(level, context, message, data)

  // 开发环境使用颜色，生产环境不带颜色
  if (NODE_ENV === 'development' && typeof window === 'undefined') {
    const color = COLORS[level]
    const consoleMethod = level === 'error' ? console.error :
                         level === 'warn' ? console.warn : console.log
    consoleMethod(`${color}${formattedMessage}${COLORS.reset}`)
  } else {
    const consoleMethod = level === 'error' ? console.error :
                         level === 'warn' ? console.warn : console.log
    consoleMethod(formattedMessage)
  }
}

/**
 * Logger 类 - 用于特定上下文
 */
export class Logger {
  constructor(private context: string) {}

  error(message: string, data?: any): void {
    log('error', this.context, message, data)
  }

  warn(message: string, data?: any): void {
    log('warn', this.context, message, data)
  }

  info(message: string, data?: any): void {
    log('info', this.context, message, data)
  }

  debug(message: string, data?: any): void {
    log('debug', this.context, message, data)
  }
}

/**
 * 创建 logger 实例
 */
export function createLogger(context: string): Logger {
  return new Logger(context)
}

// 默认导出
export const logger = {
  error: (message: string, data?: any) => log('error', '', message, data),
  warn: (message: string, data?: any) => log('warn', '', message, data),
  info: (message: string, data?: any) => log('info', '', message, data),
  debug: (message: string, data?: any) => log('debug', '', message, data),
}
