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
    const { items } = body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "请求体缺少 items 或为空" }, { status: 400 })
    }

    const sdk = getClassInSDKService()
    let success = 0
    const results: any[] = []

    const scheduleItems = items as SchedulePayloadItem[]

    const first = scheduleItems[0]
    if (!first.teacherName || !first.studentName) {
      return NextResponse.json({ error: "首条记录缺少 teacherName 或 studentName" }, { status: 400 })
    }

    const { data: firstTeacher, error: firstTErr } = await supabaseServer
      .from("teacher_classin")
      .select("*")
      .eq("name", first.teacherName)
      .eq("is_del", 0)
      .single()
    if (firstTErr || !firstTeacher?.uid) {
      return NextResponse.json({ error: `教师未绑定 ClassIn：${first.teacherName}` }, { status: 400 })
    }

    const courseName = `【正式】${first.studentName} ${first.subject || ""}课`
    const courseId = await sdk.createCourse({ courseName })

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
            teacher_num: 1,
            student_num: 0,
            sync_time: new Date().toISOString(),
          },
          { onConflict: "course_id" }
        )
    } catch (e: any) {
      logger.warn("写入 class_classin 失败（非致命）", { message: e?.message })
    }

    for (const raw of scheduleItems) {
      try {
        if (!raw.teacherName || !raw.studentName || !raw.date || !raw.startTime || !raw.endTime) {
          throw new Error("缺少必要字段：teacherName/studentName/date/startTime/endTime")
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

        const classroomRes = await sdk.createClassroom({
          courseId,
          name: classroomName,
          teacherUid: teacherClassin.uid,
          startTime,
          endTime,
          liveState: 0,
          openState: 0,
          recordState: 1,
          recordType: 0,
        })

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

    return NextResponse.json({ success, total: items.length, courseId, courseName, results })
  } catch (error: any) {
    logger.error("批量创建 ClassIn 异常", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "批量创建失败" }, { status: 500 })
  }
}
