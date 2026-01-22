import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Signup')

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      logger.warn('注册请求缺少必填字段')
      return NextResponse.json(
        { error: '账号/邮箱和密码必填' },
        { status: 400 }
      )
    }

    // 处理账号或邮箱注册
    // 如果输入包含 @，当作邮箱直接使用
    // 如果不包含 @，当作账号，自动拼接成 @xiaoniuhaoxue.com
    let finalEmail = email
    let finalName = name

    if (!email.includes('@')) {
      finalEmail = `${email}@xiaoniuhaoxue.com`
      // 如果没有提供name，使用账号作为name
      if (!finalName) {
        finalName = email
      }
      logger.info('账号转邮箱', { account: email, email: finalEmail, name: finalName })
    }

    logger.info('用户注册尝试', { input: email, finalEmail, name: finalName })

    const { data, error } = await supabaseServer.auth.signUp({
      email: finalEmail,
      password,
      options: {
        data: {
          name: finalName || finalEmail.split('@')[0],
          role: 'user',
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
      },
    })

    if (error) {
      logger.error('注册失败', { message: error.message, status: error.status })
      return NextResponse.json(
        { error: error.message || '注册失败' },
        { status: 400 }
      )
    }

    logger.info('注册成功', { userId: data.user?.id, email: data.user?.email })

    return NextResponse.json({
      data: {
        session: data.session,
        user: data.user,
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
        message: '注册成功',
      },
    })
  } catch (error: any) {
    logger.error('注册 API 异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '注册失败' },
      { status: 500 }
    )
  }
}
