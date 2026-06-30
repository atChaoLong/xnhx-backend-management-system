import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'
import { attachTodoSla } from '@/lib/todo-sla'

const logger = createLogger('API:Todos:Complete')

const TODO_SELECT = `
  id,
  created_at,
  updated_at,
  created_by,
  completed_at,
  assigned_to,
  assigned_by,
  title,
  description,
  priority,
  entity_type,
  entity_id,
  status,
  due_date,
  metadata,
  is_auto_created,
  auto_trigger_type
`

function todoError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// POST: 标记待办为完成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const profile = await getProfileFromHeaders(request)
    if (!profile) {
      return todoError('未登录', 401)
    }

    const { data: existing, error: existingError } = await supabaseServer
      .from('todos')
      .select('id, assigned_to, status')
      .eq('id', id)
      .single()

    if (existingError || !existing) {
      logger.warn('查询待办失败', { id, error_summary: summarizeError(existingError) })
      return todoError('待办不存在', 404)
    }

    if (existing.assigned_to !== profile.id) {
      return todoError('只能完成分配给自己的待办', 403)
    }

    if (existing.status === 'completed') {
      const { data, error } = await supabaseServer
        .from('todos')
        .select(TODO_SELECT)
        .eq('id', id)
        .single()

      if (error || !data) {
        logger.warn('获取已完成待办失败', { id, error_summary: summarizeError(error) })
        return todoError('待办不存在', 404)
      }

      return NextResponse.json({ data: attachTodoSla(data) })
    }

    const { data, error } = await supabaseServer
      .from('todos')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(TODO_SELECT)
      .single()

    if (error) {
      logger.error('标记待办完成失败', { id, error_summary: summarizeError(error) })
      return todoError('标记完成失败', 500)
    }

    logger.info('标记待办完成成功', { id })
    return NextResponse.json({ data: attachTodoSla(data) })
  } catch (error: any) {
    logger.error('标记待办完成异常', { error_summary: summarizeError(error) })
    return todoError('标记完成失败', 500)
  }
}
