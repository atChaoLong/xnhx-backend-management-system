"use client"

import { useEffect, useRef } from 'react'
import { tokenRefreshManager } from '@/lib/tokenRefreshManager'
import { createLogger } from '@/lib/logger'

const logger = createLogger('useTokenRefresh')

interface TokenRefreshConfig {
  /** 检查间隔（毫秒），默认 30000（30秒） */
  checkInterval?: number
  /** 提前刷新时间（秒），默认 300（5分钟） */
  bufferSeconds?: number
}

/**
 * Token 自动刷新 Hook
 * 定时检查 token 是否即将过期，如果即将过期则自动刷新
 * 同时处理多标签页同步
 */
export function useTokenRefresh(config: TokenRefreshConfig = {}) {
  const {
    checkInterval = 30000, // 30 秒
    bufferSeconds = 300,   // 5 分钟
  } = config

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    // 只在客户端运行
    if (typeof window === 'undefined') return

    // 检查是否有 session
    const session = tokenRefreshManager['getSession']?.() || null
    if (!session) {
      logger.debug('没有 session，跳过 token 刷新')
      return
    }

    logger.debug('启动 token 自动刷新', {
      checkInterval,
      bufferSeconds
    })

    // 创建 BroadcastChannel 用于多标签页同步
    try {
      broadcastChannelRef.current = new BroadcastChannel('token-refresh')
      logger.debug('BroadcastChannel 已创建')
    } catch (error) {
      // 浏览器可能不支持 BroadcastChannel
      logger.warn('浏览器不支持 BroadcastChannel', { error })
    }

    // 定时检查 token
    const intervalId = setInterval(() => {
      if (tokenRefreshManager.isTokenExpiringSoon(bufferSeconds)) {
        logger.info('token 即将过期，开始刷新')
        refreshToken()
      }
    }, checkInterval)

    // 监听其他标签页的刷新事件
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'supabase.auth.session' && event.newValue) {
        logger.debug('检测到其他标签页更新了 session')
        try {
          const newSession = JSON.parse(event.newValue)

          // 触发自定义事件
          window.dispatchEvent(new CustomEvent('token:updated', {
            detail: { session: newSession }
          }))
        } catch (error) {
          logger.error('解析其他标签页的 session 失败', { error })
        }
      }
    }

    // 监听 BroadcastChannel 消息
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data.type === 'TOKEN_REFRESHED') {
        logger.debug('收到其他标签页的刷新通知')

        // 更新本地 session
        if (event.data.session) {
          try {
            localStorage.setItem(
              'supabase.auth.session',
              JSON.stringify(event.data.session)
            )

            // 更新 access_token
            if (event.data.session.access_token) {
              localStorage.setItem(
                'supabase.auth.token',
                event.data.session.access_token
              )
            }

            // 触发自定义事件
            window.dispatchEvent(new CustomEvent('token:updated', {
              detail: { session: event.data.session }
            }))
          } catch (error) {
            logger.error('同步其他标签页的 session 失败', { error })
          }
        }
      }
    }

    // 监听 localStorage 变化（兼容不支持 BroadcastChannel 的浏览器）
    window.addEventListener('storage', handleStorageChange)

    // 监听 BroadcastChannel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.addEventListener('message', handleBroadcastMessage)
    }

    // 清理函数
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('storage', handleStorageChange)

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.removeEventListener('message', handleBroadcastMessage)
        broadcastChannelRef.current.close()
        broadcastChannelRef.current = null
      }

      logger.debug('token 自动刷新已停止')
    }
  }, [checkInterval, bufferSeconds])

  /**
   * 刷新 token 并通知其他标签页
   */
  const refreshToken = async () => {
    try {
      const session = await tokenRefreshManager.refreshToken()

      if (!session) {
        logger.warn('token 刷新失败，可能需要重新登录')
        return
      }

      // 通知其他标签页
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'TOKEN_REFRESHED',
          session
        })
        logger.debug('已通知其他标签页 token 已刷新')
      }

    } catch (error) {
      logger.error('token 刷新异常', { error })
    }
  }

  return {
    refreshToken,
    isTokenExpiringSoon: () => tokenRefreshManager.isTokenExpiringSoon(bufferSeconds),
  }
}
