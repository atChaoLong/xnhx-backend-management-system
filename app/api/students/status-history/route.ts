import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authenticateUser } from '@/lib/middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:StudentStatusHistory')

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

    // 4. 查询状态变更历史（使用 supabaseAdmin 绕过 RLS）
    const { data: history, error } = await supabaseAdmin
      .from('student_status_history')
      .select('*')
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false })

    if (error) {
      logger.error('查询状态历史失败', { studentId, error: error.message })
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      )
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
            logger.error('获取操作人信息失败', { error: e })
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
    logger.error('获取状态历史异常', { error: error.message, stack: error.stack })
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
