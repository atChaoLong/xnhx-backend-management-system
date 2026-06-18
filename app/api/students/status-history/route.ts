import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authenticateUser } from '@/lib/middleware'
import { createLogger } from '@/lib/logger'
import { getCurrentProfile } from '@/lib/server-data-scope'
import { getAccessibleStudentIds, hasScopedIdAccess } from '@/lib/server-business-scope'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:StudentStatusHistory')
const STATUS_HISTORY_SELECT = 'id,student_id,old_status,new_status,reason,changed_by,changed_at,created_at'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    // 1. 认证用户
    const authResult = await authenticateUser(request)
    if (authResult.status !== 'authenticated') {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    // 2. 获取查询参数
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('student_id')

    // 3. 验证参数
    if (!studentId) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    if (!UUID_PATTERN.test(studentId)) {
      return NextResponse.json(
        { error: '学生ID格式无效' },
        { status: 400 }
      )
    }

    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    if (!hasScopedIdAccess(accessibleStudentIds, studentId)) {
      logger.warn('查询状态历史失败 - 无权访问学生', { studentId, user_id: profile.id, role: profile.role })
      return NextResponse.json(
        { error: '无权查看该学生状态历史' },
        { status: 403 }
      )
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', studentId)
      .maybeSingle()

    if (studentError) {
      logger.error('查询学生状态历史前校验学生失败', { studentId, error_summary: summarizeError(studentError) })
      return NextResponse.json(
        { error: '学生校验失败' },
        { status: 500 }
      )
    }

    if (!student) {
      return NextResponse.json(
        { error: '学生不存在' },
        { status: 404 }
      )
    }

    // 4. 查询状态变更历史（使用 supabaseAdmin 绕过 RLS）
    const { data: history, error } = await supabaseAdmin
      .from('student_status_history')
      .select(STATUS_HISTORY_SELECT)
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false })

    if (error) {
      logger.warn('查询状态历史失败，返回空历史', { studentId, error_summary: summarizeError(error) })
      return NextResponse.json({
        data: [],
      })
    }

    // 5. 获取操作人信息（使用 supabaseAdmin 绕过 RLS）
    const historyWithOperators = await Promise.all(
      (history || []).map(async (record) => {
        let operatorName = '系统'

        if (record.changed_by) {
          try {
            const { data: user } = await supabaseAdmin
              .from('user_profiles')
              .select('name')
              .eq('id', record.changed_by)
              .maybeSingle()

            operatorName = user?.name || '未知用户'
          } catch (e) {
            logger.error('获取操作人信息失败', { error_summary: summarizeError(e) })
          }
        }

        return {
          ...record,
          operator_name: operatorName,
        }
      })
    )

    return NextResponse.json({
      data: historyWithOperators,
    })
  } catch (error: any) {
    logger.error('获取状态历史异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
