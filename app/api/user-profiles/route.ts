/**
 * 获取用户档案列表
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getCurrentProfile } from '@/lib/server-data-scope'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:UserProfiles')

const USER_PROFILE_DIRECTORY_SELECT = 'id,name,email,role,created_at'
const ALLOWED_ROLE_FILTERS = new Set([
  'admin',
  'operator',
  'sales',
  'head_teacher',
  'teacher',
  'academic_affairs',
  'finance',
  'teacher_recruiter',
  'hr',
])

export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')

    if (roleFilter && !ALLOWED_ROLE_FILTERS.has(roleFilter)) {
      return NextResponse.json(
        { error: '无效的角色筛选条件' },
        { status: 400 }
      )
    }

    // 构建查询
    let query = supabaseServer
      .from('user_profiles')
      .select(USER_PROFILE_DIRECTORY_SELECT)

    // 如果指定了 role 参数，则过滤
    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    const { data: profiles, error } = await query.order('created_at', { ascending: false })

    if (error) {
      logger.error('获取用户档案失败', summarizeError(error))
      return NextResponse.json(
        { error: '获取用户档案失败' },
        { status: 500 }
      )
    }

    logger.info('获取用户档案成功', { count: profiles?.length || 0, role: roleFilter || 'all' })

    return NextResponse.json({
      data: profiles || [],
    })
  } catch (error: unknown) {
    logger.error('获取用户档案异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取用户档案失败' },
      { status: 500 }
    )
  }
}
