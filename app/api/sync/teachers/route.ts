import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 从 ClassIn 同步老师数据到本地数据库
 * POST /api/sync/teachers
 */
export async function POST(request: NextRequest) {
  try {
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

    const teachers = classinData.data.list || []

    // 2. 同步每个老师到 teacher_classin 表
    const results = {
      total: teachers.length,
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const teacher of teachers) {
      try {
        // 检查老师是否已存在（通过 uid）
        const { data: existing } = await supabaseAdmin
          .from('teacher_classin')
          .select('id')
          .eq('uid', teacher.uid)
          .single()

        // 准备数据 - 使用 ClassIn 原始字段名
        const teacherData = {
          st_id: teacher.stId, // ClassIn 老师ID
          uid: teacher.uid, // 唯一标识符
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
          // 额外信息 - 保存 API 返回的其他字段
          classin_extra: teacher,
          updated_at: new Date().toISOString(),
        }

        if (existing) {
          // 更新现有老师
          const { error: updateError } = await supabaseAdmin
            .from('teacher_classin')
            .update(teacherData)
            .eq('id', existing.id)

          if (updateError) throw updateError
          results.updated++
        } else {
          // 插入新老师
          const { error: insertError } = await supabaseAdmin
            .from('teacher_classin')
            .insert({
              ...teacherData,
              created_at: new Date().toISOString(),
            })

          if (insertError) throw insertError
          results.success++
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          name: teacher.name || '未知',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '同步老师数据失败' },
      { status: 500 }
    )
  }
}
