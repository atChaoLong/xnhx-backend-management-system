/**
 * Next.js中间件 - 自动权限检查
 * 在API请求到达路由处理程序之前拦截并验证权限
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authenticateUser, AuthStatus } from '@/lib/middleware'
import { hasPermission } from '@/lib/permissions'
import { getRoutePermission, PUBLIC_PATHS } from '@/lib/route-permissions'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Middleware:Permission')

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. 跳过非API路由
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 2. 跳过公开路径（认证、上传等）
  const isPublic = PUBLIC_PATHS.some(path => pathname.startsWith(path))
  if (isPublic) {
    return NextResponse.next()
  }

  // 3. 获取路由的权限要求
  const permission = getRoutePermission(pathname, request.method)

  if (!permission) {
    // 没有配置权限，记录警告但放行
    logger.warn(`未配置权限: ${pathname} ${request.method}`)
    return NextResponse.next()
  }

  // 4. 先检查认证状态（第一步：认证）
  const authResult = await authenticateUser(request)

  // 处理认证失败情况
  if (authResult.status === AuthStatus.NO_TOKEN) {
    logger.debug('中间件认证失败：未提供 token', {
      path: pathname,
      method: request.method,
    })
    return NextResponse.json(
      { error: '未登录或登录已过期' },
      { status: 401 }
    )
  }

  if (authResult.status === AuthStatus.EXPIRED_TOKEN) {
    logger.debug('中间件认证失败：token 已过期', {
      path: pathname,
      method: request.method,
    })
    return NextResponse.json(
      { error: '登录已过期，请重新登录' },
      { status: 401 }
    )
  }

  if (authResult.status === AuthStatus.INVALID_TOKEN) {
    logger.debug('中间件认证失败：token 无效', {
      path: pathname,
      method: request.method,
    })
    return NextResponse.json(
      { error: '登录信息无效，请重新登录' },
      { status: 401 }
    )
  }

  // 检查用户角色
  if (!authResult.role) {
    logger.warn('认证成功但用户没有角色', {
      path: pathname,
      method: request.method,
      userId: authResult.userId,
    })
    return NextResponse.json(
      { error: '用户角色未配置，请联系管理员' },
      { status: 403 }
    )
  }

  // 5. 再检查权限（第二步：授权）
  const authorized = hasPermission(authResult.role, permission.resource, permission.action)

  if (!authorized) {
    logger.info('权限不足', {
      path: pathname,
      method: request.method,
      requiredResource: permission.resource,
      requiredAction: permission.action,
      userRole: authResult.role,
      userId: authResult.userId,
    })

    return NextResponse.json(
      {
        error: '权限不足',
        message: `您需要 ${permission.resource} 资源的 ${permission.action} 权限`,
        code: 'PERMISSION_DENIED',
        requiredResource: permission.resource,
        requiredAction: permission.action,
      },
      { status: 403 }
    )
  }

  // 6. 认证和授权都通过，放行
  logger.debug('权限验证通过', {
    path: pathname,
    method: request.method,
    role: authResult.role,
    userId: authResult.userId,
  })

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
