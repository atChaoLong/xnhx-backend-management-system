import { supabaseServer } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    console.log('Session API 调用:', {
      hasAuthHeader: !!authHeader,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 30) + '...',
    })

    if (!token) {
      console.log('Session API: 未找到 token')
      return NextResponse.json(
        { error: '未认证', hint: '未找到 Authorization header 或 token' },
        { status: 401 }
      )
    }

    // 验证 access_token（使用 supabaseServer/anon key）
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    console.log('Token 验证结果:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      error: error?.message,
      errorStatus: error?.status,
    })

    if (error || !user) {
      console.error('Session API: Token 验证失败')
      return NextResponse.json(
        {
          error: '未认证',
          details: error?.message || '无效的 token 或 token 已过期',
          hint: '请重新登录',
        },
        { status: 401 }
      )
    }

    console.log('Session API: 验证成功', { userId: user.id, email: user.email })
    return NextResponse.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0],
          role: user.user_metadata?.role || 'user',
        },
      },
    })
  } catch (error: any) {
    console.error('Session API 异常:', error)
    return NextResponse.json(
      { error: '未授权', details: error.message },
      { status: 401 }
    )
  }
}
