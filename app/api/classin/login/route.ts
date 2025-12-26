import { NextRequest, NextResponse } from 'next/server'
import { getClassInApiClient } from '@/lib/services/classin'

/**
 * ClassIn 登录 API
 * POST /api/classin/login
 * Body: { cookie: string }
 */
export async function POST(request: NextRequest) {
  try {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '登录失败' },
      { status: 500 }
    )
  }
}
