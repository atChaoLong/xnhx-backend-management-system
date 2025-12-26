import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // 2. 连接到 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. 同步每个学生到数据库
    const results = {
      total: students.length,
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const student of students) {
      try {
        // 检查学生是否已存在（通过 student_number）
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('student_number', student.stuno?.toString())
          .single()

        // 准备数据
        const studentData = {
          student_number: student.stuno?.toString() || '',
          student_name: student.name || student.nickname || '',
          grade_code: student.grade || '',
          region: student.region || '',
          school: student.school || '',
          mobile: student.mobile || student.phone || '',
          parent_phone: student.parentPhone || student.mobile || student.phone || '',
          status: 'active',
          updated_at: new Date().toISOString(),
        }

        if (existing) {
          // 更新现有学生
          const { error: updateError } = await supabase
            .from('students')
            .update(studentData)
            .eq('id', existing.id)

          if (updateError) throw updateError
          results.updated++
        } else {
          // 插入新学生
          const { error: insertError } = await supabase
            .from('students')
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
          name: student.name || student.nickname || '未知',
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
