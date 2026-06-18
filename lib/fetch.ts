/**
 * 统一的 fetch wrapper - 自动添加认证 headers
 * 所有 API 请求都应该使用这个而不是直接调用 fetch
 */

import { tokenRefreshManager } from './tokenRefreshManager'
import { createLogger } from './logger'
import { summarizeError } from './safe-error'

const logger = createLogger('APIRequest')

function buildRequestHeaders(options: RequestInit, token: string | null): Headers {
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // 只有 body 是字符串时才设置 Content-Type 为 JSON
  // FormData 会自动设置正确的 Content-Type (multipart/form-data)
  if (
    !headers.has('Content-Type') &&
    options.body &&
    typeof options.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getResponseErrorCode(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.code !== 'string') {
    return ''
  }

  return payload.code.toUpperCase()
}

function isTerminalAuthFailure(payload: unknown): boolean {
  const errorCode = getResponseErrorCode(payload)
  return (
    errorCode === 'ACCOUNT_DISABLED' ||
    errorCode === 'PROFILE_NOT_FOUND' ||
    errorCode === 'PROFILE_LOOKUP_FAILED'
  )
}

async function clearAuthForTerminalResponse(response: Response): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    response.status < 400
  ) {
    return false
  }

  const data = await response.clone().json().catch(() => null)

  if (!isTerminalAuthFailure(data)) {
    return false
  }

  logger.warn('账号不可用，清除认证信息', {
    status: response.status,
    code: getResponseErrorCode(data),
  })
  clearAuthAndRedirect()
  return true
}

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token =
    typeof window !== 'undefined'
      ? tokenRefreshManager.getAccessToken() ||
        localStorage.getItem('supabase.auth.token')
      : null

  // 请求发出前如果 token 即将过期，先续期，减少用户停留页面时遇到 401 的概率
  if (typeof window !== 'undefined' && tokenRefreshManager.isTokenExpiringSoon()) {
    const refreshedSession = await tokenRefreshManager.refreshToken()

    if (refreshedSession?.access_token) {
      token = refreshedSession.access_token
    }
  }

  const headers = buildRequestHeaders(options, token)

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // 后端判定账号停用/档案不可用时，前端应立即退出本地会话，避免继续携带无效凭据。
  if (await clearAuthForTerminalResponse(response)) {
    return response
  }

  // 处理 401 错误：尝试刷新 token 并重试
  if (response.status === 401 && typeof window !== 'undefined') {
    const responseClone = response.clone()

    try {
      const data = await responseClone.json()
      const errorMsg = data.error || ''

      // 如果是 refresh_token 相关错误，直接清除（无法刷新）
      if (errorMsg.includes('refresh_token') || errorMsg.includes('refresh token')) {
        logger.warn('refresh_token 已过期，清除认证信息')
        clearAuthAndRedirect()
        return response
      }

      // 其他 401 错误：尝试刷新 token
      logger.info('Token 已过期，尝试刷新并重试')

      const newSession = await tokenRefreshManager.refreshToken()

      if (newSession) {
        logger.info('Token 刷新成功，重试原请求')

        // 使用新 token 和同样的请求头规则重试原请求
        const newHeaders = buildRequestHeaders(options, newSession.access_token)

        const retryResponse = await fetch(url, {
          ...options,
          headers: newHeaders,
        })

        await clearAuthForTerminalResponse(retryResponse)

        return retryResponse
      } else {
        // 刷新失败，清除认证信息
        logger.warn('Token 刷新失败，清除认证信息')
        clearAuthAndRedirect()
      }
    } catch (error) {
      // JSON 解析失败或其他错误，清除认证信息（保险起见）
      logger.warn('处理 401 错误失败', summarizeError(error))
      clearAuthAndRedirect()
    }
  }

  return response
}

/**
 * 清除认证信息并触发登出事件
 */
function clearAuthAndRedirect() {
  if (typeof window === 'undefined') return

  tokenRefreshManager.clearSession()

  void fetch('/api/auth/signout', {
    method: 'POST',
    keepalive: true,
  }).catch((error) => {
    logger.warn('清理服务端登录 cookie 失败', summarizeError(error))
  })

  // 不在这里跳转，让监听器处理（保持灵活性）
}

// 快捷方法
export const api = {
  get: (url: string, options?: RequestInit) =>
    apiRequest(url, { ...options, method: 'GET' }),

  post: (url: string, body?: any, options?: RequestInit) => {
    // 如果 body 是 FormData，不要 JSON.stringify
    const requestBody =
      body instanceof FormData
        ? body
        : typeof body === 'string'
        ? body
        : JSON.stringify(body)

    return apiRequest(url, {
      ...options,
      method: 'POST',
      body: requestBody,
    })
  },

  put: (url: string, body?: any, options?: RequestInit) => {
    const requestBody =
      body instanceof FormData
        ? body
        : typeof body === 'string'
        ? body
        : JSON.stringify(body)

    return apiRequest(url, {
      ...options,
      method: 'PUT',
      body: requestBody,
    })
  },

  delete: (url: string, options?: RequestInit) =>
    apiRequest(url, { ...options, method: 'DELETE' }),

  patch: (url: string, body?: any, options?: RequestInit) => {
    const requestBody =
      body instanceof FormData
        ? body
        : typeof body === 'string'
        ? body
        : JSON.stringify(body)

    return apiRequest(url, {
      ...options,
      method: 'PATCH',
      body: requestBody,
    })
  },
}
