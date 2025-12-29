import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:TeachersClassIn')

export async function GET(request: NextRequest) {
  try {
    // 获取已绑定 ClassIn 的教师列表
    const { data, error } = await supabaseServer
      .from('teacher_classin')
      .select(`
        teacher_id,
        classin_uid,
        teachers!inner(
          teacher_name,
          teacher_subject,
          teacher_phone
        )
      `)
      .order('teachers.teacher_name', { ascending: true })

    if (error) {
      logger.error('获取教师列表失败', { error: error.message })
      return NextResponse.json({ error: '获取教师列表失败' }, { status: 500 })
    }

    // 格式化返回数据
    const teachers = data?.map(item => ({
      id: item.teacher_id,
      teacher_name: item.teachers.teacher_name,
      teacher_subject: item.teachers.teacher_subject,
      teacher_phone: item.teachers.teacher_phone,
      classin_uid: item.classin_uid,
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
