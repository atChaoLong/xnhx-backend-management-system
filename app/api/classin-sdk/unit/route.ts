import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'

const logger = createLogger('API:ClassIn:Unit')

/**
 * 创建单元
 * POST /api/classin-sdk/unit
 * Body: { courseId, name, publishFlag? }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

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
  } catch (error: unknown) {
    logger.error('创建 ClassIn 单元失败', summarizeError(error))
    return NextResponse.json(
      { error: '创建单元失败' },
      { status: 500 }
    )
  }
}
