import { NextRequest, NextResponse } from 'next/server'
import { getLeadsResponse } from '@/app/api/leads/route'
import { AuthStatus, authenticateUser } from '@/lib/middleware'
import { ACTIONS, RESOURCES, ROLES, hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request)

  if (authResult.status === AuthStatus.NO_TOKEN) {
    return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 })
  }

  if (authResult.status === AuthStatus.EXPIRED_TOKEN) {
    return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 })
  }

  if (authResult.status === AuthStatus.INVALID_TOKEN) {
    return NextResponse.json({ error: '登录信息无效，请重新登录' }, { status: 401 })
  }

  if (authResult.status === AuthStatus.ACCOUNT_DISABLED) {
    return NextResponse.json({
      error: '账号已停用，请联系管理员',
      code: 'ACCOUNT_DISABLED',
    }, { status: 403 })
  }

  if (authResult.status === AuthStatus.PROFILE_UNAVAILABLE) {
    return NextResponse.json({ error: '用户档案暂时不可用，请稍后重试' }, { status: 500 })
  }

  if (!authResult.role) {
    return NextResponse.json({ error: '用户角色未配置，请联系管理员' }, { status: 403 })
  }

  if (authResult.role !== ROLES.sales || !hasPermission(authResult.role, RESOURCES.leads, ACTIONS.assign)) {
    return NextResponse.json({
      error: '权限不足',
      message: '公共线索池仅销售可访问',
    }, { status: 403 })
  }

  return getLeadsResponse(request, 'public')
}
