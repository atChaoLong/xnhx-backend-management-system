import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"

const logger = createLogger('API:Students')

// GET: 获取学生列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取学生数据', { id, from, to })

    if (id) {
      // 单个学生查询
      const { data, error } = await supabaseServer
        .from('students')
        .select(`
          id,
          created_at,
          updated_at,
          student_code,
          student_name,
          grade_code,
          region,
          school,
          parent_phone,
          head_teacher_id,
          status,
          classin_initial_password,
          classin_uid
        `)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取学生失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      // 如果有班主任ID，获取班主任姓名
      let studentWithTeacher = data
      if (data?.head_teacher_id) {
        const { data: teacher } = await supabaseServer
          .from('user_profiles')
          .select('name')
          .eq('id', data.head_teacher_id)
          .single()

        studentWithTeacher = {
          ...data,
          head_teacher_name: teacher?.name,
        } as typeof data & { head_teacher_name?: string }
      }

      logger.debug('获取学生成功', { id })
      return NextResponse.json({ data: studentWithTeacher })
    }

    // 获取总数
    const { count: totalCount } = await supabaseServer
      .from('students')
      .select('*', { count: 'exact', head: true })

    // 获取学生列表
    const { data, error } = await supabaseServer
      .from('students')
      .select(`
        id,
        created_at,
        updated_at,
        student_code,
        student_name,
        grade_code,
        region,
        school,
        parent_phone,
        head_teacher_id,
        status,
        classin_initial_password,
        classin_uid
      `)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取学生列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // 批量获取班主任信息
    let studentsWithTeachers = data || []
    if (data && data.length > 0) {
      // 收集所有唯一的班主任ID
      const headTeacherIds = Array.from(
        new Set(data.map(s => s.head_teacher_id).filter(Boolean))
      )

      // 批量查询班主任信息
      let teacherMap = new Map<string, string>()
      if (headTeacherIds.length > 0) {
        const { data: teachers } = await supabaseServer
          .from('user_profiles')
          .select('id, name')
          .in('id', headTeacherIds)

        if (teachers) {
          teachers.forEach(teacher => {
            teacherMap.set(teacher.id, teacher.name)
          })
        }
      }

      // 添加班主任姓名到学生数据
      studentsWithTeachers = data.map(student => ({
        ...student,
        head_teacher_name: student.head_teacher_id
          ? (teacherMap.get(student.head_teacher_id) || null)
          : null,
      })) as Array<typeof data[0] & { head_teacher_name?: string | null }>
    }

    logger.debug('获取学生列表成功', { count: studentsWithTeachers.length })
    return NextResponse.json({
      data: studentsWithTeachers,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取学生失败' },
      { status: 500 }
    )
  }
}

/**
 * 创建新学生，并自动注册到 ClassIn 系统（使用统一初始密码）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建学生 - 接收到的数据', { body, student_name: body?.student_name, student_name_type: typeof body?.student_name })

    // 后端验证：学生姓名与学生编号必填
    if (!body.student_name || typeof body.student_name !== 'string' || !body.student_name.trim()) {
      logger.error('创建学生失败 - 学生姓名为空', { body })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }
    if (!body.student_code || typeof body.student_code !== 'string' || !body.student_code.trim()) {
      logger.error('创建学生失败 - 学号为空', { body })
      return NextResponse.json(
        { error: '学生编号（学号）不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      student_code: body.student_code.trim(),
      student_name: body.student_name.trim(),
      grade_code: body.grade_code || null,
      region: body.region || null,
      school: body.school?.trim() || null,
      parent_phone: body.parent_phone?.trim() || null,
      head_teacher_id: body.head_teacher_id || null,
      status: body.status || 'active',
    }

    logger.debug('创建学生 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('students')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建学生失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建学生成功', { id: data.id, student_name: data.student_name })

    // 自动注册到 ClassIn：需要家长电话作为账号、学生姓名作为昵称
    const telephone = insertData.parent_phone
    const nickname = insertData.student_name
    const initialPassword = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("")

    if (!telephone) {
      return NextResponse.json(
        { error: '注册到 ClassIn 需要填写家长电话（parent_phone）' },
        { status: 400 }
      )
    }

    // 随机纯数字初始密码，无需环境变量

    const sdk = getClassInSDKService()

    try {
      const uid = await sdk.registerStudent({
        telephone,
        nickname,
        password: initialPassword,
      })

      try {
        await sdk.addSchoolStudent({
          studentAccount: telephone,
          studentName: nickname,
        })
      } catch (e: any) {
        logger.warn('添加学生到机构失败（可能已存在）', { message: e?.message })
      }

      const { error: updateError } = await supabaseServer
        .from('students')
        .update({
          classin_initial_password: initialPassword,
          classin_uid: uid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      if (updateError) {
        logger.error('更新学生 ClassIn UID 失败', { id: data.id, error: updateError })
        return NextResponse.json(
          { error: '注册成功但保存 UID 失败' },
          { status: 500 }
        )
      }

      const merged = { ...data, classin_uid: uid, classin_initial_password: initialPassword }
      return NextResponse.json({ data: merged }, { status: 201 })
    } catch (err: any) {
      logger.error('注册学生到 ClassIn 异常', { message: err.message, stack: err.stack })
      return NextResponse.json(
        { error: err.message || '注册到 ClassIn 失败' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('创建学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建学生失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新学生
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    logger.debug('更新学生 - 接收到的数据', { id, updateData, student_name: updateData?.student_name })

    // 后端验证：学生姓名必填
    if (!updateData.student_name || typeof updateData.student_name !== 'string' || !updateData.student_name.trim()) {
      logger.error('更新学生失败 - 学生姓名为空', { id, updateData })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    const updatePayload = {
      student_number: updateData.student_number?.trim() || null,
      student_name: updateData.student_name.trim(),
      grade_code: updateData.grade_code || null,
      region: updateData.region || null,
      school: updateData.school?.trim() || null,
      parent_phone: updateData.parent_phone?.trim() || null,
      head_teacher_id: updateData.head_teacher_id || null,
      status: updateData.status || 'active',
    }

    logger.debug('更新学生 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('students')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新学生失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新学生成功', { id, student_name: data.student_name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新学生失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除学生
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    logger.debug('删除学生', { id })

    const { error } = await supabaseServer
      .from('students')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除学生失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除学生成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除学生失败' },
      { status: 500 }
    )
  }
}
