import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Students:AssignHeadTeacher')

// POST: 分配班主任给学生
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, headTeacherId } = body

    // 验证参数
    if (!studentId || !headTeacherId) {
      return NextResponse.json(
        { error: '缺少必要参数：studentId 和 headTeacherId' },
        { status: 400 }
      )
    }

    logger.info('分配班主任', { studentId, headTeacherId })

    // 验证学生是否存在
    const { data: student, error: studentError } = await supabaseServer
      .from('students')
      .select('id, student_name')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      logger.error('学生不存在', { studentId, error: studentError?.message })
      return NextResponse.json(
        { error: '学生不存在' },
        { status: 404 }
      )
    }

    // 验证班主任是否存在且角色正确
    const { data: headTeacher, error: teacherError } = await supabaseServer
      .from('user_profiles')
      .select('id, name, role')
      .eq('id', headTeacherId)
      .eq('role', 'head_teacher')
      .single()

    if (teacherError || !headTeacher) {
      logger.error('班主任不存在或角色不正确', { headTeacherId, error: teacherError?.message })
      return NextResponse.json(
        { error: '班主任不存在或角色不正确' },
        { status: 404 }
      )
    }

    // 更新学生的班主任
    const { data: updatedStudent, error: updateError } = await supabaseServer
      .from('students')
      .update({
        head_teacher_id: headTeacherId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)
      .select()
      .single()

    if (updateError) {
      logger.error('分配班主任失败', {
        studentId,
        headTeacherId,
        message: updateError.message,
        code: updateError.code,
      })
      return NextResponse.json(
        { error: updateError.message || '分配班主任失败' },
        { status: 400 }
      )
    }

    logger.info('分配班主任成功', {
      studentId,
      studentName: student.student_name,
      headTeacherId,
      headTeacherName: headTeacher.name,
    })

    return NextResponse.json({
      data: updatedStudent,
      message: `已将学生 ${student.student_name} 分配给班主任 ${headTeacher.name}`,
    })
  } catch (error: any) {
    logger.error('分配班主任异常', {
      message: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      { error: error.message || '分配班主任失败' },
      { status: 500 }
    )
  }
}
