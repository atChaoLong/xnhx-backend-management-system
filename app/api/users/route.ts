/**
 * 用户管理 API
 * GET: 获取所有用户列表（包含角色信息）
 * POST: 创建新用户（同时创建auth.users和user_profiles）
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'

const logger = createLogger('API:Users')

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

const VALID_ROLES = ['admin', 'operator', 'sales', 'head_teacher', 'teacher', 'academic_affairs', 'finance', 'teacher_recruiter', 'hr']
const USER_DIRECTORY_SELECT = 'id, name, email, role, created_at'
const USER_ADMIN_SELECT = `
  id,
  username,
  name,
  email,
  phone,
  wechat,
  avatar_url,
  role,
  team_name,
  is_active,
  created_at,
  updated_at
`
const USER_UPDATE_FIELDS = ['name', 'phone', 'wechat', 'team_name', 'role', 'is_active']

function isMissingProfileColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; details?: string; hint?: string }
  const code = String(err?.code || '').toUpperCase()
  const text = [err?.message, err?.details, err?.hint].filter(Boolean).join(' ').toLowerCase()

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (text.includes('column') && (text.includes('does not exist') || text.includes('could not find'))) ||
    text.includes('schema cache')
  )
}

function withAdminProfileDefaults(user: Record<string, any>) {
  return {
    username: null,
    phone: null,
    wechat: null,
    avatar_url: null,
    team_name: null,
    is_active: true,
    updated_at: user.created_at || null,
    ...user,
  }
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function summarizeUserPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_email: hasNonEmptyString(payload?.email),
    has_password: hasNonEmptyString(payload?.password),
    has_name: hasNonEmptyString(payload?.name),
    role: hasNonEmptyString(payload?.role) ? String(payload.role).trim() : undefined,
    has_phone: hasNonEmptyString(payload?.phone),
    has_wechat: hasNonEmptyString(payload?.wechat),
    has_team_name: hasNonEmptyString(payload?.team_name),
    has_is_active: payload?.is_active !== undefined,
  }
}

function profileUpdatePayload(body: Record<string, any>) {
  const updatePayload: Record<string, any> = {}

  ;['name', 'phone', 'wechat', 'team_name'].forEach((field) => {
    if (body[field] !== undefined) {
      updatePayload[field] = normalizedString(body[field]) || null
    }
  })

  if (body.role !== undefined) {
    const role = normalizedString(body.role)
    if (role) {
      updatePayload.role = role
    }
  }

  if (typeof body.is_active === 'boolean') {
    updatePayload.is_active = body.is_active
  } else if (body.is_active === 'true' || body.is_active === 'false') {
    updatePayload.is_active = body.is_active === 'true'
  }

  updatePayload.updated_at = new Date().toISOString()
  return updatePayload
}

// 验证用户是否为超级管理员
async function isAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    const token = getRequestAccessToken(request)

    if (!token) {
      return { isAdmin: false }
    }

    const userId = decodeJwtUserId(token)

    if (!userId) {
      return { isAdmin: false }
    }

    const profileResult = await getActiveUserProfile(userId, { accessToken: token })
    if (profileResult.ok === false) {
      logger.warn('管理员档案校验失败', {
        userId,
        code: profileResult.code,
      })
      return { isAdmin: false }
    }

    return {
      isAdmin: profileResult.profile.role === 'admin',
      userId
    }
  } catch (error) {
    logger.error('验证管理员权限失败', { error_summary: summarizeError(error) })
    return { isAdmin: false }
  }
}

/**
 * GET /api/users
 * 获取所有用户列表（包含角色信息）
 * 支持按角色筛选：?role=head_teacher
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const id = searchParams.get('id')

    // 如果是按角色筛选（如获取班主任列表），允许所有认证用户访问
    // 如果获取全部用户，需要管理员权限
    const { isAdmin: isAdminUser } = await isAdmin(request)

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: '无效的角色筛选' },
        { status: 400 }
      )
    }

    if (!role && !isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以查看全部用户列表' },
        { status: 403 }
      )
    }

    const useAdminFields = isAdminUser && !role
    const selectFields = useAdminFields ? USER_ADMIN_SELECT : USER_DIRECTORY_SELECT

    // 构建查询
    let query = supabaseServer
      .from('user_profiles')
      .select(selectFields)

    // 如果指定了角色，添加筛选条件
    if (role) {
      query = query.eq('role', role)
    }

    if (id) {
      query = query.eq('id', id)
    }

    // 获取用户列表
    const queryResult = await query.order('created_at', { ascending: false })
    let users = queryResult.data as Record<string, any>[] | null
    let error = queryResult.error

    if (error && useAdminFields && isMissingProfileColumnError(error)) {
      logger.warn('用户管理字段未完全迁移，降级使用基础用户字段', {
        error_summary: summarizeError(error),
      })

      let fallbackQuery = supabaseServer
        .from('user_profiles')
        .select(USER_DIRECTORY_SELECT)

      if (id) {
        fallbackQuery = fallbackQuery.eq('id', id)
      }

      const fallbackResult = await fallbackQuery.order('created_at', { ascending: false })
      users = fallbackResult.data?.map((user) => withAdminProfileDefaults(user as Record<string, any>)) || null
      error = fallbackResult.error
    }

    if (error) {
      logger.error('获取用户列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取用户列表失败' },
        { status: 500 }
      )
    }

    if (id) {
      const user = users?.[0]

      if (!user) {
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: user,
      })
    }

    return NextResponse.json({
      success: true,
      data: users || [],
    })

  } catch (error: any) {
    logger.error('获取用户列表错误', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * 创建新用户（同时创建auth.users和user_profiles）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser, userId: adminUserId } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以创建用户' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const account = normalizedString(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    const phone = normalizedString(body.phone)
    const name = normalizedString(body.name)
    const role = normalizedString(body.role)
    const teamName = normalizedString(body.team_name)
    const wechat = normalizedString(body.wechat)
    const bodySummary = summarizeUserPayload(body)

    logger.info('创建用户请求', { body_summary: bodySummary })

    // 验证必填字段
    if (!account || !password || !role) {
      return NextResponse.json(
        { error: '账号/邮箱、密码和角色为必填项' },
        { status: 400 }
      )
    }

    // 处理账号或邮箱
    // 如果输入包含 @，当作邮箱直接使用
    // 如果不包含 @，当作账号，自动拼接成 @xiaoniuhaoxue.com
    let finalEmail = account
    if (!account.includes('@')) {
      finalEmail = `${account}@xiaoniuhaoxue.com`
      logger.info('账号转邮箱', { role, has_name: Boolean(name) })
    }
    const username = finalEmail.split('@')[0]
    const displayName = name || username

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度不能少于6位' },
        { status: 400 }
      )
    }

    // 验证角色是否有效
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `无效的角色，必须是以下之一: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    logger.info('创建用户', {
      body_summary: {
        ...bodySummary,
        role,
      },
    })

    // 创建用户（使用 admin API client）
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true, // 自动确认邮箱
      user_metadata: {
        name: displayName,
        role: role,
      },
    })

    if (createError || !user) {
      logger.error('创建用户失败', { error_summary: summarizeError(createError) })
      return NextResponse.json(
        { error: '创建用户失败' },
        { status: 500 }
      )
    }

    // 创建用户档案
    // 策略：直接使用 supabaseAdmin 插入（绕过 RLS），避免重复插入问题
    logger.info('创建 user_profile', { userId: user.id, role })

    // 1. 检查是否已存在该 ID 的 profile
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      logger.warn('发现已存在的 profile，准备删除', { userId: user.id })
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', user.id)
      logger.info('旧 profile 已删除', { userId: user.id })
    }

    // 2. 使用 supabaseAdmin 创建 profile（绕过 RLS）
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: user.id,
        username,
        name: displayName,
        email: finalEmail,
        phone: phone || null,
        wechat: wechat || null,
        role: role,
        team_name: teamName || null,
        is_active: true,
      })
      .select(USER_ADMIN_SELECT)
      .single()

    if (profileError) {
      logger.error('创建用户档案失败', {
        userId: user.id,
        error_summary: summarizeError(profileError),
      })
      // 删除已创建的认证用户
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json(
        { error: '创建用户档案失败' },
        { status: 500 }
      )
    }

    // 若角色为教师或班主任，自动注册到 ClassIn 并写回 uid
    if (role === 'teacher' || role === 'head_teacher') {
      try {
        const telephone = phone || null
        const nickname = displayName
        const classinPassword = password

        if (!telephone) {
          logger.warn('教师/班主任缺少手机号，跳过 ClassIn 注册', { userId: user.id })
        } else {
          const sdk = getClassInSDKService()
          const uid = await sdk.registerTeacher({
            telephone,
            nickname,
            password: classinPassword,
          })

          const { error: uidUpdateError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              classin_uid: uid,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)

          if (uidUpdateError) {
            logger.warn('ClassIn UID 写回失败（非致命）', {
              userId: user.id,
              error_summary: summarizeError(uidUpdateError),
            })
          } else {
            logger.info('ClassIn 教师注册成功并写回 UID', { userId: user.id, has_uid: Boolean(uid) })
          }
        }
      } catch (e: any) {
        logger.warn('ClassIn 教师注册失败（用户已创建）', {
          userId: user.id,
          error_summary: summarizeError(e),
        })
      }
    }

    // 记录操作日志
    await supabaseServer.from('admin_operation_logs').insert({
      operator_id: adminUserId,
      target_user_id: user.id,
      operation: 'create_user',
      details: {
        role: role,
        has_phone: Boolean(phone),
        has_wechat: Boolean(wechat),
        has_team_name: Boolean(teamName),
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      data: {
        user_id: user.id,
        profile: profileData,
      },
      message: '用户创建成功',
    }, { status: 201 })

  } catch (error: any) {
    logger.error('创建用户错误', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users
 * 更新用户档案信息
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser, userId: adminUserId } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以更新用户' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const role = normalizedString(body.role)
    const id = body.id || body.user_id

    if (!id) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
        { status: 400 }
      )
    }

    logger.info('更新用户请求', {
      id,
      body_summary: summarizeUserPayload(body),
    })

    // 如果更新角色，验证角色是否有效
    if (body.role !== undefined && !role) {
      return NextResponse.json(
        { error: '角色不能为空' },
        { status: 400 }
      )
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `无效的角色，必须是以下之一: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // 更新用户档案
    const { data: profile, error: updateError } = await supabaseServer
      .from('user_profiles')
      .update(profileUpdatePayload(body))
      .eq('id', id)  // 使用 id 而不是 user_id
      .select(USER_ADMIN_SELECT)
      .single()

    if (updateError) {
      logger.error('更新用户失败', { id, error_summary: summarizeError(updateError) })
      return NextResponse.json(
        { error: '更新用户失败' },
        { status: 500 }
      )
    }

    // 记录操作日志
    await supabaseServer.from('admin_operation_logs').insert({
      operator_id: adminUserId,
      target_user_id: id,
      operation: 'update_user',
      details: {
        updated_fields: Object.keys(body).filter(key => USER_UPDATE_FIELDS.includes(key)),
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      data: profile,
      message: '用户更新成功',
    })

  } catch (error: any) {
    logger.error('更新用户错误', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新用户失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users
 * 删除用户（同时删除auth.users和user_profiles）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser, userId: adminUserId } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以删除用户' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
        { status: 400 }
      )
    }

    // 不允许删除自己
    if (adminUserId === userId) {
      return NextResponse.json(
        { error: '不能删除自己的账号' },
        { status: 400 }
      )
    }

    // 先删除认证用户（使用 admin API）
    logger.info('删除认证用户', { userId })
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      logger.error('删除认证用户失败', { userId, error_summary: summarizeError(authDeleteError) })
      return NextResponse.json(
        { error: '删除认证用户失败' },
        { status: 500 }
      )
    }

    // 删除用户档案
    logger.info('删除用户档案', { userId })
    const { error: profileDeleteError } = await supabaseServer
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      logger.error('删除用户档案失败', { userId, error_summary: summarizeError(profileDeleteError) })
      return NextResponse.json(
        { error: '删除用户档案失败' },
        { status: 500 }
      )
    }

    // 记录操作日志
    await supabaseServer.from('admin_operation_logs').insert({
      operator_id: adminUserId,
      target_user_id: userId,
      operation: 'delete_user',
      details: {},
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: '用户删除成功',
    })

  } catch (error: any) {
    logger.error('删除用户错误', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    )
  }
}
