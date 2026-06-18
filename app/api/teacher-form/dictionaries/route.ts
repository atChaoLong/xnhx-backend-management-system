import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:TeacherFormDictionaries')
const DICTIONARY_SELECT = 'id,created_at,updated_at,category,code,label,sort_order,is_active'
const TEACHER_FORM_DICTIONARY_CATEGORIES = [
  'subject',
  'grade',
  'free_time',
  'textbook_version',
  'province',
  'student_type',
]

// GET: 获取老师外部表单可用的公开字典项
export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('sys_dictionaries')
      .select(DICTIONARY_SELECT)
      .eq('is_active', true)
      .in('category', TEACHER_FORM_DICTIONARY_CATEGORIES)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) {
      logger.error('获取老师表单字典失败', { error_summary: summarizeError(error) })
      return NextResponse.json(
        { error: '获取老师表单字典失败' },
        { status: 500 }
      )
    }

    logger.debug('获取老师表单字典成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: unknown) {
    logger.error('获取老师表单字典异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '获取老师表单字典失败' },
      { status: 500 }
    )
  }
}
