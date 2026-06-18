import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'

const logger = createLogger('API:ClassIn:Course')

/**
 * 创建课程
 * POST /api/classin-sdk/course
 * Body: { courseName }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

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
  } catch (error: unknown) {
    logger.error('创建 ClassIn 课程失败', summarizeError(error))
    return NextResponse.json(
      { error: '创建课程失败' },
      { status: 500 }
    )
  }
}
