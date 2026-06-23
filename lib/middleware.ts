/**
 * API权限检查中间件
 * 用于验证用户是否有权限执行特定操作
 */

import { NextRequest } from 'next/server'
import { hasPermission, Role, Resource, Action } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
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

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

function isJwtExpired(payload: { exp?: number } | null): boolean {
  if (!payload?.exp) return false
  return Date.now() / 1000 > payload.exp
}

/**
 * 从请求中验证用户身份并获取角色
 * 使用本地 JWT 解码 + 内存缓存，零网络调用
 */
export async function authenticateUser(request: NextRequest): Promise<AuthResult> {
  try {
    const token = getRequestAccessToken(request)

    // 1. 检查是否有 token
    if (!token) {
      logger.debug('认证失败：未提供 token')
      return { status: AuthStatus.NO_TOKEN }
    }

    // 2. 本地解码 JWT，检查格式和过期时间
    const payload = decodeJwtPayload(token)
    if (!payload?.sub) {
      logger.debug('认证失败：token 解码失败')
      return { status: AuthStatus.INVALID_TOKEN }
    }

    if (isJwtExpired(payload)) {
      logger.debug('认证失败：token 已过期')
      return { status: AuthStatus.EXPIRED_TOKEN }
    }

    const userId = payload.sub

    // 3. 获取用户角色（使用内存缓存，60s 内零 DB 查询）
    const profileResult = await getActiveUserProfile(userId, { accessToken: token })

    if (profileResult.ok === false) {
      if (profileResult.code === 'ACCOUNT_DISABLED') {
        return { status: AuthStatus.ACCOUNT_DISABLED, userId }
      }

      if (profileResult.code === 'PROFILE_LOOKUP_FAILED') {
        return { status: AuthStatus.PROFILE_UNAVAILABLE, userId }
      }

      return {
        status: AuthStatus.AUTHENTICATED,
        userId,
      }
    }

    const role = profileResult.profile.role as Role | undefined

    if (!role) {
      logger.warn('用户没有角色信息', { userId })
    }

    return {
      status: AuthStatus.AUTHENTICATED,
      role,
      userId,
    }
  } catch (error: unknown) {
    logger.error('认证异常', summarizeError(error))
    return { status: AuthStatus.INVALID_TOKEN }
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
