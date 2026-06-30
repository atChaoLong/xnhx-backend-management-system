import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'
import { getAccessibleCourseIds, restrictByIds } from '@/lib/server-business-scope'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { SCHEDULED_COURSE_SELECT } from '@/lib/server-course-selects'

const logger = createLogger('Classrooms:Scheduled')

function parseNonNegativeInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseBoundedRange(searchParams: URLSearchParams) {
  const from = parseNonNegativeInt(searchParams.get('from'), 0)
  const requestedTo = parseNonNegativeInt(searchParams.get('to'), from + 19)
  return {
    from,
    to: Math.min(Math.max(requestedTo, from), from + 99),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const { from, to } = parseBoundedRange(searchParams)
    const profile = await getProfileFromHeaders(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    // 基础查询：获取所有课程
    let query = supabaseServer
      .from('courses')
      .select(SCHEDULED_COURSE_SELECT)

    query = restrictByIds(query, 'id', accessibleCourseIds)

    // 如果需要按学生筛选
    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    // 数据库层面复合排序：先按学生ID升序，再按创建时间降序
    query = query.order('student_id', { ascending: true })
    query = query.order('created_at', { ascending: false })

    const shouldPageBroadList = searchParams.has('from') || searchParams.has('to') || !studentId
    if (shouldPageBroadList) {
      query = query.range(from, to)
    }

    const { data: courses, error: coursesError } = await query

    if (coursesError) {
      logger.error('获取课程列表失败', summarizeError(coursesError))
      return NextResponse.json(
        { error: '获取课程列表失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: courses || [],
      count: courses?.length || 0,
      from: shouldPageBroadList ? from : undefined,
      to: shouldPageBroadList ? to : undefined,
    })
  } catch (error: unknown) {
    logger.error('获取课程列表异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取课程列表失败' },
      { status: 500 }
    )
  }
}
