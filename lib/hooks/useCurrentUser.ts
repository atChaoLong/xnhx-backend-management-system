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

interface CurrentUserState {
  user: User | null
  isLoading: boolean
  error: string | null
}

export function useCurrentUser() {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      try {
        // 通过 API 获取用户档案（绕过 RLS）
        // api.get() 会自动添加 Authorization header
        const response = await api.get('/api/auth/profile')

        if (!response.ok) {
          if (response.status === 401) {
            // 未登录
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

        if (mounted) {
          setState({
            user: {
              id: data.id,
              email: data.email,
              name: data.name,
              avatar: data.avatar_url,
              role: (data.role || 'sales') as Role,
              createdAt: data.created_at,
            },
            isLoading: false,
            error: null,
          })
        }
      } catch (err: any) {
        console.error('加载用户失败:', err)
        if (mounted) {
          setState({
            user: null,
            isLoading: false,
            error: err.message || '加载用户信息失败',
          })
        }
      }
    }

    loadUser()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({
          user: null,
          isLoading: false,
          error: null,
        })
      } else {
        loadUser()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
