/**
 * 获取当前登录用户信息的 Hook
 * 从 Supabase 认证系统和 user_profiles 表获取完整用户信息
 */

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'
import { Role } from '@/lib/permissions'

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
        // 1. 获取 Supabase 认证用户
        const { data: { session }, error: authError } = await supabase.auth.getSession()

        if (authError) {
          throw authError
        }

        if (!session?.user) {
          setState({
            user: null,
            isLoading: false,
            error: null,
          })
          return
        }

        // 2. 从 user_profiles 表获取完整用户信息
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('加载用户档案失败:', profileError)
        }

        // 3. 合并信息
        if (mounted) {
          setState({
            user: {
              id: session.user.id,
              email: session.user.email || '',
              name: profile?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || '未知用户',
              avatar: profile?.avatar_url || session.user.user_metadata?.avatar_url,
              role: (profile?.role || 'sales') as Role, // 默认角色为 sales
              createdAt: profile?.created_at || session.user.created_at || new Date().toISOString(),
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
