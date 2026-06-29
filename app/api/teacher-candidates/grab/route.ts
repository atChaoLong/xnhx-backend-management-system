import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getCurrentProfile } from '@/lib/server-data-scope'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:TeacherCandidatesGrab')

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录或权限不足' }, { status: 403 })
    }

    if (profile.role !== 'teacher_recruiter' && profile.role !== 'admin') {
      return NextResponse.json({ error: '仅招聘专员可抢单' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body || {}
    if (!id) {
      return NextResponse.json({ error: '缺少候选人ID' }, { status: 400 })
    }

    const { data: candidate, error: fetchErr } = await supabaseServer
      .from('teacher_candidates')
      .select('id, grab_user_id, grab_user_name')
      .eq('id', id)
      .single()

    if (fetchErr || !candidate) {
      logger.warn('抢单前查询候选人失败', {
        candidateId: id,
        userId: profile.id,
        ...summarizeError(fetchErr),
      })
      return NextResponse.json({ error: '候选人不存在' }, { status: 404 })
    }

    if (candidate.grab_user_id) {
      return NextResponse.json({ error: '该候选人已被抢单' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('teacher_candidates')
      .update({
        grab_user_id: profile.id,
        grab_user_name: profile.name,
        grabbed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, grab_user_id, grab_user_name, grabbed_at')
      .single()

    if (error) {
      logger.error('抢单失败', {
        candidateId: id,
        userId: profile.id,
        ...summarizeError(error),
      })
      return NextResponse.json({ error: '抢单失败' }, { status: 500 })
    }

    logger.info('抢单成功', { candidateId: id, userId: profile.id })
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('抢单异常', summarizeError(error))
    return NextResponse.json({ error: '抢单失败' }, { status: 500 })
  }
}
