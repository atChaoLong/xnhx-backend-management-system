import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('ClassIn:Classrooms')

const CLASSIN_CLASSROOM_SELECT = [
  'class_id',
  'name',
  'course_id',
  'course_name',
  'start_time',
  'end_time',
  'sync_time',
  'activity_id',
].join(',')

export async function GET(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('classroom_classin')
      .select('class_id', { count: 'exact', head: true })

    // 分页查询数据
    const { data, error } = await supabaseServer
      .from('classroom_classin')
      .select(CLASSIN_CLASSROOM_SELECT)
      .order('start_time', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('查询 ClassIn 课堂失败', summarizeError(error))
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      )
    }

    const classrooms = (data || []).map((classroom: any) => ({
      ...classroom,
      stu_num: 0,
      audit_num: 0,
      class_status: 0,
    }))

    return NextResponse.json({
      success: true,
      data: classrooms,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: unknown) {
    logger.error('获取 ClassIn 课堂数据异常', summarizeError(error))
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()

    // 验证必需参数
    const { courseId, classId } = body
    if (!courseId || !classId) {
      return NextResponse.json(
        { error: '缺少必需参数: courseId, classId' },
        { status: 400 }
      )
    }

    // 先检查课节是否存在
    const { data: existingClass, error: fetchError } = await supabaseServer
      .from('classroom_classin')
      .select('class_id, activity_id')
      .eq('class_id', classId)
      .single()

    if (fetchError || !existingClass) {
      if (fetchError) {
        logger.warn('查询待修改 ClassIn 课堂失败', summarizeError(fetchError))
      }
      return NextResponse.json(
        { error: '课节不存在' },
        { status: 404 }
      )
    }

    // 使用数据库中的 activity_id
    const activityId = existingClass.activity_id || classId

    // 调用ClassIn SDK服务修改课节
    const service = getClassInSDKService()
    const result = await service.updateClassroom({
      courseId,
      classId,
      activityId: activityId, // 使用数据库中的 activity_id
      name: body.className,
      startTime: body.beginTime ? parseInt(body.beginTime) : undefined,
      endTime: body.endTime ? parseInt(body.endTime) : undefined,
      teacherUid: body.teacherUid,
      recordState: body.record,
      liveState: body.live,
      openState: body.replay,
    })

    // 更新本地数据库记录
    if (result) {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (body.className) {
        updateData.name = body.className
      }
      if (body.beginTime) {
        updateData.start_time = parseInt(body.beginTime)
      }
      if (body.endTime) {
        updateData.end_time = parseInt(body.endTime)
      }
      if (body.teacherUid) {
        updateData.teacher_uid = body.teacherUid
      }

      const { error: updateError } = await supabaseServer
        .from('classroom_classin')
        .update(updateData)
        .eq('class_id', classId)

      if (updateError) {
        logger.error('更新本地课堂记录失败', summarizeError(updateError))
        return NextResponse.json(
          { error: '数据库更新失败' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: '课节修改成功'
    })
  } catch (error: unknown) {
    logger.error('修改课节异常', summarizeError(error))
    return NextResponse.json(
      { error: '修改课节失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const classId = searchParams.get('classId')

    // 验证必需参数
    if (!courseId || !classId) {
      return NextResponse.json(
        { error: '缺少必需参数: courseId, classId' },
        { status: 400 }
      )
    }

    // 先检查课节是否存在
    const { data: existingClass, error: fetchError } = await supabaseServer
      .from('classroom_classin')
      .select('class_id, activity_id')
      .eq('class_id', classId)
      .single()

    if (fetchError || !existingClass) {
      if (fetchError) {
        logger.warn('查询待删除 ClassIn 课堂失败', summarizeError(fetchError))
      }
      return NextResponse.json(
        { error: '课节不存在' },
        { status: 404 }
      )
    }

    // 使用数据库中的 activity_id
    const activityId = existingClass.activity_id || parseInt(classId)

    // 调用ClassIn SDK服务删除课节
    const service = getClassInSDKService()
    const result = await service.deleteClassroom({
      courseId: parseInt(courseId),
      activityId: activityId,
    })

    // 删除本地数据库记录
    if (result) {
      const { error: deleteError } = await supabaseServer
        .from('classroom_classin')
        .delete()
        .eq('class_id', classId)

      if (deleteError) {
        logger.error('删除本地课堂记录失败', summarizeError(deleteError))
        return NextResponse.json(
          { error: '数据库删除失败' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: '课节删除成功'
    })
  } catch (error: unknown) {
    logger.error('删除课节异常', summarizeError(error))
    return NextResponse.json(
      { error: '删除课节失败' },
      { status: 500 }
    )
  }
}
