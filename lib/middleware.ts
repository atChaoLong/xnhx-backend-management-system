/**
 * API权限检查中间件
 * 用于验证用户是否有权限执行特定操作
 */

import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { hasPermission, PermissionDeniedError, Role, Resource, Action } from '@/lib/permissions'
import { NextResponse } from 'next/server'

/**
 * 从请求中获取用户角色
 */
export async function getUserRole(request: NextRequest): Promise<Role | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return null
    }

    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    if (error || !user) {
      return null
    }

    // 获取用户档案中的角色
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return profile?.role as Role || null
  } catch (error) {
    console.error('获取用户角色失败:', error)
    return null
  }
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
    // 获取用户角色
    const role = await getUserRole(request)

    if (!role) {
      return NextResponse.json(
        { error: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    // 检查权限
    if (!hasPermission(role, resource, action)) {
      return NextResponse.json(
        {
          error: '权限不足',
          message: `您没有 ${resource} 资源的 ${action} 操作权限`,
          requiredRole: 'admin',
        },
        { status: 403 }
      )
    }

    // 执行业务逻辑
    return await handler()
  } catch (error: any) {
    console.error('权限检查错误:', error)
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
