/**
 * 统一的 fetch wrapper - 自动添加认证 headers
 * 所有 API 请求都应该使用这个而不是直接调用 fetch
 */

import { tokenRefreshManager } from './tokenRefreshManager'

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 获取 token
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('supabase.auth.token') : null

  const headers = new Headers(options.headers || {})

  // 如果有 token，添加 Authorization header
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

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // 处理 401 错误：尝试刷新 token 并重试
  if (response.status === 401 && typeof window !== 'undefined') {
    const responseClone = response.clone()

    try {
      const data = await responseClone.json()
      const errorMsg = data.error || ''

      // 如果是 refresh_token 相关错误，直接清除（无法刷新）
      if (errorMsg.includes('refresh_token') || errorMsg.includes('refresh token')) {
        console.warn('refresh_token 已过期，清除认证信息')
        clearAuthAndRedirect()
        return response
      }

      // 其他 401 错误：尝试刷新 token
      console.log('Token 已过期，尝试刷新并重试')

      const newSession = await tokenRefreshManager.refreshToken()

      if (newSession) {
        console.log('Token 刷新成功，重试原请求')

        // 使用新 token 重试原请求
        const newHeaders = new Headers(options.headers || {})
        newHeaders.set('Authorization', `Bearer ${newSession.access_token}`)

        return fetch(url, {
          ...options,
          headers: newHeaders,
        })
      } else {
        // 刷新失败，清除认证信息
        console.warn('Token 刷新失败，清除认证信息')
        clearAuthAndRedirect()
      }
    } catch (error) {
      // JSON 解析失败或其他错误，清除认证信息（保险起见）
      console.error('处理 401 错误失败', { error })
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

  // 清除所有认证信息
  localStorage.removeItem('supabase.auth.session')
  localStorage.removeItem('supabase.auth.token')
  localStorage.removeItem('user')
  sessionStorage.removeItem('currentUser')

  // 触发登出事件
  window.dispatchEvent(new Event('auth:expired'))

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
