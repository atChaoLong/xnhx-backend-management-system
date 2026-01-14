import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { authenticateUser } from '@/lib/middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:UpdateStudentStatus')

export async function PUT(request: NextRequest) {
  try {
    // 1. 认证用户
    const authResult = await authenticateUser(request)
    if (authResult.status !== 'authenticated') {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    // 2. 解析请求体
    const body = await request.json()
    const { studentId, status, reason } = body

    // 3. 验证参数
    if (!studentId) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { error: '缺少状态值' },
        { status: 400 }
      )
    }

    // 验证状态值
    const validStatuses = ['studying', 'suspended', 'completed', 'refunded']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '无效的状态值' },
        { status: 400 }
      )
    }

    // 4. 查询当前学生信息
    const { data: student, error: fetchError } = await supabaseServer
      .from('students')
      .select('id, status, student_name')
      .eq('id', studentId)
      .single()

    if (fetchError || !student) {
      logger.error('查询学生失败', { studentId, error: fetchError?.message })
      return NextResponse.json(
        { error: '学生不存在' },
        { status: 404 }
      )
    }

    // 5. 检查状态是否真的改变
    if (student.status === status) {
      return NextResponse.json(
        { error: '状态未改变' },
        { status: 400 }
      )
    }

    // 6. 更新学生状态
    const { data: updatedStudent, error: updateError } = await supabaseServer
      .from('students')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', studentId)
      .select()
      .single()

    if (updateError) {
      logger.error('更新学生状态失败', { studentId, error: updateError.message })
      return NextResponse.json(
        { error: '更新失败' },
        { status: 500 }
      )
    }

    // 7. 记录状态变更历史
    const { error: historyError } = await supabaseServer
      .from('student_status_history')
      .insert({
        student_id: studentId,
        old_status: student.status,
        new_status: status,
        reason: reason || null,
        changed_by: authResult.userId || null,
        changed_at: new Date().toISOString()
      })

    if (historyError) {
      logger.warn('记录状态历史失败（不影响主流程）', {
        studentId,
        error: historyError.message
      })
    }

    // 8. 记录操作日志
    logger.info('学生状态已更新', {
      studentId,
      studentName: student.student_name,
      oldStatus: student.status,
      newStatus: status,
      reason,
      changedBy: authResult.userId
    })

    return NextResponse.json({
      success: true,
      data: updatedStudent,
      message: '状态更新成功'
    })

  } catch (error: any) {
    logger.error('更新学生状态异常', { error: error.message, stack: error.stack })
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
