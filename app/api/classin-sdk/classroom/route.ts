import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'

const logger = createLogger('API:ClassIn:Classroom')

/**
 * 创建课堂活动
 * POST /api/classin-sdk/classroom
 * Body: { courseId, unitId, name, teacherUid, startTime, endTime, liveState?, openState?, recordState?, recordType? }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()

    // 验证必填字段
    if (!body.courseId || !body.unitId || !body.name || !body.teacherUid || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: '课程ID、单元ID、课堂名称、老师UID、开始时间和结束时间为必填项' },
        { status: 400 }
      )
    }

    const service = getClassInSDKService()
    const classroom = await service.createClassroom({
      courseId: body.courseId,
      unitId: body.unitId,
      name: body.name,
      teacherUid: body.teacherUid,
      startTime: body.startTime,
      endTime: body.endTime,
      liveState: body.liveState,
      openState: body.openState,
      recordState: body.recordState,
      recordType: body.recordType,
      seatNum: body.seatNum || 2, // 默认一对一（1v1）
    })

    return NextResponse.json({
      success: true,
      data: classroom,
    })
  } catch (error: unknown) {
    logger.error('创建 ClassIn 课堂失败', summarizeError(error))
    return NextResponse.json(
      { error: '创建课堂失败' },
      { status: 500 }
    )
  }
}
