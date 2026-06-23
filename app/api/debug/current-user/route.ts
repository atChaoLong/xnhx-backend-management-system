import { NextRequest, NextResponse } from 'next/server'
import { hasPermission, RESOURCES, ACTIONS } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'

const logger = createLogger('Debug:CurrentUser')

function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return payload?.sub || null
  } catch {
    return null
  }
}

function isDebugApiEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_API === 'true'
}

export async function GET(request: NextRequest) {
  try {
    if (!isDebugApiEnabled()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const userId = decodeJwtUserId(token)

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const profileResult = await getActiveUserProfile(userId, { accessToken: token })
    if (profileResult.ok === false) {
      logger.warn('调试用户档案校验失败', {
        userId,
        code: profileResult.code,
      })
      return NextResponse.json(
        { error: profileResult.error, code: profileResult.code },
        { status: profileResult.status }
      )
    }
    const profile = profileResult.profile

    const role = profile.role || undefined

    // 检查反馈权限
    const hasFeedbackPermission = hasPermission(role as Role | undefined, RESOURCES.leads, ACTIONS.feedback)

    return NextResponse.json({
      user: {
        id: userId,
        hasEmail: Boolean(profile.email),
      },
      profile: {
        id: profile.id,
        role: profile.role,
        createdAt: profile.created_at,
      },
      role,
      hasFeedbackPermission,
      check: {
        resource: RESOURCES.leads,
        action: ACTIONS.feedback,
        hasPermission: hasFeedbackPermission,
      }
    })
  } catch (error: unknown) {
    logger.error('当前用户调试失败', summarizeError(error))
    return NextResponse.json(
      { error: 'Unable to load current user' },
      { status: 500 }
    )
  }
}
