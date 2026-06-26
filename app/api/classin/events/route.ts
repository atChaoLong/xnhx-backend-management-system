import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:ClassInEvents')

const EVENT_SELECT = `
  id,
  event_type,
  cmd,
  sid,
  classin_uid,
  course_id,
  classroom_id,
  activity_id,
  session_id,
  event_time,
  payload,
  created_at
`

export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = Math.min(parseInt(searchParams.get('to') || '19'), from + 99)
    const cmd = searchParams.get('cmd')
    const eventType = searchParams.get('event_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabaseServer
      .from('classin_callback_events')
      .select(EVENT_SELECT, { count: 'exact' })

    if (cmd) {
      query = query.eq('cmd', cmd)
    }
    if (eventType) {
      query = query.eq('event_type', eventType)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59.999Z')
    }

    query = query
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      logger.error('查询 ClassIn 回调事件失败', summarizeError(error))
      return NextResponse.json({ error: '查询失败' }, { status: 400 })
    }

    logger.debug('查询 ClassIn 回调事件成功', { count: data?.length || 0, total: count })

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      from,
      to,
    })
  } catch (error) {
    logger.error('查询 ClassIn 回调事件异常', summarizeError(error))
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
