import { supabaseAuthServer } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Session')

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

    logger.debug('验证用户 session')

    const { data: { user }, error } = await supabaseAuthServer.auth.getUser(token)

    if (error || !user) {
      logger.warn('Token 验证失败', error ? summarizeError(error) : { has_user: false })
      return sessionJson(
        {
          error: '未认证',
          hint: '请重新登录',
        },
        { status: 401 }
      )
    }

    const profileResult = await getActiveUserProfile(user.id, { accessToken: token })
    if (profileResult.ok === false) {
      logger.warn('Session 用户档案校验失败', {
        userId: user.id,
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

    logger.debug('Session 验证成功', { userId: user.id })
    return sessionJson({
      data: {
        user: {
          id: user.id,
          email: profile.email || user.email,
          name: profile.name || user.email?.split('@')[0],
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
