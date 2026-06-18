import { NextResponse, NextRequest } from 'next/server'
import { supabaseAuthServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { clearAuthCookies } from '@/lib/server-auth-token'

const logger = createLogger('Auth:Signout')

function markNoStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

async function signOutServerSession() {
  logger.info('用户登出')

  const { error } = await supabaseAuthServer.auth.signOut()

  if (error) {
    logger.warn('Supabase 登出失败，继续清理本地会话', summarizeError(error))
  }
}

export async function GET(request: NextRequest) {
  try {
    await signOutServerSession()
    logger.info('登出成功')
  } catch (error: unknown) {
    logger.error('登出 API 异常', summarizeError(error))
  }

  const response = NextResponse.redirect(new URL('/login', request.url))
  clearAuthCookies(response)
  return markNoStore(response)
}

export async function POST(request: NextRequest) {
  try {
    await signOutServerSession()

    logger.info('登出成功')
    const response = NextResponse.json({ data: { success: true } })
    clearAuthCookies(response)
    return markNoStore(response)
  } catch (error: unknown) {
    logger.error('登出 API 异常', summarizeError(error))
    const response = NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    )
    clearAuthCookies(response)
    return markNoStore(response)
  }
}
