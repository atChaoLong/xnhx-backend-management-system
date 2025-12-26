import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'

/**
 * 创建课程
 * POST /api/classin-sdk/course
 * Body: { courseName }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证必填字段
    if (!body.courseName) {
      return NextResponse.json(
        { error: '课程名称为必填项' },
        { status: 400 }
      )
    }

    const service = getClassInSDKService()
    const courseId = await service.createCourse({
      courseName: body.courseName,
    })

    return NextResponse.json({
      success: true,
      data: {
        courseId,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '创建课程失败' },
      { status: 500 }
    )
  }
}
