import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'

const logger = createLogger('API:Dictionaries')

// GET: 获取字典项（可按分类筛选或ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const id = searchParams.get('id')

    logger.debug('获取字典项', { category, id })

    // 如果提供了ID，查询单个字典项
    if (id) {
      const { data, error } = await supabaseServer
        .from('sys_dictionaries')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取字典项失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取字典项成功', { id })
      return NextResponse.json({ data })
    }

    // 否则按分类筛选或获取所有
    let query = supabaseServer
      .from('sys_dictionaries')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      logger.error('获取字典项失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取字典项成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取字典项异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取字典项失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新字典项
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.info('创建字典项', { category: body.category, code: body.code, label: body.label })

    const { data, error } = await supabaseServer
      .from('sys_dictionaries')
      .insert({
        category: body.category,
        code: body.code,
        label: body.label,
        sort_order: body.sort_order || 0,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select()
      .single()

    if (error) {
      logger.error('创建字典项失败', { message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建字典项成功', { id: data.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('创建字典项异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建字典项失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新字典项
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      logger.warn('更新字典项缺少 ID')
      return NextResponse.json(
        { error: '字典项 ID 必填' },
        { status: 400 }
      )
    }

    logger.info('更新字典项', { id: body.id })

    const { data, error } = await supabaseServer
      .from('sys_dictionaries')
      .update({
        category: body.category,
        code: body.code,
        label: body.label,
        sort_order: body.sort_order,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      logger.error('更新字典项失败', {
        id: body.id,
        message: error.message,
        code: error.code,
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新字典项成功', { id: data.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新字典项异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新字典项失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除字典项（软删除，设置 is_active = false）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      logger.warn('删除字典项缺少 ID')
      return NextResponse.json(
        { error: '字典项 ID 必填' },
        { status: 400 }
      )
    }

    logger.info('删除字典项', { id })

    // 软删除：设置 is_active = false
    const { error } = await supabaseServer
      .from('sys_dictionaries')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      logger.error('删除字典项失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('删除字典项成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除字典项异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除字典项失败' },
      { status: 500 }
    )
  }
}
