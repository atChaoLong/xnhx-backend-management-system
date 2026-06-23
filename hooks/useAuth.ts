'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/fetch'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { tokenRefreshManager } from '@/lib/tokenRefreshManager'

const logger = createLogger('useAuth')
const LOGOUT_INTENT_KEY = 'xnhx_logout_intent'

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      // 先检查 sessionStorage 缓存（5分钟内有效），避免每次导航都调 /api/auth/session
      if (typeof window !== 'undefined') {
        const cachedUser = sessionStorage.getItem('currentUser')
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser)
            if (Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.data) {
              setUser(parsed.data)
              setIsLoading(false)
              return
            }
          } catch {
            sessionStorage.removeItem('currentUser')
          }
        }
      }

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
          setUser(null)
        }
      } catch (err) {
        logger.error('会话检查错误', { message: err instanceof Error ? err.message : String(err) })
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  const handleLogout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOGOUT_INTENT_KEY, String(Date.now()))
      try {
        await fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        })
      } catch (error: unknown) {
        logger.warn('服务端登出请求失败，继续清理本地会话', summarizeError(error))
      }

      tokenRefreshManager.clearSession()
      setUser(null)
      window.location.replace('/login')
      return
    }

    tokenRefreshManager.clearSession()
    setUser(null)
    logger.info('用户已登出')
    router.replace('/login')
  }, [router])

  return {
    user,
    isLoading,
    handleLogout,
  }
}
