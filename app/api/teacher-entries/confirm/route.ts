import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger("API:TeacherEntries:Confirm")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      candidate_id,
      teacher_code,
      initial_password,
      status = "active",
      name,
      mobile,
      teacher_level,
      approved_hourly_rate,
    } = body || {}

    if (!candidate_id || !teacher_code || !initial_password) {
      return NextResponse.json(
        { error: "candidate_id/teacher_code/initial_password 不能为空" },
        { status: 400 }
      )
    }

    // 获取候选信息
    const { data: candidate, error: candidateError } = await supabaseServer
      .from("teacher_candidates")
      .select("*")
      .eq("id", candidate_id)
      .single()

    if (candidateError) {
      const { message, status } = handleDatabaseError(candidateError)
      return NextResponse.json({ error: message }, { status })
    }

    const effectiveName: string = (name && String(name).trim()) || candidate.name
    const effectiveMobile: string | null = (mobile && String(mobile).trim()) || candidate.wechat_id || null
    if (!effectiveMobile) {
      return NextResponse.json({ error: "缺少手机号，无法在 ClassIn 创建老师 UID" }, { status: 400 })
    }

    // 注册 ClassIn
    const sdk = getClassInSDKService()
    const uid = await sdk.registerTeacher({
      telephone: effectiveMobile,
      nickname: effectiveName,
      password: initial_password,
    })

    // 同步到 teacher_classin（可选）
    try {
      await supabaseServer
        .from("teacher_classin")
        .upsert(
          {
            uid,
            name: effectiveName,
            mobile: effectiveMobile,
            is_del: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "uid" }
        )
    } catch (err: any) {
      logger.warn("同步 teacher_classin 失败（非致命）", { message: err.message })
    }

    // 写入 teachers 简化信息
    const teacherPayload: any = {
      teacher_code,
      name: effectiveName,
      status,
      mobile: effectiveMobile,
      classin_initial_password: initial_password,
      classin_uid: uid,
      candidate_id,
      notes: candidate.hired_notes || null,
      updated_at: new Date().toISOString(),
    }

    const { data: teacher, error: teacherError } = await supabaseServer
      .from("teachers")
      .upsert(teacherPayload, { onConflict: "teacher_code" })
      .select()
      .single()

    if (teacherError) {
      const { message, status } = handleDatabaseError(teacherError)
      return NextResponse.json({ error: message }, { status })
    }

    // 更新候选状态
    const mergedNotes = [candidate.hired_notes || "", `老师编号: ${teacher_code}`]
      .filter(Boolean)
      .join("；")

    const updatePayload: any = {
      is_hired: true,
      candidate_status: "pending_entry",
      hired_notes: mergedNotes,
      updated_at: new Date().toISOString(),
    }
    if (effectiveName && effectiveName !== candidate.name) {
      updatePayload.name = effectiveName
    }
    if (effectiveMobile && effectiveMobile !== candidate.wechat_id) {
      updatePayload.wechat_id = effectiveMobile
    }
    if (teacher_level !== undefined) {
      updatePayload.teacher_level = teacher_level
    }
    if (approved_hourly_rate !== undefined && approved_hourly_rate !== null) {
      updatePayload.approved_hourly_rate = approved_hourly_rate
    }

    const { error: updateCandidateError } = await supabaseServer
      .from("teacher_candidates")
      .update(updatePayload)
      .eq("id", candidate_id)

    if (updateCandidateError) {
      const { message, status } = handleDatabaseError(updateCandidateError)
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json({ data: { teacher, uid } }, { status: 201 })
  } catch (error: any) {
    logger.error("老师入库确认失败", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "老师入库失败" }, { status: 500 })
  }
}
