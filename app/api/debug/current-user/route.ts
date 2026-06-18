import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuthServer } from '@/lib/supabase'
import { hasPermission, RESOURCES, ACTIONS } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getActiveUserProfile } from '@/lib/server-active-profile'

const logger = createLogger('Debug:CurrentUser')

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

    const { data: { user }, error: authError } = await supabaseAuthServer.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const profileResult = await getActiveUserProfile(user.id, { accessToken: token })
    if (profileResult.ok === false) {
      logger.warn('调试用户档案校验失败', {
        userId: user.id,
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
        id: user.id,
        hasEmail: Boolean(user.email),
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
