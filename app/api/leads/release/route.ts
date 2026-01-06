import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'

const logger = createLogger('API:LeadsRelease')

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
      return NextResponse.json({ error: '仅销售可放回线索池' }, { status: 403 })
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

    // 仅允许释放自己的线索
    const isMine = lead.grab_user_id === profile.id || (lead.grab_wechat && profile.name && String(lead.grab_wechat).includes(profile.name))
    if (!isMine) {
      return NextResponse.json({ error: '只能释放自己抢到的线索' }, { status: 403 })
    }

    const { data, error } = await supabaseServer
      .from('leads')
      .update({
        grab_user_id: null,
        grab_wechat: null,
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

    logger.info('释放线索成功', { leadId: id, userId: profile.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('释放线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '释放线索失败' }, { status: 500 })
  }
}
