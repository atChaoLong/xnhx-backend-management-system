import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // 从 classroom_classin 表查询数据
    const { data, error } = await supabaseServer
      .from('classroom_classin')
      .select('*')
      .order('start_time', { ascending: false })

    if (error) {
      console.error('查询 ClassIn 课堂失败:', error)
      return NextResponse.json(
        { error: '查询失败', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('获取 ClassIn 课堂数据出错:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error.message },
      { status: 500 }
    )
  }
}
