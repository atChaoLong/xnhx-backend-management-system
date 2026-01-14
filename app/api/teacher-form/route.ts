import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    const body = await request.json()
    const { candidate_id, ...formData } = body

    // 2. 验证必填字段
    const requiredFields = [
      'teacher_name',
      'gender',
      'wechat',
      'classin_phone',
      'location',
      'subjects',
      'grade_levels',
      'used_classin',
      'has_certificate',
      'education',
      'university',
      'teaching_years',
      'available_times',
      'textbook_versions',
      'student_regions',
      'student_levels',
      'teaching_style',
      'teaching_experience',
      'success_cases',
      'photo_url'
    ]

    const missingFields = requiredFields.filter(field => !formData[field])
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: '缺少必填字段',
        missingFields
      }, { status: 400 })
    }

    // 3. 验证数组字段
    const arrayFields = [
      'subjects',
      'grade_levels',
      'available_times',
      'textbook_versions',
      'student_regions',
      'student_levels'
    ]

    for (const field of arrayFields) {
      if (!Array.isArray(formData[field])) {
        return NextResponse.json({
          error: `${field} 必须是数组`
        }, { status: 400 })
      }
    }

    // 4. 验证枚举字段
    if (!['女', '男'].includes(formData.gender)) {
      return NextResponse.json({ error: '性别值无效' }, { status: 400 })
    }

    if (!['用过', '没用过'].includes(formData.used_classin)) {
      return NextResponse.json({ error: '是否用过ClassIn值无效' }, { status: 400 })
    }

    if (!['有', '暂时没有'].includes(formData.has_certificate)) {
      return NextResponse.json({ error: '是否有教资证值无效' }, { status: 400 })
    }

    if (!['本科', '硕士', '博士', '其他'].includes(formData.education)) {
      return NextResponse.json({ error: '学历值无效' }, { status: 400 })
    }

    // 5. 插入数据库
    const { data: submission, error: insertError } = await supabaseAdmin
      .from('teacher_details')
      .insert({
        teacher_name: formData.teacher_name,
        gender: formData.gender,
        wechat: formData.wechat,
        classin_phone: formData.classin_phone,
        location: formData.location,
        subjects: formData.subjects,
        grade_levels: formData.grade_levels,
        used_classin: formData.used_classin,
        has_certificate: formData.has_certificate,
        education: formData.education,
        university: formData.university,
        teaching_years: parseFloat(formData.teaching_years),
        available_times: formData.available_times,
        textbook_versions: formData.textbook_versions,
        student_regions: formData.student_regions,
        student_levels: formData.student_levels,
        teaching_style: formData.teaching_style,
        teaching_experience: formData.teaching_experience,
        success_cases: formData.success_cases,
        notes: formData.notes || null,
        photo_url: formData.photo_url,
        review_screenshots: formData.review_screenshots || null,
        candidate_id: candidate_id || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('插入数据失败:', insertError)
      return NextResponse.json({
        error: '提交失败',
        details: insertError.message
      }, { status: 500 })
    }

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      data: submission
    }, { status: 201 })

  } catch (error) {
    console.error('提交表单时出错:', error)
    return NextResponse.json({
      error: '服务器错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

// GET: 获取所有表单提交记录（管理员）
export async function GET(request: NextRequest) {
  try {
    // 1. 验证认证
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 })
    }

    // 2. 验证管理员权限
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    // 3. 获取查询参数
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const from = (page - 1) * limit
    const to = from + limit - 1

    // 4. 查询数据
    const { data, error, count } = await supabaseAdmin
      .from('teacher_details')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('查询数据失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    // 5. 返回结果
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('获取表单记录时出错:', error)
    return NextResponse.json({
      error: '服务器错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
