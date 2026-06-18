import { NextResponse, NextRequest } from 'next/server'
import type { Session } from '@supabase/supabase-js'
import { supabaseAuthServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { revokeServerAuthSession } from '@/lib/server-auth-session-cleanup'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { setAuthCookies } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Signin')

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function summarizeIdentifier(identifier: string) {
  return {
    input_type: identifier.includes('@') ? 'email' : 'account',
    input_length: identifier.length,
    has_at: identifier.includes('@'),
  }
}

function buildClientSession(session: Session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user?.id ? { id: session.user.id } : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const body = isRecord(rawBody) ? rawBody : {}
    const email = normalizeString(body.email)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      logger.warn('登录请求缺少必填字段')
      return NextResponse.json(
        { error: '账号/邮箱和密码必填' },
        { status: 400 }
      )
    }

    // 处理账号或邮箱登录
    // 如果输入包含 @，当作邮箱直接使用
    // 如果不包含 @，当作账号，自动拼接成 @xiaoniuhaoxue.com
    let finalEmail = email
    if (!email.includes('@')) {
      finalEmail = `${email}@xiaoniuhaoxue.com`
      logger.info('账号转邮箱', {
        identifier_summary: summarizeIdentifier(email),
        used_default_domain: true,
      })
    }

    logger.info('用户登录尝试', {
      identifier_summary: summarizeIdentifier(email),
      has_password: true,
    })

    const { data, error } = await supabaseAuthServer.auth.signInWithPassword({
      email: finalEmail,
      password,
    })

    if (error) {
      logger.warn('认证失败', summarizeError(error))

      return NextResponse.json(
        {
          error: '账号或密码错误',
        },
        { status: 401 }
      )
    }

    const userId = data.user?.id
    if (!userId || !data.session) {
      logger.warn('登录成功但未返回完整 session', {
        hasUserId: Boolean(userId),
        hasSession: Boolean(data.session),
      })
      return NextResponse.json(
        { error: '登录失败，请稍后重试' },
        { status: 500 }
      )
    }

    const profileResult = await getActiveUserProfile(userId, {
      accessToken: data.session.access_token,
    })
    if (profileResult.ok === false) {
      logger.warn('登录后用户档案校验失败', {
        userId,
        code: profileResult.code,
      })
      await revokeServerAuthSession(data.session.access_token, {
        userId,
        reason: profileResult.code,
      })
      return NextResponse.json(
        {
          error: profileResult.error,
          code: profileResult.code,
        },
        { status: profileResult.status }
      )
    }

    logger.info('登录成功', { userId })

    const response = NextResponse.json({
      data: buildClientSession(data.session),
    })
    setAuthCookies(response, data.session)
    return response
  } catch (error: unknown) {
    logger.error('登录 API 异常', summarizeError(error))
    return NextResponse.json(
      {
        error: '登录失败，请稍后重试',
      },
      { status: 500 }
    )
  }
}
