import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { getUserRole } from '@/lib/middleware'
import { hasPermission, RESOURCES, ACTIONS } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 获取用户档案
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // 获取角色
    const role = await getUserRole(request)

    // 检查反馈权限
    const hasFeedbackPermission = hasPermission(role, RESOURCES.leads, ACTIONS.feedback)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile,
      role: role,
      hasFeedbackPermission: hasFeedbackPermission,
      check: {
        resource: RESOURCES.leads,
        action: ACTIONS.feedback,
        hasPermission: hasFeedbackPermission,
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
