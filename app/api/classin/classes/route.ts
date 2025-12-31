import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('class_classin')
      .select('*', { count: 'exact', head: true })

    // 分页查询数据
    const { data, error } = await supabaseServer
      .from('class_classin')
      .select('*')
      .order('add_time', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('查询 ClassIn 班级失败:', error)
      return NextResponse.json(
        { error: '查询失败', details: error.message },
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
  } catch (error: any) {
    console.error('获取 ClassIn 班级数据出错:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error.message },
      { status: 500 }
    )
  }
}
