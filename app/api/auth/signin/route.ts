import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Signin')

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      logger.warn('登录请求缺少必填字段')
      return NextResponse.json(
        { error: '邮箱和密码必填' },
        { status: 400 }
      )
    }

    logger.info('用户登录尝试', { email, passwordLength: password?.length })

    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logger.error('认证失败', {
        message: error.message,
        status: error.status,
        name: error.name,
      })

      return NextResponse.json(
        {
          error: error.message || '认证失败',
          hint: '请确认已在 Supabase 中创建用户账户',
        },
        { status: 401 }
      )
    }

    logger.info('登录成功', { userId: data.user?.id, email: data.user?.email })

    return NextResponse.json({
      data: {
        session: data.session,
        user: data.user,
        access_token: data.session?.access_token,
      },
    })
  } catch (error: any) {
    logger.error('登录 API 异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      {
        error: error.message || '登录失败',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}
