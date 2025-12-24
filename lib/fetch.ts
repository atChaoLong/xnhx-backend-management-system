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

  return fetch(url, {
    ...options,
    headers,
  })
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
