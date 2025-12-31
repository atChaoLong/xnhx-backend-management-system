import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // 从 teacher_classin 表查询数据
    const { data, error } = await supabaseServer
      .from('teacher_classin')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询 ClassIn 老师失败:', error)
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
    console.error('获取 ClassIn 老师数据出错:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error.message },
      { status: 500 }
    )
  }
}
