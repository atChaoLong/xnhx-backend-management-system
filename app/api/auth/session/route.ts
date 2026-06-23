import { supabaseServer } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Session')

function decodeJwtPayload(token: string): { sub?: string; email?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

function sessionJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const token = getRequestAccessToken(request)

    if (!token) {
      logger.warn('Session 验证请求缺少 token')
      return sessionJson(
        { error: '未认证', hint: '未找到 Authorization header 或登录 cookie' },
        { status: 401 }
      )
    }

    const payload = decodeJwtPayload(token)
    if (!payload?.sub) {
      logger.warn('Token 解码失败')
      return sessionJson(
        { error: '未认证', hint: '请重新登录' },
        { status: 401 }
      )
    }

    const userId = payload.sub

    const profileResult = await getActiveUserProfile(userId, { accessToken: token })
    if (profileResult.ok === false) {
      logger.warn('Session 用户档案校验失败', {
        userId,
        code: profileResult.code,
      })
      return sessionJson(
        {
          error: profileResult.error,
          code: profileResult.code,
          hint: '请联系管理员',
        },
        { status: profileResult.status }
      )
    }

    const profile = profileResult.profile

    logger.debug('Session 验证成功', { userId })
    return sessionJson({
      data: {
        user: {
          id: userId,
          email: profile.email || payload.email,
          name: profile.name || payload.email?.split('@')[0],
          role: profile.role,
        },
      },
    })
  } catch (error: unknown) {
    logger.error('Session API 异常', summarizeError(error))
    return sessionJson(
      { error: '未授权' },
      { status: 401 }
    )
  }
}
