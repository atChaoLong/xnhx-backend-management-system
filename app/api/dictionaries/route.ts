import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:Dictionaries')
const DICTIONARY_SELECT = 'id,created_at,updated_at,category,code,label,sort_order,is_active'
const DICT_CACHE_HEADER = 'public, max-age=300, stale-while-revalidate=600'

function cachedJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', DICT_CACHE_HEADER)
  return response
}

const DICT_CACHE_TTL_MS = 5 * 60 * 1000
const dictCache = new Map<string, { data: any[]; fetchedAt: number }>()

function getCachedDicts(key: string): any[] | null {
  const entry = dictCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > DICT_CACHE_TTL_MS) {
    dictCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedDicts(key: string, data: any[]): void {
  dictCache.set(key, { data, fetchedAt: Date.now() })
}

function summarizeDictionaryPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_category: typeof payload?.category === 'string' && payload.category.trim().length > 0,
    has_code: typeof payload?.code === 'string' && payload.code.trim().length > 0,
    has_label: typeof payload?.label === 'string' && payload.label.trim().length > 0,
    has_sort_order: payload?.sort_order !== undefined,
    has_is_active: payload?.is_active !== undefined,
  }
}

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
        .select(DICTIONARY_SELECT)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取字典项失败', { id, error_summary: summarizeError(error) })
        return NextResponse.json(
          { error: '获取字典项失败' },
          { status: 400 }
        )
      }

      logger.debug('获取字典项成功', { id })
      return cachedJson({ data })
    }

    // 否则按分类筛选或获取所有
    const cacheKey = category || '__all__'
    const cached = getCachedDicts(cacheKey)
    if (cached) {
      logger.debug('字典缓存命中', { category: cacheKey, count: cached.length })
      return cachedJson({ data: cached })
    }

    let query = supabaseServer
      .from('sys_dictionaries')
      .select(DICTIONARY_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      logger.error('获取字典项失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取字典项失败' },
        { status: 400 }
      )
    }

    setCachedDicts(cacheKey, data || [])
    logger.debug('获取字典项成功', { count: data?.length || 0 })
    return cachedJson({ data })
  } catch (error: any) {
    logger.error('获取字典项异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取字典项失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新字典项
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bodySummary = summarizeDictionaryPayload(body || {})

    logger.info('创建字典项', { body_summary: bodySummary })

    const { data, error } = await supabaseServer
      .from('sys_dictionaries')
      .insert({
        category: body.category,
        code: body.code,
        label: body.label,
        sort_order: body.sort_order || 0,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select(DICTIONARY_SELECT)
      .single()

    if (error) {
      logger.error('创建字典项失败', { error_summary: summarizeError(error) })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建字典项成功', { id: data.id })
    dictCache.clear()
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('创建字典项异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建字典项失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新字典项
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const bodySummary = summarizeDictionaryPayload(body || {})

    if (!body.id) {
      logger.warn('更新字典项缺少 ID')
      return NextResponse.json(
        { error: '字典项 ID 必填' },
        { status: 400 }
      )
    }

    logger.info('更新字典项', { id: body.id, body_summary: bodySummary })

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
      .select(DICTIONARY_SELECT)
      .single()

    if (error) {
      logger.error('更新字典项失败', {
        id: body.id,
        error_summary: summarizeError(error),
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新字典项成功', { id: data.id })
    dictCache.clear()
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新字典项异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '更新字典项失败' },
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
      logger.error('删除字典项失败', { id, error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '删除字典项失败' },
        { status: 400 }
      )
    }

    logger.info('删除字典项成功', { id })
    dictCache.clear()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除字典项异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '删除字典项失败' },
      { status: 500 }
    )
  }
}
