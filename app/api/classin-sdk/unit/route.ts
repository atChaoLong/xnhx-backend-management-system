import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'

/**
 * 创建单元
 * POST /api/classin-sdk/unit
 * Body: { courseId, name, publishFlag? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证必填字段
    if (!body.courseId || !body.name) {
      return NextResponse.json(
        { error: '课程ID和单元名称为必填项' },
        { status: 400 }
      )
    }

    const service = getClassInSDKService()
    const unitId = await service.createUnit({
      courseId: body.courseId,
      name: body.name,
      publishFlag: body.publishFlag,
    })

    return NextResponse.json({
      success: true,
      data: {
        unitId,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '创建单元失败' },
      { status: 500 }
    )
  }
}
