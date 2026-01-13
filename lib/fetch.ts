/**
 * 统一的 fetch wrapper - 自动添加认证 headers
 * 所有 API 请求都应该使用这个而不是直接调用 fetch
 */

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

  // 处理 401 错误：清除过期的认证信息
  if (response.status === 401 && typeof window !== 'undefined') {
    // 检查是否是 token 相关的错误
    const responseClone = response.clone()

    responseClone.json().then(data => {
      const errorMsg = data.error || ''

      // 如果是认证相关的错误，清除本地存储
      if (errorMsg.includes('过期') || errorMsg.includes('登录') || errorMsg.includes('token')) {
        console.warn('Token 已过期或无效，清除本地认证信息')

        // 清除 token
        localStorage.removeItem('supabase.auth.token')
        // 清除用户缓存
        sessionStorage.removeItem('currentUser')

        // 触发自定义事件，通知其他组件
        window.dispatchEvent(new Event('auth:expired'))
      }
    }).catch(() => {
      // JSON 解析失败，也清除本地存储（保险起见）
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.removeItem('currentUser')
    })
  }

  return response
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
