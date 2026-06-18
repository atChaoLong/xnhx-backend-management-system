/**
 * API权限检查中间件
 * 用于验证用户是否有权限执行特定操作
 */

import { NextRequest } from 'next/server'
import { supabaseAuthServer } from '@/lib/supabase'
import { hasPermission, PermissionDeniedError, Role, Resource, Action } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getErrorMessage, summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'
import { getRequestAccessToken } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Middleware')

/**
 * 认证状态
 */
export enum AuthStatus {
  AUTHENTICATED = 'authenticated',    // 已认证
  NO_TOKEN = 'no_token',              // 没有token
  EXPIRED_TOKEN = 'expired_token',    // token已过期
  INVALID_TOKEN = 'invalid_token',    // token无效（格式错误、伪造等）
  ACCOUNT_DISABLED = 'account_disabled', // 账号已停用
  PROFILE_UNAVAILABLE = 'profile_unavailable', // 用户档案暂时不可用
}

/**
 * 认证结果
 */
export interface AuthResult {
  status: AuthStatus
  role?: Role
  userId?: string
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function authenticateViaProfileRoute(
  request: NextRequest,
  token: string
): Promise<AuthResult | null> {
  const origin = request.nextUrl?.origin
  if (!origin) return null

  try {
    const response = await fetch(`${origin}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      logger.debug('Node profile 兜底认证失败', { status: response.status })
      return null
    }

    const payload = await response.json().catch(() => null)
    const profile = isRecord(payload) && isRecord(payload.data)
      ? payload.data
      : null

    const userId = typeof profile?.id === 'string' ? profile.id : undefined
    const role = typeof profile?.role === 'string' ? profile.role as Role : undefined

    if (!userId) return null

    return {
      status: AuthStatus.AUTHENTICATED,
      role,
      userId,
    }
  } catch (error: unknown) {
    logger.warn('Node profile 兜底认证异常', summarizeError(error))
    return null
  }
}

/**
 * 从请求中验证用户身份并获取角色
 */
export async function authenticateUser(request: NextRequest): Promise<AuthResult> {
  try {
    const token = getRequestAccessToken(request)

    // 1. 检查是否有 token
    if (!token) {
      logger.debug('认证失败：未提供 token')
      return { status: AuthStatus.NO_TOKEN }
    }

    // 2. 验证 token 是否有效
    const { data: { user }, error } = await supabaseAuthServer.auth.getUser(token)

    if (error) {
      const fallbackResult = await authenticateViaProfileRoute(request, token)
      if (fallbackResult) {
        logger.warn('Supabase SDK token 校验失败，已使用 Node profile 兜底认证', {
          ...summarizeError(error),
          userId: fallbackResult.userId,
        })
        return fallbackResult
      }

      // 判断 token 是否过期
      // Supabase 在 token 过期时返回 401 Unauthorized
      const authErrorMessage = getErrorMessage(error)
      const isExpired = error.status === 401 ||
                       authErrorMessage.includes('expired') ||
                       authErrorMessage.includes('过期')

      if (isExpired) {
        logger.debug('认证失败：token 已过期', summarizeError(error))
        return { status: AuthStatus.EXPIRED_TOKEN }
      }

      logger.debug('认证失败：token 无效', summarizeError(error))
      return { status: AuthStatus.INVALID_TOKEN }
    }

    if (!user) {
      logger.debug('认证失败：未找到用户')
      return { status: AuthStatus.INVALID_TOKEN }
    }

    // 3. 获取用户角色，并拦截停用账号
    const profileResult = await getActiveUserProfile(user.id, { accessToken: token })

    if (profileResult.ok === false) {
      if (profileResult.code === 'ACCOUNT_DISABLED') {
        return { status: AuthStatus.ACCOUNT_DISABLED, userId: user.id }
      }

      if (profileResult.code === 'PROFILE_LOOKUP_FAILED') {
        return { status: AuthStatus.PROFILE_UNAVAILABLE, userId: user.id }
      }

      return {
        status: AuthStatus.AUTHENTICATED,
        userId: user.id,
      }
    }

    const role = profileResult.profile.role as Role | undefined

    if (!role) {
      logger.warn('用户没有角色信息', { userId: user.id })
    }

    return {
      status: AuthStatus.AUTHENTICATED,
      role,
      userId: user.id,
    }
  } catch (error: unknown) {
    logger.error('认证异常', summarizeError(error))
    // 捕获异常时，尝试判断是否是过期相关的错误
    const authErrorMessage = getErrorMessage(error)
    const isExpired = authErrorMessage.includes('expired') ||
                     authErrorMessage.includes('过期')
    return { status: isExpired ? AuthStatus.EXPIRED_TOKEN : AuthStatus.INVALID_TOKEN }
  }
}

/**
 * 从请求中获取用户角色（保持向后兼容）
 */
export async function getUserRole(request: NextRequest): Promise<Role | null> {
  const result = await authenticateUser(request)
  return result.role || null
}

/**
 * 检查权限中间件
 * 用于API路由中验证用户权限
 *
 * 使用示例：
 * ```ts
 * export async function POST(request: NextRequest) {
 *   return checkPermission(request, 'leads', 'create', async () => {
 *     // 业务逻辑
 *   })
 * }
 * ```
 */
export async function checkPermission(
  request: NextRequest,
  resource: Resource,
  action: Action,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // 认证用户
    const authResult = await authenticateUser(request)

    // 处理认证失败情况
    if (authResult.status === AuthStatus.NO_TOKEN) {
      logger.debug('权限检查失败：未提供 token')
      return NextResponse.json(
        { error: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    if (authResult.status === AuthStatus.EXPIRED_TOKEN) {
      logger.debug('权限检查失败：token 已过期')
      return NextResponse.json(
        { error: '登录已过期，请重新登录' },
        { status: 401 }
      )
    }

    if (authResult.status === AuthStatus.INVALID_TOKEN) {
      logger.debug('权限检查失败：token 无效')
      return NextResponse.json(
        { error: '登录信息无效，请重新登录' },
        { status: 401 }
      )
    }

    if (authResult.status === AuthStatus.ACCOUNT_DISABLED) {
      logger.debug('权限检查失败：账号已停用', { userId: authResult.userId })
      return NextResponse.json(
        {
          error: '账号已停用，请联系管理员',
          code: 'ACCOUNT_DISABLED',
        },
        { status: 403 }
      )
    }

    if (authResult.status === AuthStatus.PROFILE_UNAVAILABLE) {
      logger.warn('权限检查失败：用户档案暂时不可用', { userId: authResult.userId })
      return NextResponse.json(
        { error: '用户档案暂时不可用，请稍后重试' },
        { status: 500 }
      )
    }

    // 检查用户角色
    if (!authResult.role) {
      logger.warn('认证成功但用户没有角色', { userId: authResult.userId })
      return NextResponse.json(
        { error: '用户角色未配置，请联系管理员' },
        { status: 403 }
      )
    }

    // 检查权限
    if (!hasPermission(authResult.role, resource, action)) {
      logger.debug('权限不足', {
        userId: authResult.userId,
        role: authResult.role,
        resource,
        action,
      })
      return NextResponse.json(
        {
          error: '权限不足',
          message: `您没有 ${resource} 资源的 ${action} 操作权限`,
        },
        { status: 403 }
      )
    }

    // 执行业务逻辑
    return await handler()
  } catch (error: unknown) {
    logger.error('权限检查错误', summarizeError(error))
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * 快捷权限检查函数
 * 返回是否有权限，不直接返回响应
 */
export async function verifyPermission(
  request: NextRequest,
  resource: Resource,
  action: Action
): Promise<{ hasPermission: boolean; role: Role | null }> {
  const role = await getUserRole(request)
  return {
    hasPermission: hasPermission(role, resource, action),
    role,
  }
}
