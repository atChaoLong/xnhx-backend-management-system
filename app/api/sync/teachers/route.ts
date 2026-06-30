import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getProfileFromHeaders } from '@/lib/server-profile-from-headers'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:Sync:Teachers')

// ClassIn API 响应类型（使用 camelCase）
interface ClassInTeacherResponse {
  stId: number
  uid: number
  name: string
  logo?: string
  empNo?: string
  position?: string
  isDel?: number
  joinType?: number
  departmentsInfo?: any[]
  mobile?: string
  email?: string
  accountStatus?: number
}

/**
 * 从 ClassIn 同步老师数据到本地数据库
 * POST /api/sync/teachers
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)
    if (!profile || !['admin', 'academic_affairs'].includes(profile.role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const body = await request.json()
    const { limit = 100, cookie } = body

    // 1. 从 ClassIn API 获取老师列表
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // 如果提供了 Cookie，添加到请求头
    if (cookie) {
      headers['Cookie'] = cookie
    }

    const classinResponse = await fetch(
      `${process.env.NEXT_PUBLIC_CLASSIN_API_URL || 'https://dynamic.eeo.cn'}/coreapi/teacher/v1/searchTeacherList`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page: 1,
          pageSize: limit,
        }),
      }
    )

    if (!classinResponse.ok) {
      throw new Error('获取 ClassIn 老师列表失败')
    }

    const classinData = await classinResponse.json()

    if (classinData.error_info?.errno !== 1) {
      throw new Error(classinData.error_info?.error || '获取老师列表失败')
    }

    const teachers = (classinData.data.list || []) as ClassInTeacherResponse[]

    // 2. 同步每个老师到 teacher_classin 表
    const results = {
      total: teachers.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const teacher of teachers) {
      try {
        // 准备数据 - 使用 ClassIn 原始字段名
        const teacherData = {
          st_id: teacher.stId, // ClassIn 老师ID
          name: teacher.name || '',
          logo: teacher.logo || '',
          emp_no: teacher.empNo || '',
          position: teacher.position || '',
          is_del: teacher.isDel ?? 0,
          join_type: teacher.joinType,
          departments_info: teacher.departmentsInfo || [],
          mobile: teacher.mobile || '',
          email: teacher.email || '',
          account_status: teacher.accountStatus,
          // 同步时间
          sync_time: new Date().toISOString(),
        }

        // 使用 upsert（基于 uid 主键）
        const { error } = await supabaseAdmin
          .from('teacher_classin')
          .upsert({
            uid: teacher.uid, // 主键
            ...teacherData,
          }, {
            onConflict: 'uid',
            ignoreDuplicates: false,
          })

        if (error) throw error

        // 由于使用 upsert，无法区分是新增还是更新，统一计入 success
        results.success++
      } catch (error: unknown) {
        results.failed++
        results.errors.push({
          name: teacher.name || '未知',
          error: '该老师同步失败',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error: unknown) {
    logger.error('同步老师数据失败', summarizeError(error))
    return NextResponse.json(
      { error: '同步老师数据失败' },
      { status: 500 }
    )
  }
}
