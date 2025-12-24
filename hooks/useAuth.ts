'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/fetch'
import { createLogger } from '@/lib/logger'

const logger = createLogger('useAuth')

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('supabase.auth.token')
          : null

        logger.debug('检查会话状态', { hasToken: !!token })

        const response = await api.get('/api/auth/session')

        if (response.ok) {
          const { data } = await response.json()
          if (data.user) {
            logger.info('用户已登录', { email: data.user.email })
            setUser(data.user)
          }
        } else {
          logger.debug('会话无效或已过期')
        }
      } catch (err) {
        logger.error('会话检查错误', { message: err instanceof Error ? err.message : String(err) })
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('supabase.auth.token')
    setUser(null)

    try {
      await api.post('/api/auth/signout')
      logger.info('用户已登出')
    } catch (err) {
      logger.error('登出错误', { message: err instanceof Error ? err.message : String(err) })
    }

    router.push('/login')
  }, [router])

  return {
    user,
    isLoading,
    handleLogout,
  }
}
