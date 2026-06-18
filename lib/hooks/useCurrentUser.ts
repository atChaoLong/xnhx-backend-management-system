/**
 * 获取当前登录用户信息的 Hook
 * 通过服务端 API 获取用户档案，绕过 RLS 限制
 */

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'
import { Role } from '@/lib/permissions'
import { api } from '@/lib/fetch'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('UseCurrentUser')

interface CurrentUserState {
  user: User | null
  isLoading: boolean
  error: string | null
}

export function useCurrentUser() {
  const [state, setState] = useState<CurrentUserState>(() => {
    // 初始化时检查缓存
    if (typeof window !== 'undefined') {
      const cachedUser = sessionStorage.getItem('currentUser')
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser)
          const now = Date.now()
          // 缓存5分钟有效
          if (now - parsed.timestamp < 5 * 60 * 1000) {
            return {
              user: parsed.data,
              isLoading: false,
              error: null,
            }
          }
        } catch (e) {
          logger.warn('缓存数据解析失败', summarizeError(e))
          sessionStorage.removeItem('currentUser')
        }
      }
    }

    return {
      user: null,
      isLoading: true,
      error: null,
    }
  })

  useEffect(() => {
    // 如果已经有缓存且未过期，跳过加载
    if (state.user && !state.isLoading) {
      return
    }

    let mounted = true

    async function loadUser() {
      try {
        // 通过 API 获取用户档案（绕过 RLS）
        // api.get() 会自动添加 Authorization header
        const response = await api.get('/api/auth/profile')

        if (!response.ok) {
          if (response.status === 401) {
            // Token 过期或无效，清除本地存储
            if (typeof window !== 'undefined') {
              // 清除 token
              localStorage.removeItem('supabase.auth.session')
              localStorage.removeItem('supabase.auth.token')
              // 清除用户缓存
              sessionStorage.removeItem('currentUser')
              // 清除 Supabase session
              await supabase.auth.signOut()
            }

            setState({
              user: null,
              isLoading: false,
              error: null,
            })
            return
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const { data } = await response.json()

        const userData = {
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.avatar_url,
          role: (data.role || 'sales') as Role,
          createdAt: data.created_at,
        }

        // 缓存用户信息（5分钟）
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('currentUser', JSON.stringify({
            data: userData,
            timestamp: Date.now()
          }))
        }

        if (mounted) {
          setState({
            user: userData,
            isLoading: false,
            error: null,
          })
        }
      } catch (err: unknown) {
        logger.warn('加载用户失败', summarizeError(err))
        if (mounted) {
          setState({
            user: null,
            isLoading: false,
            error: '加载用户信息失败',
          })
        }
      }
    }

    loadUser()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        // 清除缓存
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('currentUser')
        }
        setState({
          user: null,
          isLoading: false,
          error: null,
        })
      } else {
        // 认证状态变化时重新加载用户信息（清除缓存）
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('currentUser')
        }
        loadUser()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [state.user, state.isLoading])

  return state
}
