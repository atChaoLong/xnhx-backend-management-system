import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Courses:Sessions')

// GET: 获取课程的所有课时
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params

    if (!courseId) {
      return NextResponse.json(
        { error: '课程ID不能为空' },
        { status: 400 }
      )
    }

    logger.debug('获取课程课时列表', { courseId })

    const { data, error } = await supabaseServer
      .from('class_sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('session_number', { ascending: true })

    if (error) {
      logger.error('获取课时列表失败', { courseId, message: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取课时列表成功', { courseId, count: data?.length || 0 })
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    logger.error('获取课时列表异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取课时列表失败' },
      { status: 500 }
    )
  }
}
