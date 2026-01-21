import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"

const logger = createLogger("API:ScheduleBatchCreateClassIn")

interface SchedulePayloadItem {
  studentName: string
  teacherName: string
  subject: string
  date: string
  startTime: string
  endTime: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, orderId, className } = body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "请求体缺少 items 或为空" }, { status: 400 })
    }

    if (!orderId) {
      return NextResponse.json({ error: "缺少 orderId" }, { status: 400 })
    }

    // 获取订单信息
    const { data: order, error: orderError } = await supabaseServer
      .from('formal_orders')
      .select('id, student_id, total_sessions, total_hours, subjects, teacher_names')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      logger.error('订单不存在', { orderId, error: orderError?.message, code: orderError?.code })
      return NextResponse.json({ error: `订单不存在: ${orderError?.message || '未找到订单'}` }, { status: 404 })
    }

    // 获取学生信息（如果存在）
    let gradeCode = null
    if (order.student_id) {
      const { data: student } = await supabaseServer
        .from('students')
        .select('grade_code')
        .eq('id', order.student_id)
        .single()
      gradeCode = student?.grade_code || null
    }

    const sdk = getClassInSDKService()
    let success = 0
    const results: any[] = []

    const scheduleItems = items as SchedulePayloadItem[]

    const first = scheduleItems[0]
    if (!first.teacherName || !first.studentName) {
      return NextResponse.json({ error: "首条记录缺少 teacherName 或 studentName" }, { status: 400 })
    }

    const courseName = className?.trim() || `${first.studentName} ${first.subject || ""}课`

    // 1. 先检查订单是否已有课程（检查本地和 ClassIn）
    let courseId: string | null = null
    let localCourseId: string | null = null

    const { data: existingCourse, error: fetchError } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id, course_name')
      .eq('order_id', orderId)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error("查询现有课程失败", { orderId, message: fetchError.message })
    }

    const subject = order.subjects?.[0] || first.subject
    const teacherName = order.teacher_names?.[0] || first.teacherName
    const grade = gradeCode

    // 尝试查找教师ID
    let teacherId = null
    if (teacherName) {
      const { data: teacherProfile } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('name', teacherName)
        .single()
      teacherId = teacherProfile?.id || null
    }

    if (existingCourse) {
      // 2a. 课程已存在，使用现有课程
      localCourseId = existingCourse.id
      courseId = existingCourse.classin_course_id
      logger.info("使用现有课程", { orderId, localCourseId, classinCourseId: courseId })

      // 如果本地有课程但 ClassIn course_id 为空，需要创建
      if (!courseId) {
        logger.info("本地课程存在但 ClassIn 课程 ID 为空，创建新 ClassIn 课程", { localCourseId })

        const { data: firstTeacher, error: firstTErr } = await supabaseServer
          .from("teacher_classin")
          .select("*")
          .eq("name", first.teacherName)
          .eq("is_del", 0)
          .single()
        if (firstTErr || !firstTeacher?.uid) {
          return NextResponse.json({ error: `教师未绑定 ClassIn：${first.teacherName}` }, { status: 400 })
        }

        courseId = await sdk.createCourse({ courseName })

        // 更新本地课程的 ClassIn ID
        const { error: updateError } = await supabaseServer
          .from('courses')
          .update({
            classin_course_id: courseId,
            course_name: courseName,
          })
          .eq('id', existingCourse.id)

        if (updateError) {
          logger.warn("更新课程 ClassIn ID 失败", { localCourseId, message: updateError.message })
        } else {
          logger.info("更新课程 ClassIn ID 成功", { localCourseId, classinCourseId: courseId })
        }

        // 写入 class_classin 表
        try {
          await supabaseServer
            .from("class_classin")
            .upsert(
              {
                course_id: courseId,
                course_name: courseName,
                creator_uid: firstTeacher.uid,
                creater_name: first.teacherName,
                add_time: Math.floor(Date.now() / 1000),
                course_state: 1,
                sync_time: new Date().toISOString(),
              },
              { onConflict: "course_id" }
            )
        } catch (e: any) {
          logger.warn("写入 class_classin 失败（非致命）", { message: e?.message })
        }
      }
    } else {
      // 2b. 课程不存在，创建新课程
      logger.info("课程不存在，创建新 ClassIn 课程和本地课程", { orderId })

      const { data: firstTeacher, error: firstTErr } = await supabaseServer
        .from("teacher_classin")
        .select("*")
        .eq("name", first.teacherName)
        .eq("is_del", 0)
        .single()
      if (firstTErr || !firstTeacher?.uid) {
        return NextResponse.json({ error: `教师未绑定 ClassIn：${first.teacherName}` }, { status: 400 })
      }

      // 创建 ClassIn 课程
      courseId = await sdk.createCourse({ courseName })

      // 写入 class_classin 表
      try {
        await supabaseServer
          .from("class_classin")
          .upsert(
            {
              course_id: courseId,
              course_name: courseName,
              creator_uid: firstTeacher.uid,
              creater_name: first.teacherName,
              add_time: Math.floor(Date.now() / 1000),
              course_state: 1,
              sync_time: new Date().toISOString(),
            },
            { onConflict: "course_id" }
          )
      } catch (e: any) {
        logger.warn("写入 class_classin 失败（非致命）", { message: e?.message })
      }

      // 创建本地 course 记录
      const { data: courseData, error: courseError } = await supabaseServer
        .from('courses')
        .insert({
          order_id: orderId,
          student_id: order.student_id,
          classin_course_id: courseId,
          course_name: courseName,
          subject: subject,
          grade: grade,
          teacher_id: teacherId,
          teacher_name: teacherName,
          session_count: scheduleItems.length,
          total_hours: order.total_hours || 0,
          course_status: 'active',
          course_consumption_info: JSON.stringify({
            totalSessions: scheduleItems.length,
            completedSessions: 0,
            progress: 0,
            lastSyncTime: new Date().toISOString(),
          }),
          notes: `通过批量排课创建，订单号：${order.id || ''}`,
        })
        .select('id')
        .single()

      if (courseError) {
        logger.error("创建本地 course 记录失败", { orderId, courseId, message: courseError.message })
      } else if (courseData) {
        localCourseId = courseData.id
        logger.info("创建本地 course 记录成功", { orderId, classinCourseId: courseId, localCourseId })
      }
    }

    // 获取现有课节列表（用于检查重复）
    const existingSessionsMap = new Map<string, any>()
    if (localCourseId) {
      const { data: existingSessions } = await supabaseServer
        .from('class_sessions')
        .select('id, session_number, scheduled_date, scheduled_time_start, scheduled_time_end')
        .eq('course_id', localCourseId)

      if (existingSessions) {
        for (const session of existingSessions) {
          const key = `${session.scheduled_date}_${session.scheduled_time_start}_${session.scheduled_time_end}`
          existingSessionsMap.set(key, session)
        }
      }
      logger.debug('现有课节', { count: existingSessionsMap.size })
    }

    let skipped = 0

    for (const raw of scheduleItems) {
      try {
        if (!raw.teacherName || !raw.studentName || !raw.date || !raw.startTime || !raw.endTime) {
          throw new Error("缺少必要字段：teacherName/studentName/date/startTime/endTime")
        }

        // 检查是否已存在相同时间的课节
        const sessionKey = `${raw.date}_${raw.startTime}_${raw.endTime}`
        if (existingSessionsMap.has(sessionKey)) {
          const existing = existingSessionsMap.get(sessionKey)
          logger.debug('跳过已存在的课节', {
            key: sessionKey,
            existingSessionId: existing.id,
            sessionNumber: existing.session_number,
          })
          skipped++
          continue
        }

        const { data: teacherClassin, error: tErr } = await supabaseServer
          .from("teacher_classin")
          .select("*")
          .eq("name", raw.teacherName)
          .eq("is_del", 0)
          .single()
        if (tErr || !teacherClassin?.uid) throw new Error(`教师未绑定 ClassIn：${raw.teacherName}`)

        const classroomName = courseName
        const startTime = new Date(`${raw.date}T${raw.startTime}`)
        const endTime = new Date(`${raw.date}T${raw.endTime}`)

        logger.debug("准备创建 ClassIn 课堂", {
          courseId,
          classroomName,
          teacherUid: teacherClassin.uid,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })

        let classroomRes: any
        try {
          classroomRes = await sdk.createClassroom({
            courseId,
            name: classroomName,
            teacherUid: teacherClassin.uid,
            startTime,
            endTime,
            liveState: 0,
            openState: 0,
            recordState: 1,
            recordType: 0,
            seatNum: 2, // 一对一（1v1）
          })

          logger.info("创建 ClassIn 课堂成功", {
            classId: classroomRes.classId,
            activityId: classroomRes.activityId,
          })
        } catch (e: any) {
          logger.error("创建 ClassIn 课堂失败", {
            courseId,
            classroomName,
            error: e?.message,
            stack: e?.stack,
          })
          throw e // 重新抛出，跳过这条记录
        }

        try {
          const classroomClassinData = {
            class_id: classroomRes.classId,
            name: classroomName,
            start_time: Math.floor(startTime.getTime() / 1000),
            end_time: Math.floor(endTime.getTime() / 1000),
            course_id: courseId,
            course_name: courseName,
            activity_id: classroomRes.activityId,
            created_at_timestamp: Math.floor(Date.now() / 1000),
            sync_time: new Date().toISOString(),
          }

          logger.debug("准备写入 classroom_classin", { data: classroomClassinData })

          const { error: upsertError } = await supabaseServer
            .from("classroom_classin")
            .upsert(classroomClassinData, { onConflict: "class_id" })

          if (upsertError) {
            logger.error("写入 classroom_classin 失败", {
              error: upsertError.message,
              code: upsertError.code,
              details: upsertError.details,
            })
            throw new Error(`写入 classroom_classin 失败: ${upsertError.message}`)
          }

          logger.info("写入 classroom_classin 成功", { classId: classroomRes.classId })
        } catch (e: any) {
          logger.error("写入 classroom_classin 异常", {
            message: e?.message,
            stack: e?.stack,
            classId: classroomRes.classId,
          })
          throw e // 重新抛出，跳过这条记录
        }

        // 创建本地 class_session 记录（课节）
        if (localCourseId) {
          try {
            // 获取当前课节数量（用于计算序号）
            const currentCount = existingSessionsMap.size + success

            // 计算课时序号（从1开始）
            const sessionNumber = currentCount + 1

            // 计算时长（分钟）
            const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)

            const sessionDataToInsert = {
              course_id: localCourseId,
              classroom_id: classroomRes.classId,
              session_number: sessionNumber,
              session_name: `第${sessionNumber}节`,
              scheduled_date: raw.date,
              scheduled_time_start: raw.startTime,
              scheduled_time_end: raw.endTime,
              scheduled_duration_minutes: durationMinutes,
              status: 'scheduled' as const,
              teacher_name: raw.teacherName,
            }

            logger.debug("准备创建课节记录", {
              localCourseId,
              sessionNumber,
              classroomId: classroomRes.classId,
              data: sessionDataToInsert
            })

            const { data: sessionData, error: sessionError } = await supabaseServer
              .from("class_sessions")
              .insert(sessionDataToInsert)
              .select('id')
              .single()

            if (sessionError) {
              logger.error("插入 class_session 失败", {
                localCourseId,
                sessionNumber,
                error: sessionError.message,
                code: sessionError.code,
                details: sessionError.details,
                hint: sessionError.hint,
              })
              throw new Error(`插入课节失败: ${sessionError.message}`)
            }

            if (!sessionData) {
              logger.error("插入 class_session 返回空数据", {
                localCourseId,
                sessionNumber,
              })
              throw new Error("插入课节返回空数据")
            }

            // 添加到现有课节Map，避免后续重复
            existingSessionsMap.set(sessionKey, {
              id: sessionData.id,
              session_number: sessionNumber,
              scheduled_date: raw.date,
              scheduled_time_start: raw.startTime,
              scheduled_time_end: raw.endTime,
            })

            logger.info("创建课节记录成功", {
              localCourseId,
              sessionId: sessionData.id,
              sessionNumber,
              classroomId: classroomRes.classId
            })
          } catch (e: any) {
            logger.error("创建 class_session 异常", {
              message: e?.message,
              stack: e?.stack,
              localCourseId,
              item: raw,
            })
            // 不抛出错误，继续处理其他课节
          }
        } else {
          logger.warn("localCourseId 为空，跳过创建课节", { orderId })
        }

        success++
        results.push({
          courseId,
          classId: classroomRes.classId,
          activityId: classroomRes.activityId,
          courseName,
          classroomName,
          date: raw.date,
          startTime: raw.startTime,
          endTime: raw.endTime,
        })
      } catch (e: any) {
        logger.warn("批量创建失败条目", { message: e?.message, item: raw })
      }
    }

    // 同步更新课程统计信息
    if (localCourseId) {
      try {
        // 获取该课程的所有课节
        const { data: allSessions, error: sessionsError } = await supabaseServer
          .from('class_sessions')
          .select('id, status, scheduled_date, scheduled_time_start, scheduled_time_end')
          .eq('course_id', localCourseId)

        if (sessionsError) {
          logger.warn("获取课程所有课节失败（非致命）", { localCourseId, message: sessionsError.message })
        } else {
          // 统计课程信息
          const totalSessions = allSessions?.length || 0
          const completedSessions = allSessions?.filter((s: any) => s.status === 'completed').length || 0
          const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

          // 获取最后上课日期
          let lastSessionDate = null
          if (allSessions && allSessions.length > 0) {
            const sortedByDate = [...allSessions].sort((a: any, b: any) =>
              new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
            )
            lastSessionDate = sortedByDate[0].scheduled_date
          }

          // 更新课程统计信息
          const consumptionInfo = {
            totalSessions,
            completedSessions,
            progress,
            lastSessionDate,
            lastSyncTime: new Date().toISOString(),
          }

          const { error: updateError } = await supabaseServer
            .from('courses')
            .update({
              session_count: totalSessions,
              course_consumption_info: JSON.stringify(consumptionInfo),
            })
            .eq('id', localCourseId)

          if (updateError) {
            logger.warn("更新课程统计信息失败（非致命）", { localCourseId, message: updateError.message })
          } else {
            logger.info("更新课程统计信息成功", {
              localCourseId,
              totalSessions,
              completedSessions,
              progress,
            })
          }
        }
      } catch (e: any) {
        logger.warn("同步课程统计信息异常（非致命）", { localCourseId, message: e?.message })
      }
    }

    return NextResponse.json({
      success,
      skipped,
      total: items.length,
      courseId,
      courseName,
      results
    })
  } catch (error: any) {
    logger.error("批量创建 ClassIn 异常", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "批量创建失败" }, { status: 500 })
  }
}
