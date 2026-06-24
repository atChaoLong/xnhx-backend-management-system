import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('TokenRefreshManager')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function getResponseErrorText(payload: unknown): string {
  if (!isRecord(payload)) return ''
  return normalizeString(payload.error)
}

function getResponseErrorCode(payload: unknown): string {
  if (!isRecord(payload)) return ''
  return normalizeString(payload.code)
}

function isRefreshTokenInvalid(errorText: string, errorCode: string): boolean {
  const combined = `${errorText} ${errorCode}`.toLowerCase()
  return combined.includes('refresh_token') ||
    combined.includes('refresh token') ||
    combined.includes('过期')
}

function isTerminalAuthFailure(errorCode: string): boolean {
  const normalizedCode = errorCode.toUpperCase()
  return (
    normalizedCode === 'ACCOUNT_DISABLED' ||
    normalizedCode === 'PROFILE_NOT_FOUND' ||
    normalizedCode === 'PROFILE_LOOKUP_FAILED'
  )
}

interface SessionData {
  access_token: string
  refresh_token: string
  expires_at: number
  user: { id?: string } | null
}

function buildStoredSession(session: SessionData): SessionData {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user?.id ? { id: session.user.id } : null,
  }
}

/**
 * Token 刷新管理器
 * 负责协调并发刷新请求，确保同时只有一个刷新操作在进行
 */
class TokenRefreshManager {
  private isRefreshing = false
  private refreshPromise: Promise<SessionData | null> | null = null
  private pendingCallbacks: Array<(session: SessionData | null) => void> = []
  private sessionEpoch = 0

  /**
   * 刷新 token
   * 如果正在刷新，返回现有的刷新 Promise
   * 刷新完成后通知所有等待的回调
   */
  async refreshToken(): Promise<SessionData | null> {
    // 如果正在刷新，等待刷新完成
    if (this.isRefreshing && this.refreshPromise) {
      logger.debug('token 刷新进行中，等待完成')
      return this.refreshPromise
    }

    // 开始刷新
    this.isRefreshing = true
    this.refreshPromise = this.doRefresh()

    try {
      const session = await this.refreshPromise

      // 通知所有等待的回调
      this.pendingCallbacks.forEach(callback => callback(session))
      this.pendingCallbacks = []

      return session
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  /**
   * 实际执行刷新操作
   * 包含重试逻辑
   */
  private async doRefresh(maxRetries = 3): Promise<SessionData | null> {
    const session = this.getSession()
    const refreshEpoch = this.sessionEpoch

    if (!session?.refresh_token) {
      logger.warn('无法刷新：缺少 refresh_token')
      return null
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug(`尝试刷新 token (第 ${attempt + 1} 次)`)

        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        })

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null)
          const errorText = getResponseErrorText(errorPayload)
          const errorCode = getResponseErrorCode(errorPayload)

          // 401 表示认证失效，刷新凭据已不可用，不再重试
          if (response.status === 401 ||
              isRefreshTokenInvalid(errorText, errorCode) ||
              isTerminalAuthFailure(errorCode)) {
            logger.warn('刷新凭据已失效或账号不可用', {
              code: errorCode || undefined,
              status: response.status,
            })
            this.clearSession()
            return null
          }

          throw new Error('TOKEN_REFRESH_FAILED')
        }

        const { data } = await response.json()

        if (refreshEpoch !== this.sessionEpoch) {
          logger.info('刷新完成时会话已被清理，忽略刷新结果')
          return null
        }

        // 保存新的 session
        this.saveSession(data)

        logger.info('token 刷新成功', {
          userId: data.user?.id,
          expiresAt: data.expires_at
        })

        return data

      } catch (error: any) {
        logger.warn(`刷新失败 (第 ${attempt + 1} 次)`, {
          ...summarizeError(error),
          willRetry: attempt < maxRetries - 1
        })

        // 最后一次尝试失败
        if (attempt === maxRetries - 1) {
          logger.error('刷新失败，已达最大重试次数')
          this.clearSession()
          return null
        }

        // 指数退避：1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000
        await this.sleep(delay)
      }
    }

    return null
  }

  /**
   * 获取当前存储的 session
   */
  private getSession(): SessionData | null {
    if (typeof window === 'undefined') return null

    try {
      const sessionStr = localStorage.getItem('supabase.auth.session')

      if (sessionStr) {
        return JSON.parse(sessionStr)
      }

      // 兼容老格式：只有 access_token
      const oldToken = localStorage.getItem('supabase.auth.token')
      if (oldToken) {
        logger.info('检测到老格式 token（无 refresh_token）')
        // 老格式无法刷新，返回 null
        return null
      }

      return null
    } catch (error) {
      logger.error('解析 session 失败', summarizeError(error))
      return null
    }
  }

  /**
   * 保存 session 到 localStorage
   */
  private saveSession(session: SessionData): void {
    if (typeof window === 'undefined') return

    try {
      const storedSession = buildStoredSession(session)
      localStorage.setItem('supabase.auth.session', JSON.stringify(storedSession))

      // 兼容：同时保存 access_token 到旧位置
      if (storedSession.access_token) {
        localStorage.setItem('supabase.auth.token', storedSession.access_token)
      }

      // 触发自定义事件，通知其他组件
      window.dispatchEvent(new CustomEvent('token:refreshed', {
        detail: {
          userId: storedSession.user?.id,
          expiresAt: storedSession.expires_at,
        }
      }))
    } catch (error) {
      logger.error('保存 session 失败', summarizeError(error))
    }
  }

  /**
   * 清除 session
   */
  clearSession(): void {
    if (typeof window === 'undefined') return

    this.sessionEpoch += 1
    this.pendingCallbacks.forEach(callback => callback(null))
    this.pendingCallbacks = []

    localStorage.removeItem('supabase.auth.session')
    localStorage.removeItem('supabase.auth.token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('currentUser')

    // 触发登出事件
    window.dispatchEvent(new Event('auth:expired'))
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 检查 token 是否即将过期
   * @param bufferSeconds 缓冲时间（秒），默认 300 秒（5 分钟）
   */
  isTokenExpiringSoon(bufferSeconds: number = 300): boolean {
    const session = this.getSession()

    if (!session?.expires_at) {
      return false
    }

    const now = Math.floor(Date.now() / 1000) // 当前时间戳（秒）
    const expiresAt = session.expires_at
    const remainingSeconds = expiresAt - now

    return remainingSeconds < bufferSeconds
  }

  /**
   * 获取当前的 access_token
   */
  getAccessToken(): string | null {
    const session = this.getSession()
    return session?.access_token || null
  }
}

// 导出单例
export const tokenRefreshManager = new TokenRefreshManager()
