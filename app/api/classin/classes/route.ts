import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // 从 class_classin 表查询数据
    const { data, error } = await supabaseServer
      .from('class_classin')
      .select('*')
      .order('add_time', { ascending: false })

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
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('获取 ClassIn 班级数据出错:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error.message },
      { status: 500 }
    )
  }
}
