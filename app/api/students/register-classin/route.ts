import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:StudentsRegisterClassIn')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, telephone, nickname, password } = body

    // 验证必填字段
    if (!studentId || !telephone || !nickname || !password) {
      return NextResponse.json({
        error: '缺少必填字段'
      }, { status: 400 })
    }

    // 1. 获取学生信息
    const { data: student, error: studentError } = await supabaseServer
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      logger.error('获取学生信息失败', { studentId, error: studentError })
      return NextResponse.json({ error: '学生不存在' }, { status: 404 })
    }

    // 2. 检查是否已经注册过 ClassIn
    if (student.classin_uid) {
      return NextResponse.json({
        error: '该学生已注册到 ClassIn 系统'
      }, { status: 400 })
    }

    // 3. 使用 SDK 注册学生到 ClassIn
    const sdk = getClassInSDKService()

    logger.info('开始注册学生到 ClassIn', {
      studentId,
      telephone,
      nickname,
    })

    let uid: number
    try {
      uid = await sdk.registerStudent({
        telephone,
        nickname,
        password,
      })

      logger.info('ClassIn 学生注册成功', { uid })
    } catch (error: any) {
      logger.error('ClassIn 学生注册失败', {
        message: error.message,
        stack: error.stack
      })
      throw error
    }

    // 4. 将学生添加到机构
    try {
      await sdk.addSchoolStudent({
        studentAccount: telephone,
        studentName: nickname,
      })

      logger.info('学生添加到机构成功', { studentAccount: telephone })
    } catch (error: any) {
      logger.warn('添加学生到机构失败（可能已存在）', {
        message: error.message
      })
      // 这个错误不是致命的，继续执行
    }

    // 5. 更新学生记录，保存 ClassIn UID
    const { error: updateError } = await supabaseServer
      .from('students')
      .update({
        classin_uid: uid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)

    if (updateError) {
      logger.error('更新学生 ClassIn UID 失败', { studentId, error: updateError })
      return NextResponse.json({
        error: '注册成功但保存 UID 失败'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        uid,
        studentId,
      }
    })
  } catch (error: any) {
    logger.error('注册学生到 ClassIn 异常', {
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json({
      error: error.message || '注册到 ClassIn 失败'
    }, { status: 500 })
  }
}
