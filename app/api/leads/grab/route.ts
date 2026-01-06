import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'

const logger = createLogger('API:LeadsGrab')

async function getCurrentProfile(request: NextRequest): Promise<{ id: string; name: string; role: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return null
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) return null
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single()
    if (!profile) return null
    return profile as any
  } catch (e) {
    logger.error('获取当前用户档案失败', { error: e })
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或权限不足' }, { status: 403 })
    }
    if (profile.role !== 'sales') {
      return NextResponse.json({ error: '仅销售可抢单' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body || {}
    if (!id) {
      return NextResponse.json({ error: '缺少线索ID' }, { status: 400 })
    }

    const { data: lead, error: fetchErr } = await supabaseServer
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !lead) {
      const { message, status } = handleDatabaseError(fetchErr)
      return NextResponse.json({ error: message || '线索不存在' }, { status: status || 404 })
    }

    if (lead.grab_user_id || (lead.grab_wechat && lead.grab_wechat.trim() !== '')) {
      return NextResponse.json({ error: '线索已被抢单' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('leads')
      .update({
        grab_user_id: profile.id,
        grab_wechat: profile.name,
        updated_at: new Date().toISOString(),
        updated_by: profile.name,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('抢单成功', { leadId: id, userId: profile.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('抢单异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '抢单失败' }, { status: 500 })
  }
}

