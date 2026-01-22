import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Auth:Refresh')

// POST: 刷新 access_token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refresh_token } = body

    if (!refresh_token) {
      return NextResponse.json(
        { error: '缺少 refresh_token' },
        { status: 400 }
      )
    }

    logger.debug('开始刷新 token')

    // 使用 Supabase SDK 刷新 session
    const { data, error } = await supabaseServer.auth.refreshSession({
      refresh_token
    })

    if (error) {
      logger.warn('刷新 token 失败', { message: error.message })

      // 判断错误类型
      if (error.message.includes('Invalid refresh token') ||
          error.message.includes('refresh_token_expired')) {
        return NextResponse.json(
          { error: 'refresh_token 已过期或无效，请重新登录' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: error.message },
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

    logger.info('刷新 token 成功', {
      userId: data.session.user?.id,
      expiresAt: data.session.expires_at
    })

    // 返回新的 session 数据
    return NextResponse.json({
      data: {
        session: data.session,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: data.session.user
      }
    })

  } catch (error: any) {
    logger.error('刷新 token 异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: '刷新 token 失败' },
      { status: 500 }
    )
  }
}
