import { NextRequest, NextResponse } from 'next/server'
import { getClassInApiClient } from '@/lib/services/classin'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('ClassIn:Login')

/**
 * ClassIn 登录 API
 * POST /api/classin/login
 * Body: { cookie: string }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()
    const { cookie } = body

    if (!cookie) {
      return NextResponse.json(
        { error: 'Cookie 不能为空' },
        { status: 400 }
      )
    }

    // 使用提供的 Cookie 登录
    const apiClient = getClassInApiClient()
    const session = apiClient.loginWithCookie(cookie)

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    })
  } catch (error: unknown) {
    logger.error('ClassIn Cookie 登录失败', summarizeError(error))
    return NextResponse.json(
      { error: '登录失败' },
      { status: 500 }
    )
  }
}
