import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ error: '请提供微信号' }, { status: 400 })
    }

    // 查询 teacher_candidates 表，找到通过面试的候选人
    const { data: candidate, error } = await supabaseAdmin
      .from('teacher_candidates')
      .select('*')
      .eq('wechat_id', phone)
      .single()

    if (error) {
      console.error('查询候选人失败:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    if (!candidate) {
      return NextResponse.json({
        error: '未找到候选人信息',
        message: '请确认您已经面试，或检查微信号是否正确'
      }, { status: 404 })
    }

    // 检查面试状态（如果有 interview_result 字段且值为"通过面试"）
    if (candidate.interview_result && candidate.interview_result !== '通过面试') {
      return NextResponse.json({
        error: '面试结果不符合',
        message: '请确认您已经通过面试'
      }, { status: 400 })
    }

    // 检查是否已经提交过信息
    const { data: existingSubmission } = await supabaseAdmin
      .from('teacher_details')
      .select('id')
      .eq('candidate_id', candidate.id)
      .maybeSingle()

    if (existingSubmission) {
      return NextResponse.json({
        error: '您已经提交过信息',
        message: '如需修改信息，请联系教务老师'
      }, { status: 400 })
    }

    // 返回候选人信息（预填充表单）
    return NextResponse.json({
      success: true,
      data: {
        id: candidate.id,
        name: candidate.name,
        wechat_id: candidate.wechat_id,
        subjects: candidate.subjects_taught || [],
        grade_levels: candidate.grade_level ? [candidate.grade_level] : [],
      }
    })

  } catch (error) {
    console.error('验证微信号时出错:', error)
    return NextResponse.json({
      error: '服务器错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
