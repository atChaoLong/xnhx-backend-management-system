import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 从 ClassIn 同步学生数据到本地数据库
 * POST /api/sync/students
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { limit = 100, cookie } = body

    // 1. 从 ClassIn API 获取学生列表
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // 如果提供了 Cookie，添加到请求头
    if (cookie) {
      headers['Cookie'] = cookie
    }

    const classinResponse = await fetch(
      `${process.env.NEXT_PUBLIC_CLASSIN_API_URL || 'https://dynamic.eeo.cn'}/coreapi/student/v1/searchStudentList`,
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
      throw new Error('获取 ClassIn 学生列表失败')
    }

    const classinData = await classinResponse.json()

    if (classinData.error_info?.errno !== 1) {
      throw new Error(classinData.error_info?.error || '获取学生列表失败')
    }

    const students = classinData.data.list || []

    // 2. 同步每个学生到 students_classin 表
    const results = {
      total: students.length,
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const student of students) {
      try {
        // 检查学生是否已存在（通过 uid）
        const { data: existing } = await supabaseAdmin
          .from('students_classin')
          .select('id')
          .eq('uid', student.uid)
          .single()

        // 准备数据 - 使用 ClassIn 原始字段名
        const studentData = {
          stud_id: student.studId, // ClassIn 学生ID
          uid: student.uid, // 唯一标识符
          name: student.name || '',
          join_type: student.joinType,
          mobile: student.mobile || '',
          email: student.email || '',
          account_status: student.accountStatus,
          cat_info: student.catInfo || [],
          lable_info: student.lableInfo || [],
          stuno: student.stuno || '',
          isdel: student.isdel ?? 0,
          addtime: student.addtime,
          serve_state: student.serveState,
          // 同步时间
          sync_time: new Date().toISOString(),
          // 额外信息 - 保存 API 返回的其他字段
          classin_extra: student,
          updated_at: new Date().toISOString(),
        }

        if (existing) {
          // 更新现有学生
          const { error: updateError } = await supabaseAdmin
            .from('students_classin')
            .update(studentData)
            .eq('id', existing.id)

          if (updateError) throw updateError
          results.updated++
        } else {
          // 插入新学生
          const { error: insertError } = await supabaseAdmin
            .from('students_classin')
            .insert({
              ...studentData,
              created_at: new Date().toISOString(),
            })

          if (insertError) throw insertError
          results.success++
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          name: student.name || '未知',
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
      { error: error.message || '同步学生数据失败' },
      { status: 500 }
    )
  }
}
