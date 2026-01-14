import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getCurrentProfile } from '@/app/api/auth/profile'

const logger = createLogger('API:Todos')

// GET: 获取待办列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    // 获取当前用户
    const profile = await getCurrentProfile()
    if (!profile) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 如果是查询单个待办
    if (id) {
      const { data, error } = await supabaseServer
        .from('todos')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取待办失败', { id, error: error.message })
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      // 检查权限：只能查看分配给自己的或管理员可查看所有
      if (profile.role !== 'admin' && data.assigned_to !== profile.id) {
        return NextResponse.json({ error: '无权访问' }, { status: 403 })
      }

      return NextResponse.json({ data })
    }

    // 构建查询
    let query = supabaseServer
      .from('todos')
      .select('*', { count: 'exact', head: true })

    // 非管理员只能看到分配给自己的待办
    if (profile.role !== 'admin') {
      query = query.eq('assigned_to', profile.id)
    }

    // 获取总数
    const { count } = await query

    // 查询数据
    query = supabaseServer
      .from('todos')
      .select('*')

    if (profile.role !== 'admin') {
      query = query.eq('assigned_to', profile.id)
    }

    // 应用筛选
    if (status) {
      query = query.eq('status', status)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }

    // 排序：按到期时间和优先级排序
    query = query.order('due_date', { ascending: true, nullsFirst: false })
                 .order('priority', { ascending: false })
                 .order('created_at', { ascending: false })

    // 分页
    query = query.range(from, to)

    const { data, error } = await query

    if (error) {
      logger.error('获取待办列表失败', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取待办异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '获取待办失败' }, { status: 500 })
  }
}

// POST: 创建待办
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 获取当前用户
    const profile = await getCurrentProfile()
    if (!profile) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 检查权限：只有运营和管理员可以创建待办
    if (profile.role !== 'admin' && profile.role !== 'operator') {
      return NextResponse.json({ error: '无权创建待办' }, { status: 403 })
    }

    // 验证必填字段
    if (!body.assigned_to || !body.title) {
      return NextResponse.json({ error: '缺少必填字段: assigned_to, title' }, { status: 400 })
    }

    const insertData = {
      assigned_to: body.assigned_to,
      assigned_by: profile.id,
      created_by: profile.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      priority: body.priority || 'medium',
      entity_type: body.entity_type || null,
      entity_id: body.entity_id || null,
      due_date: body.due_date || null,
      metadata: body.metadata || null,
      is_auto_created: false,
      auto_trigger_type: null,
      status: 'pending',
    }

    const { data, error } = await supabaseServer
      .from('todos')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建待办失败', { error: error.message, details: error.details })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info('创建待办成功', { id: data.id, title: data.title })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建待办异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '创建待办失败' }, { status: 500 })
  }
}

// PUT: 更新待办
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: '缺少待办ID' }, { status: 400 })
    }

    // 获取当前用户
    const profile = await getCurrentProfile()
    if (!profile) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 检查待办是否存在以及权限
    const { data: existing } = await supabaseServer
      .from('todos')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: '待办不存在' }, { status: 404 })
    }

    // 只有分配给该待办的用户或创建者可以更新
    if (existing.assigned_to !== profile.id && existing.created_by !== profile.id) {
      return NextResponse.json({ error: '无权更新此待办' }, { status: 403 })
    }

    // 如果标记为完成，设置完成时间
    if (updateData.status === 'completed' && existing.status !== 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabaseServer
      .from('todos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新待办失败', { id, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info('更新待办成功', { id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新待办异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '更新待办失败' }, { status: 500 })
  }
}

// DELETE: 删除待办
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少待办ID' }, { status: 400 })
    }

    // 获取当前用户
    const profile = await getCurrentProfile()
    if (!profile) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 检查权限：只有创建者和管理员可以删除
    if (profile.role !== 'admin') {
      const { data: existing } = await supabaseServer
        .from('todos')
        .select('created_by')
        .eq('id', id)
        .single()

      if (!existing || existing.created_by !== profile.id) {
        return NextResponse.json({ error: '无权删除此待办' }, { status: 403 })
      }
    }

    const { error } = await supabaseServer
      .from('todos')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除待办失败', { id, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info('删除待办成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除待办异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '删除待办失败' }, { status: 500 })
  }
}
