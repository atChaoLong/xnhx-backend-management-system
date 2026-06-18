import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'

const logger = createLogger('API:ClassIn:RegisterTeacher')

/**
 * 注册老师到 ClassIn
 * POST /api/classin-sdk/register/teacher
 * Body: { telephone, nickname, password }
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()

    // 验证必填字段
    if (!body.telephone || !body.nickname || !body.password) {
      return NextResponse.json(
        { error: '手机号、昵称和密码为必填项' },
        { status: 400 }
      )
    }

    const service = getClassInSDKService()
    const teacherUid = await service.registerTeacher({
      telephone: body.telephone,
      nickname: body.nickname,
      password: body.password,
    })

    return NextResponse.json({
      success: true,
      data: {
        teacherUid,
      },
    })
  } catch (error: unknown) {
    logger.error('注册老师到 ClassIn 失败', summarizeError(error))
    return NextResponse.json(
      { error: '注册老师失败' },
      { status: 500 }
    )
  }
}
