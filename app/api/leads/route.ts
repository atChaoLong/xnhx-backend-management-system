import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:Leads')

// GET: 获取所有线索
export async function GET(request: NextRequest) {
  try {
    logger.debug('获取线索列表')

    const { data, error } = await supabaseServer
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('获取线索失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('获取线索成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取线索失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新线索
export async function POST(request: NextRequest) {
  try {
    const leadData = await request.json()

    logger.info('创建新线索', {
      orderSerial: leadData.order_serial,
      sourceAccount: leadData.source_account,
    })

    const { data, error } = await supabaseServer
      .from('leads')
      .insert({
        ...leadData,
        // 确保日期格式正确
        entry_date: leadData.entry_date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      logger.error('创建线索失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('创建线索成功', { leadId: data.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('创建线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建线索失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新线索
export async function PUT(request: NextRequest) {
  try {
    const leadData = await request.json()

    if (!leadData.id) {
      logger.warn('更新线索缺少 ID')
      return NextResponse.json(
        { error: '线索 ID 必填' },
        { status: 400 }
      )
    }

    logger.info('更新线索', { leadId: leadData.id })

    const { data, error } = await supabaseServer
      .from('leads')
      .update({
        ...leadData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadData.id)
      .select()
      .single()

    if (error) {
      logger.error('更新线索失败', {
        leadId: leadData.id,
        message: error.message,
        code: error.code,
      })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('更新线索成功', { leadId: data.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新线索失败' },
      { status: 500 }
    )
  }
}
