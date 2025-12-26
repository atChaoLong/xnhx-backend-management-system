import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ClassIn API 响应类型（使用 camelCase）
interface ClassInStudentResponse {
  studId: number
  uid: number
  studentName: string  // 注意：API 返回的是 studentName，不是 name
  joinType: number
  mobile?: string
  email?: string
  accountStatus: number
  catInfo?: any[]
  lableInfo?: any[]
  stuno?: string
  isdel?: number
  addtime?: number
  serveState?: number
}

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

    const students = (classinData.data.list || []) as ClassInStudentResponse[]

    // 2. 同步每个学生到 students_classin 表
    const results = {
      total: students.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const student of students) {
      try {
        // 准备数据 - 将 ClassIn API 字段映射到数据库字段
        const studentData = {
          stud_id: student.studId,
          name: student.studentName || '',  // API 返回 studentName，映射到数据库 name 字段
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
        }

        // 使用 upsert（基于 uid 主键）
        const { error } = await supabaseAdmin
          .from('students_classin')
          .upsert({
            uid: student.uid, // 主键
            ...studentData,
          }, {
            onConflict: 'uid',
            ignoreDuplicates: false,
          })

        if (error) throw error

        // 由于使用 upsert，无法区分是新增还是更新，统一计入 success
        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          name: student.studentName || '未知',
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
