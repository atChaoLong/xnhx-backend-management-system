import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { getAccessibleStudentIds, restrictByIds } from "@/lib/server-business-scope"
import { canViewStudentClassInSecrets } from "@/lib/server-student-redaction"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:StudentsRegisterClassIn')

export async function POST(request: NextRequest) {
  try {
    const profile = await getProfileFromHeaders(request)

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    if (!canViewStudentClassInSecrets(profile)) {
      return NextResponse.json(
        { error: '无权注册学生 ClassIn 账号' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { studentId, telephone, nickname, password } = body

    // 验证必填字段
    if (!studentId || !telephone || !nickname || !password) {
      return NextResponse.json({
        error: '缺少必填字段'
      }, { status: 400 })
    }

    // 1. 获取学生信息
    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    let studentQuery = supabaseServer
      .from('students')
      .select('id,student_name,parent_phone,classin_uid')
      .eq('id', studentId)

    studentQuery = restrictByIds(studentQuery, 'id', accessibleStudentIds)

    const { data: student, error: studentError } = await studentQuery.maybeSingle()

    if (studentError || !student) {
      logger.error('获取学生信息失败', { studentId, error_summary: summarizeError(studentError) })
      return NextResponse.json(
        { error: accessibleStudentIds === null ? '学生不存在' : '无权操作该学生' },
        { status: accessibleStudentIds === null ? 404 : 403 }
      )
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
      has_telephone: typeof telephone === 'string' && telephone.trim().length > 0,
      has_nickname: typeof nickname === 'string' && nickname.trim().length > 0,
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
      logger.error('ClassIn 学生注册失败', { error_summary: summarizeError(error) })
      throw error
    }

    // 4. 将学生添加到机构
    try {
      await sdk.addSchoolStudent({
        studentAccount: telephone,
        studentName: nickname,
      })

      logger.info('学生添加到机构成功', {
        has_student_account: typeof telephone === 'string' && telephone.trim().length > 0,
      })
    } catch (error: any) {
      logger.warn('添加学生到机构失败（可能已存在）', {
        error_summary: summarizeError(error)
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
      logger.error('更新学生 ClassIn UID 失败', { studentId, error_summary: summarizeError(updateError) })
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
    logger.error('注册学生到 ClassIn 异常', { error_summary: summarizeError(error) })
    return NextResponse.json({
      error: '注册到 ClassIn 失败'
    }, { status: 500 })
  }
}
