import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('ClassIn:Teachers')

const CLASSIN_TEACHER_SELECT = [
  'uid',
  'name',
  'emp_no',
  'mobile',
  'email',
  'position',
  'is_del',
  'sync_time',
  'created_at',
].join(',')

export async function GET(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('teacher_classin')
      .select('uid', { count: 'exact', head: true })

    // 分页查询数据
    const { data, error } = await supabaseServer
      .from('teacher_classin')
      .select(CLASSIN_TEACHER_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('查询 ClassIn 老师失败', summarizeError(error))
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: unknown) {
    logger.error('获取 ClassIn 老师数据异常', summarizeError(error))
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
