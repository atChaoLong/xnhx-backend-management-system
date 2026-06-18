import { NextResponse, NextRequest } from 'next/server'
import { supabaseAuthServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { revokeServerAuthSession } from '@/lib/server-auth-session-cleanup'

const logger = createLogger('Auth:Signup')

function isPublicSignupEnabled() {
  return process.env.ENABLE_PUBLIC_SIGNUP === 'true'
}

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

export async function POST(request: NextRequest) {
  try {
    if (!isPublicSignupEnabled()) {
      logger.warn('公开注册接口被拒绝：未启用 ENABLE_PUBLIC_SIGNUP')
      return NextResponse.json(
        { error: '公开注册已关闭，请联系管理员创建账号' },
        { status: 404 }
      )
    }

    const rawBody = await request.json()
    const body = isRecord(rawBody) ? rawBody : {}
    const email = normalizeString(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    const name = normalizeString(body.name)

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
      logger.info('账号转邮箱', {
        identifier_summary: summarizeIdentifier(email),
        used_default_domain: true,
        has_name: Boolean(finalName),
      })
    }

    logger.info('用户注册尝试', {
      identifier_summary: summarizeIdentifier(email),
      has_name: Boolean(finalName),
    })

    const { data, error } = await supabaseAuthServer.auth.signUp({
      email: finalEmail,
      password,
      options: {
        data: {
          name: finalName || finalEmail.split('@')[0],
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
      },
    })

    if (error) {
      logger.warn('注册失败', summarizeError(error))
      return NextResponse.json(
        { error: '注册失败，请稍后重试或联系管理员' },
        { status: 400 }
      )
    }

    const userId = data.user?.id ?? data.session?.user?.id ?? null

    if (data.session?.access_token) {
      await revokeServerAuthSession(data.session.access_token, {
        userId: userId ?? 'unknown',
        reason: 'PUBLIC_SIGNUP_PENDING_PROFILE',
      })
    }

    logger.info('注册成功', {
      userId,
      has_auto_session: Boolean(data.session?.access_token),
    })

    return NextResponse.json({
      data: {
        user: data.user
          ? {
              id: data.user.id,
            }
          : null,
        message: '注册申请已提交，请联系管理员分配角色后再登录',
      },
    })
  } catch (error: unknown) {
    logger.error('注册 API 异常', summarizeError(error))
    return NextResponse.json(
      { error: '注册失败，请稍后重试或联系管理员' },
      { status: 500 }
    )
  }
}
