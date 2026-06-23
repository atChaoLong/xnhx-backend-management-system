/**
 * 获取当前用户档案信息
 * 使用服务端客户端绕过 RLS
 */
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Profile')

function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return payload?.sub || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = getRequestAccessToken(request)

    if (!token) {
      logger.warn('未找到访问令牌')
      return NextResponse.json(
        { error: '未认证' },
        { status: 401 }
      )
    }

    const userId = decodeJwtUserId(token)
    if (!userId) {
      logger.warn('Token 解码失败')
      return NextResponse.json(
        { error: '无效的认证令牌' },
        { status: 401 }
      )
    }

    const profileResult = await getActiveUserProfile(userId, { accessToken: token })

    if (profileResult.ok === false) {
      logger.warn('用户档案校验失败', {
        userId,
        code: profileResult.code,
      })
      return NextResponse.json(
        {
          error: profileResult.error,
          code: profileResult.code,
        },
        { status: profileResult.status }
      )
    }

    logger.debug('获取用户档案成功', { userId, hasProfile: true })

    return NextResponse.json({
      data: profileResult.profile,
    })
  } catch (error: unknown) {
    logger.error('获取用户档案异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取用户档案失败' },
      { status: 500 }
    )
  }
}
