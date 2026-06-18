import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:ClassIn:RegisterStudent')

/**
 * 注册学生到 ClassIn
 * POST /api/classin-sdk/register/student
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

    // 1. 注册学生
    const studentUid = await service.registerStudent({
      telephone: body.telephone,
      nickname: body.nickname,
      password: body.password,
    })

    // 2. 添加学生到机构（确保在后台显示）
    try {
      await service.addSchoolStudent({
        studentAccount: body.telephone,
        studentName: body.nickname,
      })
    } catch (addError: any) {
      // addSchoolStudent 失败不影响注册结果
      logger.warn('添加学生到机构失败（可能已存在）', summarizeError(addError))
    }

    return NextResponse.json({
      success: true,
      data: {
        studentUid,
      },
    })
  } catch (error: any) {
    logger.error('注册学生到 ClassIn 失败', summarizeError(error))
    return NextResponse.json(
      { error: '注册学生失败' },
      { status: 500 }
    )
  }
}
