import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Signout')

export async function POST(request: NextRequest) {
  try {
    logger.info('用户登出')

    const { error } = await supabaseServer.auth.signOut()

    if (error) {
      logger.error('登出失败', { message: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info('登出成功')
    return NextResponse.json({ data: { success: true } })
  } catch (error: any) {
    logger.error('登出 API 异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '登出失败' },
      { status: 500 }
    )
  }
}
