import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码必填' },
        { status: 400 }
      )
    }

    console.log('注册尝试:', { email, name })

    // 使用 supabaseServer（anon key）而不是 supabaseAdmin
    const { data, error } = await supabaseServer.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
          role: 'user',
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
      },
    })

    if (error) {
      console.error('注册错误:', error)
      return NextResponse.json(
        { error: error.message || '注册失败' },
        { status: 400 }
      )
    }

    console.log('注册成功:', { userId: data.user?.id, email: data.user?.email })

    return NextResponse.json({
      data: {
        session: data.session,
        user: data.user,
        access_token: data.session?.access_token,
        message: '注册成功',
      },
    })
  } catch (error: any) {
    console.error('注册 API 错误:', error)
    return NextResponse.json(
      { error: error.message || '注册失败' },
      { status: 500 }
    )
  }
}
