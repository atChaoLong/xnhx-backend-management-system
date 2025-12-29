import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:TeachersClassIn')

export async function GET(request: NextRequest) {
  try {
    // 从 teacher_classin 表获取 ClassIn 教师列表
    const { data, error } = await supabaseServer
      .from('teacher_classin')
      .select('*')
      .eq('is_del', 0) // 只获取未删除的教师
      .order('name', { ascending: true })

    if (error) {
      logger.error('获取教师列表失败', { error: error.message, details: error })
      return NextResponse.json({ error: '获取教师列表失败' }, { status: 500 })
    }

    // 格式化返回数据
    const teachers = data?.map(item => ({
      id: item.id,
      teacher_name: item.name,
      teacher_subject: item.position || '', // 使用职位作为科目
      teacher_phone: item.mobile,
      classin_uid: item.uid,
      st_id: item.st_id,
    })) || []

    logger.info('获取教师列表成功', { count: teachers.length })

    return NextResponse.json({
      success: true,
      data: teachers
    })
  } catch (error: any) {
    logger.error('获取教师列表异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '获取教师列表失败' }, { status: 500 })
  }
}
