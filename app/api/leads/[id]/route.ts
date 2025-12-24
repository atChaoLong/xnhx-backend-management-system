import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:Leads:Detail')

// GET: 获取单个线索详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    logger.debug('获取线索详情', { leadId: id })

    const { data, error } = await supabaseServer
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('获取线索详情失败', {
        leadId: id,
        message: error.message,
        code: error.code,
      })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (!data) {
      logger.warn('线索不存在', { leadId: id })
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    logger.debug('获取线索详情成功', { leadId: id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取线索详情异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取线索详情失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除线索
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    logger.info('删除线索', { leadId: id })

    const { error } = await supabaseServer
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除线索失败', {
        leadId: id,
        message: error.message,
        code: error.code,
      })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('删除线索成功', { leadId: id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除线索失败' },
      { status: 500 }
    )
  }
}
