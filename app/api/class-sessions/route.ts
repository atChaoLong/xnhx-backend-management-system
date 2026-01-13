import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"

const logger = createLogger('API:ClassSessions')

// GET: 获取课时列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const courseId = searchParams.get('course_id')

    logger.debug('获取课时数据', { id, courseId })

    // 如果提供了ID，查询单个课时
    if (id) {
      const { data, error } = await supabaseServer
        .from('class_sessions')
        .select(`
          *,
          course:course_id(id, course_name)
        `)
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取课时失败', { id, message: error.message })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取课时成功', { id })
      return NextResponse.json({ data })
    }

    // 基础查询
    let query = supabaseServer
      .from('class_sessions')
      .select(`
        *,
        course:course_id(id, course_name)
      `)

    // 按课程筛选
    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    // 按课时序号排序
    query = query.order('session_number', { ascending: true })

    const { data, error } = await query

    if (error) {
      logger.error('获取课时列表失败', { message: error.message })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取课时列表成功', { count: data?.length || 0 })
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    logger.error('获取课时异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取课时失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新课时（支持批量创建）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建课时 - 接收到的数据', { body })

    // 检查是否为批量创建
    if (body.sessions && Array.isArray(body.sessions)) {
      // 批量创建
      if (body.sessions.length === 0) {
        return NextResponse.json(
          { error: '课时列表不能为空' },
          { status: 400 }
        )
      }

      const { data, error } = await supabaseServer
        .from('class_sessions')
        .insert(body.sessions)
        .select()

      if (error) {
        logger.error('批量创建课时失败', { message: error.message })
        const { message, status } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }

      logger.info('批量创建课时成功', { count: data?.length || 0 })
      return NextResponse.json({ data: data || [] }, { status: 201 })
    }

    // 单个创建
    if (!body.course_id || typeof body.course_id !== 'string') {
      logger.error('创建课时失败 - 课程ID为空', { body })
      return NextResponse.json(
        { error: '课程ID不能为空' },
        { status: 400 }
      )
    }

    if (!body.session_number || isNaN(body.session_number)) {
      logger.error('创建课时失败 - 课时序号无效', { body })
      return NextResponse.json(
        { error: '课时序号不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      course_id: body.course_id,
      classroom_id: body.classroom_id || null,
      session_number: parseInt(body.session_number),
      session_name: body.session_name || null,
      scheduled_date: body.scheduled_date || null,
      scheduled_time_start: body.scheduled_time_start || null,
      scheduled_time_end: body.scheduled_time_end || null,
      scheduled_duration_minutes: body.scheduled_duration_minutes || null,
      actual_start_time: body.actual_start_time || null,
      actual_end_time: body.actual_end_time || null,
      actual_duration_minutes: body.actual_duration_minutes || null,
      status: body.status || 'scheduled',
      teacher_id: body.teacher_id || null,
      teacher_name: body.teacher_name || null,
      student_attendance_status: body.student_attendance_status || null,
      notes: body.notes || null,
    }

    logger.debug('创建课时 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('class_sessions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建课时失败', { message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建课时成功', { id: data.id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建课时异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建课时失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新课时
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少课时ID' },
        { status: 400 }
      )
    }

    logger.debug('更新课时 - 接收到的数据', { id, updateData })

    const updatePayload: any = {}
    const optionalFields = [
      'classroom_id', 'session_number', 'session_name',
      'scheduled_date', 'scheduled_time_start', 'scheduled_time_end',
      'scheduled_duration_minutes', 'actual_start_time', 'actual_end_time',
      'actual_duration_minutes', 'status', 'teacher_id', 'teacher_name',
      'student_attendance_status', 'notes'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新课时 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('class_sessions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新课时失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新课时成功', { id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新课时异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新课时失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除课时（支持同步删除 ClassIn 课堂）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteClassIn = searchParams.get('delete_classin') === 'true'

    if (!id) {
      return NextResponse.json(
        { error: '缺少课时ID' },
        { status: 400 }
      )
    }

    logger.debug('删除课时', { id, deleteClassIn })

    // 1. 获取课节信息（用于同步删除 ClassIn）
    const { data: session, error: fetchError } = await supabaseServer
      .from('class_sessions')
      .select(`
        id,
        classroom_id,
        course_id,
        courses (
          id,
          classin_course_id
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError) {
      logger.error('获取课时信息失败', { id, message: fetchError.message })
      return NextResponse.json({ error: fetchError.message }, { status: 400 })
    }

    if (!session) {
      return NextResponse.json({ error: '课时不存在' }, { status: 404 })
    }

    // 2. 如果需要同步删除 ClassIn 课堂
    let classInDeleted = false
    let classInError = null

    if (deleteClassIn && session.classroom_id && session.courses?.classin_course_id) {
      try {
        // 获取 ClassIn 课堂信息
        const { data: classroomClassin } = await supabaseServer
          .from('classroom_classin')
          .select('class_id, activity_id')
          .eq('class_id', session.classroom_id)
          .single()

        if (classroomClassin?.activity_id) {
          const sdk = getClassInSDKService()
          await sdk.deleteClassroom({
            courseId: session.courses.classin_course_id,
            classId: session.classroom_id,
            activityId: classroomClassin.activity_id,
          })

          logger.info('删除 ClassIn 课堂成功', {
            classroomId: session.classroom_id,
            activityId: classroomClassin.activity_id,
          })

          // 删除 classroom_classin 记录
          await supabaseServer
            .from('classroom_classin')
            .delete()
            .eq('class_id', session.classroom_id)

          logger.debug('删除 classroom_classin 记录成功', { classroomId: session.classroom_id })
          classInDeleted = true
        }
      } catch (e: any) {
        // 解析错误信息，判断是否是"活动不存在"等可忽略的错误
        const errorMessage = e?.message || ''
        const isNotFoundError =
          errorMessage.includes('活动不存在') ||
          errorMessage.includes('30002') || // ClassIn 错误码
          errorMessage.includes('不存在') ||
          errorMessage.includes('not found')

        if (isNotFoundError) {
          // 活动不存在是预期情况，记录信息日志而不是警告
          logger.info('ClassIn 课堂不存在或已删除，跳过 ClassIn 删除', {
            classroomId: session.classroom_id,
            originalError: errorMessage,
          })
          // 仍然删除 classroom_classin 记录
          try {
            await supabaseServer
              .from('classroom_classin')
              .delete()
              .eq('class_id', session.classroom_id)
          } catch (cleanupError: any) {
            logger.warn('清理 classroom_classin 记录失败', { message: cleanupError?.message })
          }
        } else {
          // 其他错误，记录警告但继续删除本地记录
          classInError = errorMessage
          logger.warn('删除 ClassIn 课堂失败（非致命），将继续删除本地记录', {
            classroomId: session.classroom_id,
            error: errorMessage,
          })
        }
      }
    }

    // 3. 删除本地课节记录
    const { error } = await supabaseServer
      .from('class_sessions')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除课时失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除课时成功', { id, deleteClassIn, classInDeleted, classInError })
    return NextResponse.json({
      success: true,
      data: {
        id,
        deletedClassIn: classInDeleted,
        classInError: classInError,
        message: classInError
          ? `本地记录已删除，但 ClassIn 删除失败：${classInError}`
          : classInDeleted
          ? '课节和 ClassIn 课堂已删除'
          : deleteClassIn
          ? '课节已删除（ClassIn 课堂不存在）'
          : '课节已删除',
      },
    })
  } catch (error: any) {
    logger.error('删除课时异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除课时失败' },
      { status: 500 }
    )
  }
}
