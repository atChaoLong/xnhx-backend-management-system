/**
 * 获取当前用户档案信息
 * 使用服务端客户端绕过 RLS
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuthServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Profile')

export async function GET(request: NextRequest) {
  try {
    // 1. 从 Authorization header 或登录 cookie 获取 token
    const token = getRequestAccessToken(request)

    if (!token) {
      logger.warn('未找到访问令牌')
      return NextResponse.json(
        { error: '未认证' },
        { status: 401 }
      )
    }

    // 2. 使用 token 验证用户
    const { data: { user }, error: authError } = await supabaseAuthServer.auth.getUser(token)

    if (authError || !user) {
      logger.warn('获取用户失败', summarizeError(authError))
      return NextResponse.json(
        { error: '无效的认证令牌' },
        { status: 401 }
      )
    }

    // 3. 获取用户档案（使用服务端客户端，绕过 RLS），并拦截停用账号
    const profileResult = await getActiveUserProfile(user.id, { accessToken: token })

    if (profileResult.ok === false) {
      logger.warn('用户档案校验失败', {
        userId: user.id,
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

    logger.debug('获取用户档案成功', { userId: user.id, hasProfile: true })

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
