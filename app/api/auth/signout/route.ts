import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { error } = await supabaseServer.auth.signOut()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error: any) {
    console.error('登出错误:', error)
    return NextResponse.json(
      { error: error.message || '登出失败' },
      { status: 500 }
    )
  }
}
