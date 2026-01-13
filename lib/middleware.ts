/**
 * API权限检查中间件
 * 用于验证用户是否有权限执行特定操作
 */

import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { hasPermission, PermissionDeniedError, Role, Resource, Action } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Middleware')

/**
 * 认证状态
 */
export enum AuthStatus {
  AUTHENTICATED = 'authenticated',    // 已认证
  NO_TOKEN = 'no_token',              // 没有token
  EXPIRED_TOKEN = 'expired_token',    // token已过期
  INVALID_TOKEN = 'invalid_token',    // token无效（格式错误、伪造等）
}

/**
 * 认证结果
 */
export interface AuthResult {
  status: AuthStatus
  role?: Role
  userId?: string
}

/**
 * 从请求中验证用户身份并获取角色
 */
export async function authenticateUser(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    // 1. 检查是否有 token
    if (!token) {
      logger.debug('认证失败：未提供 token')
      return { status: AuthStatus.NO_TOKEN }
    }

    // 2. 验证 token 是否有效
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    if (error) {
      // 判断 token 是否过期
      // Supabase 在 token 过期时返回 401 Unauthorized
      const isExpired = error.status === 401 ||
                       error.message?.includes('expired') ||
                       error.message?.includes('过期')

      if (isExpired) {
        logger.debug('认证失败：token 已过期', {
          message: error.message,
          status: error.status,
        })
        return { status: AuthStatus.EXPIRED_TOKEN }
      }

      logger.debug('认证失败：token 无效', {
        message: error.message,
        status: error.status,
      })
      return { status: AuthStatus.INVALID_TOKEN }
    }

    if (!user) {
      logger.debug('认证失败：未找到用户')
      return { status: AuthStatus.INVALID_TOKEN }
    }

    // 3. 获取用户角色
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role as Role | undefined

    if (!role) {
      logger.warn('用户没有角色信息', { userId: user.id })
    }

    return {
      status: AuthStatus.AUTHENTICATED,
      role,
      userId: user.id,
    }
  } catch (error: any) {
    logger.error('认证异常', { error })
    // 捕获异常时，尝试判断是否是过期相关的错误
    const isExpired = error?.message?.includes('expired') ||
                     error?.message?.includes('过期')
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
  } catch (error: any) {
    logger.error('权限检查错误', { error })
    return NextResponse.json(
      { error: error.message || '服务器错误' },
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
