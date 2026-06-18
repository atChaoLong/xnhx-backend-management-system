import { NextRequest, NextResponse } from "next/server"
import type { Session } from "@supabase/supabase-js"
import { supabaseAuthServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getErrorMessage, summarizeError } from "@/lib/safe-error"
import { revokeServerAuthSession } from "@/lib/server-auth-session-cleanup"
import { getActiveUserProfile } from "@/lib/server-active-profile"
import { setAuthCookies } from "@/lib/server-auth-token"

const logger = createLogger('API:Auth:Refresh')

function buildClientSession(session: Session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user?.id ? { id: session.user.id } : null,
  }
}

// POST: 刷新 access_token
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody as Record<string, any> : {}
    const refresh_token = typeof body.refresh_token === 'string' ? body.refresh_token : ''

    if (!refresh_token) {
      return NextResponse.json(
        { error: '缺少 refresh_token' },
        { status: 400 }
      )
    }

    logger.debug('开始刷新 token')

    // 使用 Supabase SDK 刷新 session
    const { data, error } = await supabaseAuthServer.auth.refreshSession({
      refresh_token
    })

    if (error) {
      logger.warn('刷新 token 失败', summarizeError(error))

      // 判断错误类型
      const refreshErrorMessage = getErrorMessage(error)
      if (refreshErrorMessage.includes('Invalid refresh token') ||
          refreshErrorMessage.includes('refresh_token_expired')) {
        return NextResponse.json(
          { error: 'refresh_token 已过期或无效，请重新登录' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: '刷新 token 失败，请重新登录' },
        { status: 401 }
      )
    }

    if (!data.session) {
      logger.error('刷新失败：session 为空')
      return NextResponse.json(
        { error: '刷新失败，未返回有效 session' },
        { status: 401 }
      )
    }

    const userId = data.session.user?.id
    if (!userId) {
      logger.warn('刷新成功但未返回用户 ID')
      return NextResponse.json(
        { error: '刷新 token 失败，请重新登录' },
        { status: 401 }
      )
    }

    const profileResult = await getActiveUserProfile(userId, {
      accessToken: data.session.access_token,
    })
    if (profileResult.ok === false) {
      logger.warn('刷新后用户档案校验失败', {
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

    logger.info('刷新 token 成功', {
      userId: data.session.user?.id,
      expiresAt: data.session.expires_at
    })

    // 返回前端刷新所需的最小 session 数据，避免把完整 Supabase user 写入 localStorage。
    const response = NextResponse.json({
      data: buildClientSession(data.session)
    })
    setAuthCookies(response, data.session)
    return response

  } catch (error: unknown) {
    logger.error('刷新 token 异常', summarizeError(error))
    return NextResponse.json(
      { error: '刷新 token 失败' },
      { status: 500 }
    )
  }
}
