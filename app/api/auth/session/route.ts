import { supabaseServer } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Session')

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      logger.warn('Session 验证请求缺少 token')
      return NextResponse.json(
        { error: '未认证', hint: '未找到 Authorization header 或 token' },
        { status: 401 }
      )
    }

    logger.debug('验证用户 session', { tokenLength: token?.length })

    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    if (error || !user) {
      logger.warn('Token 验证失败', {
        error: error?.message,
        status: error?.status,
      })
      return NextResponse.json(
        {
          error: '未认证',
          details: error?.message || '无效的 token 或 token 已过期',
          hint: '请重新登录',
        },
        { status: 401 }
      )
    }

    logger.debug('Session 验证成功', { userId: user.id, email: user.email })
    return NextResponse.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0],
          role: user.user_metadata?.role || 'user',
        },
      },
    })
  } catch (error: any) {
    logger.error('Session API 异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: '未授权', details: error.message },
      { status: 401 }
    )
  }
}
