import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码必填' },
        { status: 400 }
      )
    }

    console.log('登录尝试:', { email, passwordLength: password?.length })

    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Supabase 认证错误:', {
        message: error.message,
        status: error.status,
        name: error.name,
      })

      return NextResponse.json(
        {
          error: error.message || '认证失败',
          hint: '请确认已在 Supabase 中创建用户账户',
        },
        { status: 401 }
      )
    }

    console.log('登录成功:', { userId: data.user?.id, email: data.user?.email })

    return NextResponse.json({
      data: {
        session: data.session,
        user: data.user,
        access_token: data.session?.access_token,
      },
    })
  } catch (error: any) {
    console.error('登录 API 错误:', error)
    return NextResponse.json(
      {
        error: error.message || '登录失败',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}
