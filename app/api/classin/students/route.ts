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
