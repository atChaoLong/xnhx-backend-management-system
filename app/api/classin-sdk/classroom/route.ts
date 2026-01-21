import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'

/**
 * 创建课堂活动
 * POST /api/classin-sdk/classroom
 * Body: { courseId, unitId, name, teacherUid, startTime, endTime, liveState?, openState?, recordState?, recordType? }
 */
export async function POST(request: NextRequest) {
  try {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '创建课堂失败' },
      { status: 500 }
    )
  }
}
