'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/fetch'

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 检查 localStorage 中的 token
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('supabase.auth.token')
          : null

        console.log('检查会话 - 前端:', {
          hasToken: !!token,
          tokenLength: token?.length,
        })

        // api.get() 会自动添加 Authorization header
        const response = await api.get('/api/auth/session')

        console.log('会话检查响应:', {
          ok: response.ok,
          status: response.status,
        })

        if (response.ok) {
          const { data } = await response.json()
          if (data.user) {
            console.log('会话有效，用户已登录:', data.user.email)
            setUser(data.user)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.log('会话无效或已过期:', errorData)
        }
      } catch (err) {
        console.error('会话检查错误:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  const handleLogout = useCallback(async () => {
    // 清除 localStorage 中的 token
    localStorage.removeItem('supabase.auth.token')
    setUser(null)

    // 调用后端登出
    try {
      await api.post('/api/auth/signout')
    } catch (err) {
      console.error('登出错误:', err)
    }

    router.push('/login')
  }, [router])

  return {
    user,
    isLoading,
    handleLogout,
  }
}
