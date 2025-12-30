/**
 * Next.js中间件 - 自动权限检查
 * 在API请求到达路由处理程序之前拦截并验证权限
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyPermission } from '@/lib/middleware'
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

  // 4. 检查用户权限
  const { hasPermission: authorized, role } = await verifyPermission(
    request,
    permission.resource,
    permission.action
  )

  if (!authorized) {
    logger.info('权限不足', {
      path: pathname,
      method: request.method,
      requiredResource: permission.resource,
      requiredAction: permission.action,
      userRole: role,
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

  // 5. 权限验证通过，放行
  logger.debug('权限验证通过', {
    path: pathname,
    method: request.method,
    role,
  })

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
