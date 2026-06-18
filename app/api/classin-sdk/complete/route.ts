import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'

const logger = createLogger('API:ClassIn:Complete')

/**
 * 一键创建课程和课堂（推荐）
 * POST /api/classin-sdk/complete
 * Body: {
 *   teacher: { telephone, nickname, password },
 *   course: { courseName },
 *   unit?: { name },
 *   classroom: { name, startTime, endTime }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()

    // 验证必填字段
    if (!body.teacher || !body.course || !body.classroom) {
      return NextResponse.json(
        { error: '老师信息、课程信息和课堂信息为必填项' },
        { status: 400 }
      )
    }

    if (!body.teacher.telephone || !body.teacher.nickname || !body.teacher.password) {
      return NextResponse.json(
        { error: '老师手机号、昵称和密码为必填项' },
        { status: 400 }
      )
    }

    if (!body.course.courseName) {
      return NextResponse.json(
        { error: '课程名称为必填项' },
        { status: 400 }
      )
    }

    if (!body.classroom.name || !body.classroom.startTime || !body.classroom.endTime) {
      return NextResponse.json(
        { error: '课堂名称、开始时间和结束时间为必填项' },
        { status: 400 }
      )
    }

    const service = getClassInSDKService()
    const result = await service.createCompleteClassroom({
      teacher: body.teacher,
      course: body.course,
      unit: body.unit,
      classroom: body.classroom,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    logger.error('一键创建 ClassIn 课程和课堂失败', summarizeError(error))
    return NextResponse.json(
      { error: '创建课程和课堂失败' },
      { status: 500 }
    )
  }
}
