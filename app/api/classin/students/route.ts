import { NextRequest, NextResponse } from 'next/server'
import { classInService } from '@/lib/services/classin'

/**
 * 获取 ClassIn 学生列表
 * GET /api/classin/students?page=1&pageSize=1000
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '1000')

    const result = await classInService.getStudents({
      page,
      pageSize,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '获取学生列表失败' },
      { status: 500 }
    )
  }
}

/**
 * 添加学生到 ClassIn
 * POST /api/classin/students
 * Body: { name, mobile, email?, stuno?, labelIds?, autoRegister? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证必填字段
    if (!body.name || !body.mobile) {
      return NextResponse.json(
        { error: '学生姓名和手机号为必填项' },
        { status: 400 }
      )
    }

    const result = await classInService.addStudent({
      name: body.name,
      mobile: body.mobile,
      email: body.email || '',
      stuno: body.stuno || '',
      labelIds: body.labelIds || [],
      autoRegister: body.autoRegister !== undefined ? body.autoRegister : 1,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '添加学生失败' },
      { status: 500 }
    )
  }
}
