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

    // 2. 同步每个老师到 teachers 表
    const results = {
      total: teachers.length,
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const teacher of teachers) {
      try {
        // 检查老师是否已存在（通过 classin_uid）
        const { data: existing } = await supabaseAdmin
          .from('teachers')
          .select('id')
          .eq('classin_uid', teacher.uid)
          .single()

        // 准备数据
        const teacherData = {
          classin_uid: teacher.uid, // ClassIn 唯一标识符
          name: teacher.name || teacher.nickname || '',
          mobile: teacher.mobile || teacher.phone || '',
          email: teacher.email || '',
          gender: teacher.gender || '',
          location: teacher.location || teacher.region || '',
          subject: teacher.subject || '',
          grade: teacher.grade || '',
          teach_type: teacher.teachType || '',
          education: teacher.education || '',
          university: teacher.university || '',
          // ClassIn 额外字段
          school_uid: teacher.schoolUid,
          join_type: teacher.joinType,
          serve_state: teacher.serveState,
          tea_id: teacher.teaId,
          is_del: teacher.isdel || 0,
          // 同步时间
          sync_time: new Date().toISOString(),
          // 额外信息
          classin_extra: {
            labelInfo: teacher.labelInfo || [],
            // 其他 ClassIn 字段
          },
          updated_at: new Date().toISOString(),
        }

        if (existing) {
          // 更新现有老师
          const { error: updateError } = await supabaseAdmin
            .from('teachers')
            .update(teacherData)
            .eq('id', existing.id)

          if (updateError) throw updateError
          results.updated++
        } else {
          // 插入新老师
          const { error: insertError } = await supabaseAdmin
            .from('teachers')
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
