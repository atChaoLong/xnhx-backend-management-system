import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // 2. 连接到 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. 同步每个老师到数据库
    const results = {
      total: teachers.length,
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const teacher of teachers) {
      try {
        // 检查老师是否已存在（通过 classin_phone）
        const { data: existing } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('classin_phone', teacher.mobile || teacher.phone)
          .single()

        // 准备数据
        const teacherData = {
          teacher_name: teacher.name || teacher.nickname || '',
          gender: teacher.gender || '未知',
          wechat: teacher.wechat || '',
          classin_phone: teacher.mobile || teacher.phone || '',
          mobile: teacher.mobile || teacher.phone || '', // 复制到 mobile 字段
          location: teacher.location || teacher.region || '未知',
          subjects: teacher.subject ? [teacher.subject] : [],
          grade_levels: [],
          used_classin: true,
          has_certificate: false,
          education: teacher.education || '未知',
          university: teacher.university || '',
          updated_at: new Date().toISOString(),
        }

        if (existing) {
          // 更新现有老师
          const { error: updateError } = await supabase
            .from('teacher_profiles')
            .update(teacherData)
            .eq('id', existing.id)

          if (updateError) throw updateError
          results.updated++
        } else {
          // 插入新老师
          const { error: insertError } = await supabase
            .from('teacher_profiles')
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
          name: teacher.name || teacher.nickname || '未知',
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
