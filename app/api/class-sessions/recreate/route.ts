import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"

const logger = createLogger('API:ClassSessions:Recreate')

interface ScheduleItem {
  studentName: string
  teacherName: string
  subject?: string
  date: string
  startTime: string
  endTime: string
}

/**
 * 重新创建课节
 * POST /api/class-sessions/recreate
 * Body: {
 *   courseId: string,        // 课程ID（必填）
 *   items: ScheduleItem[],   // 排课列表（必填）
 *   skipExisting?: boolean   // 跳过已存在的课节（默认true）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courseId, items, skipExisting = true } = body

    if (!courseId) {
      return NextResponse.json(
        { error: '课程ID不能为空' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '排课列表不能为空' },
        { status: 400 }
      )
    }

    logger.debug('重新创建课节', { courseId, itemCount: items.length, skipExisting })

    // 1. 获取课程信息
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id, course_name, teacher_name, student_id, formal_orders(student_id)')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      logger.error('课程不存在', { courseId })
      return NextResponse.json({ error: '课程不存在' }, { status: 404 })
    }

    if (!course.classin_course_id) {
      logger.error('课程未关联 ClassIn', { courseId })
      return NextResponse.json({ error: '课程未关联 ClassIn，无法创建课节' }, { status: 400 })
    }

    // 2. 获取学生信息
    let studentName = ''
    if (course.student_id) {
      const { data: student } = await supabaseServer
        .from('students')
        .select('student_name')
        .eq('id', course.student_id)
        .single()
      studentName = student?.student_name || ''
    }

    if (!studentName) {
      // 尝试从排课列表获取学生姓名
      studentName = items[0]?.studentName || ''
    }

    if (!studentName) {
      return NextResponse.json({ error: '无法获取学生姓名' }, { status: 400 })
    }

    // 3. 获取现有课节列表（用于检查重复）
    const existingSessionsMap = new Map<string, any>()
    if (skipExisting) {
      const { data: existingSessions } = await supabaseServer
        .from('class_sessions')
        .select('id, session_number, scheduled_date, scheduled_time_start, scheduled_time_end')
        .eq('course_id', courseId)

      if (existingSessions) {
        for (const session of existingSessions) {
          const key = `${session.scheduled_date}_${session.scheduled_time_start}_${session.scheduled_time_end}`
          existingSessionsMap.set(key, session)
        }
      }
      logger.debug('现有课节', { count: existingSessionsMap.size })
    }

    // 4. 获取教师 ClassIn 信息
    const firstItem = items[0]
    if (!firstItem?.teacherName) {
      return NextResponse.json({ error: '排课列表缺少教师姓名' }, { status: 400 })
    }

    const { data: teacherClassin, error: teacherError } = await supabaseServer
      .from("teacher_classin")
      .select("uid, name")
      .eq("name", firstItem.teacherName)
      .eq("is_del", 0)
      .single()

    if (teacherError || !teacherClassin?.uid) {
      return NextResponse.json({ error: `教师未绑定 ClassIn：${firstItem.teacherName}` }, { status: 400 })
    }

    const sdk = getClassInSDKService()
    let created = 0
    let skipped = 0
    const results: any[] = []

    // 5. 遍历排课列表，创建课节
    for (const raw of items) {
      try {
        // 检查必要字段
        if (!raw.date || !raw.startTime || !raw.endTime) {
          throw new Error("缺少必要字段：date/startTime/endTime")
        }

        // 检查是否已存在
        const key = `${raw.date}_${raw.startTime}_${raw.endTime}`
        if (skipExisting && existingSessionsMap.has(key)) {
          skipped++
          logger.debug('跳过已存在的课节', { key })
          continue
        }

        // 获取教师信息（每个排课项可能不同）
        const { data: itemTeacher } = await supabaseServer
          .from("teacher_classin")
          .select("uid")
          .eq("name", raw.teacherName)
          .eq("is_del", 0)
          .single()

        if (!itemTeacher?.uid) {
          throw new Error(`教师未绑定 ClassIn：${raw.teacherName}`)
        }

        // 创建 ClassIn 课堂
        const classroomName = course.course_name || `【正式】${studentName} ${raw.subject || ''}课`
        const startTime = new Date(`${raw.date}T${raw.startTime}`)
        const endTime = new Date(`${raw.date}T${raw.endTime}`)

        const classroomRes = await sdk.createClassroom({
          courseId: course.classin_course_id,
          name: classroomName,
          teacherUid: itemTeacher.uid,
          startTime,
          endTime,
          liveState: 0,
          openState: 0,
          recordState: 1,
          recordType: 0,
        })

        // 同步到 classroom_classin 表
        try {
          await supabaseServer
            .from("classroom_classin")
            .upsert(
              {
                class_id: classroomRes.classId,
                name: classroomName,
                start_time: Math.floor(startTime.getTime() / 1000),
                end_time: Math.floor(endTime.getTime() / 1000),
                course_id: course.classin_course_id,
                course_name: course.course_name,
                activity_id: classroomRes.activityId,
                created_at_timestamp: Math.floor(Date.now() / 1000),
                sync_time: new Date().toISOString(),
              },
              { onConflict: "class_id" }
            )
        } catch (e: any) {
          logger.warn("写入 classroom_classin 失败（非致命）", { message: e?.message })
        }

        // 创建本地课节记录
        // 获取当前课节序号（已有课节数 + 新创建数）
        const { data: currentSessions } = await supabaseServer
          .from('class_sessions')
          .select('id')
          .eq('course_id', courseId)

        const sessionNumber = (currentSessions?.length || 0) + created + 1
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)

        const { data: sessionData, error: sessionError } = await supabaseServer
          .from("class_sessions")
          .insert({
            course_id: courseId,
            classroom_id: classroomRes.classId,
            session_number: sessionNumber,
            session_name: `第${sessionNumber}节`,
            scheduled_date: raw.date,
            scheduled_time_start: raw.startTime,
            scheduled_time_end: raw.endTime,
            scheduled_duration_minutes: durationMinutes,
            status: 'scheduled',
            teacher_name: raw.teacherName,
          })
          .select('id')
          .single()

        if (sessionError) {
          throw new Error(`创建课节失败：${sessionError.message}`)
        }

        logger.info('创建课节成功', {
          sessionId: sessionData.id,
          sessionNumber,
          classroomId: classroomRes.classId,
        })

        created++
        results.push({
          sessionId: sessionData.id,
          classroomId: classroomRes.classId,
          activityId: classroomRes.activityId,
          sessionNumber,
          date: raw.date,
          startTime: raw.startTime,
          endTime: raw.endTime,
        })
      } catch (e: any) {
        logger.warn("创建课节失败", { message: e?.message, item: raw })
      }
    }

    logger.info('重新创建课节完成', { courseId, created, skipped, total: items.length })

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: items.length,
      results,
    })
  } catch (error: any) {
    logger.error('重新创建课节异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '重新创建课节失败' },
      { status: 500 }
    )
  }
}
