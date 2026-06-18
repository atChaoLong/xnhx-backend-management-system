import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:Students:AssignHeadTeacher')

const ASSIGNABLE_ROLES = new Set(['admin', 'academic_affairs'])
const UPDATED_STUDENT_SELECT = 'id, student_name, head_teacher_id, updated_at'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function canAssignHeadTeacher(role: string | undefined): boolean {
  return Boolean(role && ASSIGNABLE_ROLES.has(role))
}

// POST: 分配班主任给学生
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!canAssignHeadTeacher(profile.role)) {
      logger.warn('无权分配班主任', { userId: profile.id, role: profile.role })
      return NextResponse.json(
        { error: '无权分配班主任' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: '请求参数格式错误' },
        { status: 400 }
      )
    }

    const studentId = getNonEmptyString(body.studentId)
    const headTeacherId = getNonEmptyString(body.headTeacherId)

    // 验证参数
    if (!studentId || !headTeacherId) {
      return NextResponse.json(
        { error: '缺少必要参数：studentId 和 headTeacherId' },
        { status: 400 }
      )
    }

    logger.info('分配班主任', { studentId, headTeacherId, operatorId: profile.id })

    // 验证学生是否存在
    const { data: student, error: studentError } = await supabaseServer
      .from('students')
      .select('id, student_name')
      .eq('id', studentId)
      .maybeSingle()

    if (studentError || !student) {
      logger.error('学生不存在或查询失败', {
        studentId,
        error_summary: studentError ? summarizeError(studentError) : undefined,
      })
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
      .maybeSingle()

    if (teacherError || !headTeacher) {
      logger.error('班主任不存在或角色不正确', {
        headTeacherId,
        error_summary: teacherError ? summarizeError(teacherError) : undefined,
      })
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
      .select(UPDATED_STUDENT_SELECT)
      .single()

    if (updateError) {
      logger.error('分配班主任失败', {
        studentId,
        headTeacherId,
        error_summary: summarizeError(updateError),
      })
      return NextResponse.json(
        { error: '分配班主任失败' },
        { status: 400 }
      )
    }

    logger.info('分配班主任成功', {
      studentId,
      headTeacherId,
      operatorId: profile.id,
    })

    return NextResponse.json({
      data: updatedStudent,
      message: `已将学生 ${student.student_name} 分配给班主任 ${headTeacher.name}`,
    })
  } catch (error: unknown) {
    logger.error('分配班主任异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '分配班主任失败' },
      { status: 500 }
    )
  }
}
