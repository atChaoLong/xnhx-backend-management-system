/**
 * 初始化超级管理员
 * 用于系统中第一次创建超级管理员账号
 * 注意：此接口应该在系统初始化后立即使用，使用后应删除或禁用
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Init:Admin')
const INIT_ADMIN_SECRET_HEADER = 'x-init-admin-secret'

function isInitAdminApiEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_INIT_ADMIN_API === 'true'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function summarizeIdentifier(identifier: string) {
  return {
    input_type: identifier.includes('@') ? 'email' : 'account',
    input_length: identifier.length,
    has_at: identifier.includes('@'),
  }
}

function summarizeError(error: unknown) {
  const errorRecord: Record<string, unknown> = isRecord(error) ? error : {}
  const message = error instanceof Error ? error.message : normalizeString(errorRecord.message)
  const stack = error instanceof Error ? error.stack : normalizeString(errorRecord.stack)

  return {
    name: error instanceof Error ? error.name : normalizeString(errorRecord.name),
    code: normalizeString(errorRecord.code),
    status: typeof errorRecord.status === 'number' ? errorRecord.status : undefined,
    has_message: Boolean(message),
    has_stack: Boolean(stack),
  }
}

async function readInitAdminBody(request: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    const parsedBody = await request.json()
    if (!isRecord(parsedBody)) {
      return NextResponse.json(
        { error: '请求体格式无效' },
        { status: 400 }
      )
    }

    return parsedBody
  } catch (error: any) {
    logger.warn('解析初始化管理员请求体失败', summarizeError(error))
    return NextResponse.json(
      { error: '请求体格式无效' },
      { status: 400 }
    )
  }
}

function validateInitAdminSecret(
  request: NextRequest,
  body?: Record<string, unknown>
): NextResponse | null {
  if (!isInitAdminApiEnabled()) {
    logger.warn('初始化管理员接口未启用：生产环境缺少 ENABLE_INIT_ADMIN_API=true')
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  }

  const configuredSecret = process.env.INIT_ADMIN_SECRET

  if (!configuredSecret) {
    logger.warn('初始化管理员接口未启用：缺少 INIT_ADMIN_SECRET')
    return NextResponse.json(
      { error: '初始化管理员接口未启用' },
      { status: 403 }
    )
  }

  const headerSecret = request.headers.get(INIT_ADMIN_SECRET_HEADER)
  const bodySnakeSecret = normalizeString(body?.init_admin_secret)
  const bodyCamelSecret = normalizeString(body?.initAdminSecret)
  const providedSecret =
    headerSecret ||
    bodySnakeSecret ||
    bodyCamelSecret

  if (providedSecret !== configuredSecret) {
    logger.warn('初始化管理员密钥校验失败', {
      has_header_secret: Boolean(headerSecret),
      has_body_secret: Boolean(bodySnakeSecret || bodyCamelSecret),
    })
    return NextResponse.json(
      { error: '初始化管理员密钥无效' },
      { status: 403 }
    )
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await readInitAdminBody(request)
    if (body instanceof NextResponse) return body

    const secretError = validateInitAdminSecret(request, body)
    if (secretError) return secretError

    const email = normalizeString(body.email)
    const password = typeof body.password === 'string' ? body.password : null
    const fullName = normalizeString(body.full_name)

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { error: '账号/邮箱和密码为必填项' },
        { status: 400 }
      )
    }

    // 处理账号或邮箱
    // 如果输入包含 @，当作邮箱直接使用
    // 如果不包含 @，当作账号，自动拼接成 @xiaoniuhaoxue.com
    let finalEmail = email
    if (!email.includes('@')) {
      finalEmail = `${email}@xiaoniuhaoxue.com`
      logger.info('初始化账号已转换为邮箱格式', {
        identifier: summarizeIdentifier(email),
      })
    }

    const username = finalEmail.split('@')[0]
    const profileName = fullName || username

    logger.info('开始创建超级管理员', {
      identifier: summarizeIdentifier(email),
      has_name: Boolean(fullName),
    })

    // 检查是否已经存在超级管理员
    const { data: existingAdmins, error: checkError } = await supabaseServer
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')

    if (checkError) {
      logger.error('检查现有管理员失败', summarizeError(checkError))
      return NextResponse.json(
        { error: '检查现有管理员失败' },
        { status: 500 }
      )
    }

    if (existingAdmins && existingAdmins.length > 0) {
      logger.warn('超级管理员已存在', { count: existingAdmins.length })
      return NextResponse.json(
        {
          error: '超级管理员已存在',
          count: existingAdmins.length,
        },
        { status: 400 }
      )
    }

    // 使用 Supabase Admin API 创建用户
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: profileName,
        role: 'admin',
      },
    })

    if (createError || !user) {
      logger.error('创建用户失败', {
        ...summarizeError(createError),
        has_created_user: Boolean(user),
      })
      return NextResponse.json(
        { error: '创建用户失败，请检查初始化参数或服务配置' },
        { status: 500 }
      )
    }

    // 创建用户档案
    // 策略：先检查是否已存在该 ID 的 profile，如果有则删除
    // 然后直接使用 supabaseAdmin 插入（绕过 RLS）

    logger.info('检查并清理可能存在的旧 profile', { userId: user.id })

    // 1. 检查是否已存在该 ID 的 profile
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile) {
      logger.warn('发现已存在的 profile，准备删除', { userId: user.id })
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', user.id)
      logger.info('旧 profile 已删除', { userId: user.id })
    }

    // 2. 使用 supabaseAdmin 创建 profile（绕过 RLS）
    logger.info('创建 user_profile', { userId: user.id })
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: user.id,
        username,
        name: profileName,
        email: finalEmail,
        role: 'admin',
        team_name: '小牛好学',
        is_active: true,
      })

    if (profileError) {
      logger.error('创建用户档案失败', {
        ...summarizeError(profileError),
        userId: user.id
      })
      // 删除已创建的用户
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json(
        { error: '创建用户档案失败' },
        { status: 500 }
      )
    }

    logger.info('超级管理员创建成功', {
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      message: '超级管理员创建成功',
      data: {
        user: {
          id: user.id,
        },
      },
      instructions: [
        '请保存好管理员账号信息',
        '建议首次登录后立即修改密码',
        '创建完成后应删除或禁用此初始化接口',
      ],
    })

  } catch (error: any) {
    logger.error('初始化管理员异常', summarizeError(error))
    return NextResponse.json(
      { error: '创建超级管理员失败' },
      { status: 500 }
    )
  }
}

// GET 方法返回初始化状态
export async function GET(request: NextRequest) {
  try {
    const secretError = validateInitAdminSecret(request)
    if (secretError) return secretError

    // 检查是否已存在超级管理员
    const { data: existingAdmins, error } = await supabaseServer
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')

    if (error) {
      logger.error('检查管理员状态失败', summarizeError(error))
      return NextResponse.json(
        { error: '检查管理员状态失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      initialized: existingAdmins && existingAdmins.length > 0,
      adminCount: existingAdmins?.length || 0,
      message: existingAdmins && existingAdmins.length > 0
        ? '超级管理员已初始化'
        : '尚未初始化超级管理员',
    })

  } catch (error: any) {
    logger.error('检查初始化管理员状态异常', summarizeError(error))
    return NextResponse.json(
      { error: '检查失败' },
      { status: 500 }
    )
  }
}
