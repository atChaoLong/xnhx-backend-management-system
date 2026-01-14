import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:Todos:Complete')

// 获取当前用户信息
async function getCurrentProfile(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ||
                       globalThis?.localStorage?.getItem('supabase.auth.token')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return null
    }

    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) {
      return null
    }

    // 获取用户档案信息
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return profile
  } catch (error) {
    logger.error('获取用户信息失败', { error })
    return null
  }
}

// POST: 标记待办为完成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 获取当前用户
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 检查待办是否存在
    const { data: existing } = await supabaseServer
      .from('todos')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '待办不存在' }, { status: 404 })
    }

    // 只有分配给该待办的用户可以标记完成
    if (existing.assigned_to !== profile.id) {
      return NextResponse.json({ error: '只能完成分配给自己的待办' }, { status: 403 })
    }

    // 更新为完成状态
    const { data, error } = await supabaseServer
      .from('todos')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('标记待办完成失败', { id, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info('标记待办完成成功', { id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('标记待办完成异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '标记完成失败' }, { status: 500 })
  }
}
