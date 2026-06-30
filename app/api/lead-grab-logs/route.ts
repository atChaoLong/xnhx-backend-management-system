import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'
import { summarizeError } from '@/lib/safe-error'
import { ROLES } from '@/lib/permissions'

const logger = createLogger('API:LeadGrabLogs')

export async function GET(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或权限不足' }, { status: 403 })
    }

    if (profile.role !== ROLES.admin) {
      return NextResponse.json({ error: '仅超级管理员可查看抢单日志' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0', 10)
    const to = parseInt(searchParams.get('to') || '49', 10)

    let query = supabaseServer
      .from('lead_grab_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      logger.error('查询抢单日志失败', summarizeError(error))
      return NextResponse.json({ error: '查询抢单日志失败' }, { status: 500 })
    }

    return NextResponse.json({ data, count: count || 0 })
  } catch (error) {
    logger.error('抢单日志接口异常', summarizeError(error))
    return NextResponse.json({ error: '获取抢单日志失败' }, { status: 500 })
  }
}
