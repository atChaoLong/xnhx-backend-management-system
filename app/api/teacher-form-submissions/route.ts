import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'

const logger = createLogger('API:TeacherFormSubmissions')

const SUBMISSION_LIST_SELECT = [
  'id',
  'created_at',
  'candidate_id',
  'teacher_name',
  'gender',
  'wechat',
  'classin_phone',
  'location',
  'subjects',
  'grade_levels',
  'used_classin',
  'has_certificate',
  'education',
  'university',
  'teaching_years',
  'available_times',
  'textbook_versions',
  'student_regions',
  'student_levels',
  'teaching_style',
  'teaching_experience',
  'success_cases',
  'notes',
  'photo_url',
  'review_screenshots',
].join(', ')

export async function GET(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)

    if (!profile) {
      return NextResponse.json({ error: '未登录或账号不可用' }, { status: 401 })
    }

    if (profile.role !== 'admin' && profile.role !== 'teacher_recruiter') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidate_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const from = (page - 1) * limit
    const to = from + limit - 1

    if (candidateId) {
      const { data, error } = await supabaseAdmin
        .from('teacher_details')
        .select(SUBMISSION_LIST_SELECT)
        .eq('candidate_id', candidateId)
        .maybeSingle()

      if (error) {
        logger.error('查询老师采集信息失败', { candidateId, error_summary: summarizeError(error) })
        return NextResponse.json({ error: '查询失败' }, { status: 500 })
      }

      return NextResponse.json({ data })
    }

    const { data, error, count } = await supabaseAdmin
      .from('teacher_details')
      .select(SUBMISSION_LIST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('查询老师采集记录列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    logger.error('获取老师采集记录异常', summarizeError(error))
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
