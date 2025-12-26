import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'

/**
 * 注册学生到 ClassIn
 * POST /api/classin-sdk/register/student
 * Body: { telephone, nickname, password }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证必填字段
    if (!body.telephone || !body.nickname || !body.password) {
      return NextResponse.json(
        { error: '手机号、昵称和密码为必填项' },
        { status: 400 }
      )
    }

    const service = getClassInSDKService()
    const studentUid = await service.registerStudent({
      telephone: body.telephone,
      nickname: body.nickname,
      password: body.password,
    })

    return NextResponse.json({
      success: true,
      data: {
        studentUid,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '注册学生失败' },
      { status: 500 }
    )
  }
}
