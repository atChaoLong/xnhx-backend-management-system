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

    if (!candidate?.wechat_id) {
      return NextResponse.json({ error: "候选人缺少手机号（wechat_id）" }, { status: 400 })
    }

    // 注册 ClassIn
    const sdk = getClassInSDKService()
    const uid = await sdk.registerTeacher({
      telephone: candidate.wechat_id,
      nickname: candidate.name,
      password: initial_password,
    })

    // 同步到 teacher_classin（可选）
    try {
      await supabaseServer
        .from("teacher_classin")
        .upsert(
          {
            uid,
            name: candidate.name,
            mobile: candidate.wechat_id,
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
      name: candidate.name,
      status,
      mobile: candidate.wechat_id,
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

    const { error: updateCandidateError } = await supabaseServer
      .from("teacher_candidates")
      .update({
        is_hired: true,
        candidate_status: "pending_entry",
        hired_notes: mergedNotes,
        updated_at: new Date().toISOString(),
      })
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

