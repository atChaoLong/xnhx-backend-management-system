import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { requireClassInOpsProfile } from "@/lib/server-classin-ops"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:TeachersRegisterClassIn')

export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()
    const { teacherId, telephone, nickname, password } = body

    // 验证必填字段
    if (!teacherId || !telephone || !nickname || !password) {
      return NextResponse.json({
        error: '缺少必填字段'
      }, { status: 400 })
    }

    // 1. 获取老师信息（teachers 表）
    const { data: teacher, error: teacherError } = await supabaseServer
      .from('teachers')
      .select('id, name, classin_phone, used_classin, classin_uid')
      .eq('id', teacherId)
      .single()

    if (teacherError || !teacher) {
      logger.error('获取老师信息失败', { teacherId, error_summary: summarizeError(teacherError) })
      return NextResponse.json({ error: '老师不存在' }, { status: 404 })
    }

    // 2. 检查是否已经入库
    if (teacher.used_classin || teacher.classin_uid) {
      return NextResponse.json({
        error: '该老师已入库到 ClassIn 系统'
      }, { status: 400 })
    }

    // 3. 使用 SDK 注册老师到 ClassIn
    const sdk = getClassInSDKService()

    logger.info('开始注册老师到 ClassIn', {
      teacherId,
      has_telephone: typeof telephone === 'string' && telephone.trim().length > 0,
      has_nickname: typeof nickname === 'string' && nickname.trim().length > 0,
    })

    let uid: number
    try {
      uid = await sdk.registerTeacher({
        telephone,
        nickname,
        password,
      })

      logger.info('ClassIn 老师注册成功', { uid })
    } catch (error: any) {
      logger.error('ClassIn 老师注册失败', { error_summary: summarizeError(error) })
      throw error
    }

    // 4. 更新老师记录，标记已入库并保存 UID
    const { error: updateError } = await supabaseServer
      .from('teachers')
      .update({
        used_classin: true,
        classin_uid: uid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teacherId)

    if (updateError) {
      logger.error('更新老师入库状态失败', { teacherId, error_summary: summarizeError(updateError) })
      return NextResponse.json({
        error: '注册成功但保存状态失败'
      }, { status: 500 })
    }

    // 5. 可选：将老师信息同步到 teacher_classin 表
    try {
      await supabaseServer
        .from('teacher_classin')
        .upsert({
          uid: uid,
          name: nickname,
          mobile: telephone,
          is_del: 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'uid'
        })

      logger.info('老师信息同步到 teacher_classin 表成功', { uid })
    } catch (error: any) {
      logger.warn('同步到 teacher_classin 表失败（非致命）', {
        error_summary: summarizeError(error)
      })
      // 这个错误不是致命的，继续执行
    }

    return NextResponse.json({
      success: true,
      data: {
        uid,
        teacherId,
      }
    })
  } catch (error: any) {
    logger.error('注册老师到 ClassIn 异常', { error_summary: summarizeError(error) })
    return NextResponse.json({
      error: '注册到 ClassIn 失败'
    }, { status: 500 })
  }
}
