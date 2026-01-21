import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    // 基础查询：获取所有课程
    let query = supabaseServer
      .from('courses')
      .select(`
        *,
        teacher:teacher_id(id, name),
        student:student_id(id, student_name),
        formal_orders(id, order_number)
      `)

    // 如果需要按学生筛选
    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    // 数据库层面复合排序：先按学生ID升序，再按创建时间降序
    query = query.order('student_id', { ascending: true })
    query = query.order('created_at', { ascending: false })

    const { data: courses, error: coursesError } = await query

    if (coursesError) {
      console.error('获取课程列表失败:', coursesError)
      return NextResponse.json(
        { error: '获取课程列表失败', details: coursesError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: courses || [],
      count: courses?.length || 0,
    })
  } catch (error: any) {
    console.error('获取课程列表出错:', error)
    return NextResponse.json(
      {
        error: '获取课程列表失败',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
