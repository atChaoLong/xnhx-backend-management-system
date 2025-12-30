/**
 * 获取当前用户档案信息
 * 使用服务端客户端绕过 RLS
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Profile')

export async function GET(request: NextRequest) {
  try {
    // 1. 从 Authorization header 获取 token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      logger.warn('未找到访问令牌')
      return NextResponse.json(
        { error: '未认证' },
        { status: 401 }
      )
    }

    // 2. 使用 token 验证用户
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token)

    if (authError || !user) {
      logger.error('获取用户失败', { error: authError?.message })
      return NextResponse.json(
        { error: '无效的认证令牌' },
        { status: 401 }
      )
    }

    // 3. 获取用户档案（使用服务端客户端，绕过 RLS）
    const { data: profile, error: profileError } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()  // 使用 maybeSingle 避免错误

    if (profileError && profileError.code !== 'PGRST116') {
      logger.error('获取用户档案失败', { error: profileError.message, userId: user.id })
      return NextResponse.json(
        { error: '获取用户档案失败' },
        { status: 500 }
      )
    }

    // 3. 如果档案不存在，返回基础信息（供前端使用）
    const responseProfile = profile || {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split('@')[0] || '未知用户',
      role: 'sales', // 默认角色
      created_at: user.created_at || new Date().toISOString(),
    }

    logger.debug('获取用户档案成功', { userId: user.id, hasProfile: !!profile })

    return NextResponse.json({
      data: responseProfile,
    })
  } catch (error: any) {
    logger.error('获取用户档案异常', { error: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取用户档案失败' },
      { status: 500 }
    )
  }
}
