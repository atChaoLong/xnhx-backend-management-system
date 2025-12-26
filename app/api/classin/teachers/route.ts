import { NextRequest, NextResponse } from 'next/server'
import { classInService } from '@/lib/services/classin'

/**
 * 获取 ClassIn 老师列表
 * GET /api/classin/teachers?page=1&pageSize=1000
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '1000')

    const result = await classInService.getTeachers({
      page,
      pageSize,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '获取老师列表失败' },
      { status: 500 }
    )
  }
}

/**
 * 添加老师到 ClassIn
 * POST /api/classin/teachers
 * Body: { name, mobile, email?, subject?, autoRegister? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证必填字段
    if (!body.name || !body.mobile) {
      return NextResponse.json(
        { error: '老师姓名和手机号为必填项' },
        { status: 400 }
      )
    }

    const result = await classInService.addTeacher({
      name: body.name,
      mobile: body.mobile,
      email: body.email || '',
      subject: body.subject || '',
      autoRegister: body.autoRegister !== undefined ? body.autoRegister : 1,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '添加老师失败' },
      { status: 500 }
    )
  }
}
