import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { checkPermission } from "@/lib/middleware"
import { ACTIONS, RESOURCES } from "@/lib/permissions"
import { resolveClassInInitialPassword } from "@/lib/server-classin-password"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { redactTeacherClassInSecrets } from "@/lib/server-teacher-redaction"
import { resolveTeacherCodeForCandidate } from "@/lib/server-teacher-code"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:TeacherEntries:Confirm")
const TEACHER_ENTRY_SELECT = "id,teacher_code,name,teacher_level,status,mobile,classin_phone,classin_initial_password,candidate_id,used_classin,classin_uid,created_at,updated_at"

export async function POST(request: NextRequest) {
  return checkPermission(request, RESOURCES.teacherCandidates, ACTIONS.confirmEntry, async () => {
    try {
      const body = await request.json()
      const profile = await getCurrentProfile(request)
      const {
        candidate_id,
        initial_password,
        status = "active",
        name,
        mobile,
        teacher_level,
        approved_hourly_rate,
      } = body || {}

      if (!candidate_id) {
        return NextResponse.json(
          { error: "candidate_id 不能为空" },
          { status: 400 }
        )
      }

      // 获取候选信息
      const { data: candidate, error: candidateError } = await supabaseServer
        .from("teacher_candidates")
        .select("id,name,phone,wechat_id,teacher_level,hired_notes,review_result,is_hired")
        .eq("id", candidate_id)
        .single()

      if (candidateError) {
        const { message, status } = handleDatabaseError(candidateError)
        return NextResponse.json({ error: message }, { status })
      }

      if (candidate.is_hired === true) {
        return NextResponse.json({ error: "候选人已入库，不能重复确认" }, { status: 409 })
      }

      if (String(candidate.review_result || "").trim() !== "通过") {
        return NextResponse.json({ error: "候选人尚未复核通过，不能确认入库" }, { status: 403 })
      }

      const effectiveName: string = (name && String(name).trim()) || candidate.name
      const effectiveMobile: string | null = (mobile && String(mobile).trim()) || candidate.phone || candidate.wechat_id || null
      const effectiveInitialPassword = resolveClassInInitialPassword(
        initial_password ? String(initial_password) : null,
        process.env.CLASSIN_TEACHER_DEFAULT_PASSWORD
      )
      if (!effectiveMobile) {
        return NextResponse.json({ error: "缺少 ClassIn 注册手机号" }, { status: 400 })
      }

      const teacher_code = await resolveTeacherCodeForCandidate(candidate_id)
      const effectiveTeacherLevel = teacher_level || candidate.teacher_level || null

      const now = new Date().toISOString()

      // 写入 teachers 简化信息。ClassIn UID 在试听确认老师时懒创建/绑定。
      const teacherPayload: any = {
        teacher_code,
        name: effectiveName,
        teacher_level: effectiveTeacherLevel,
        status,
        mobile: effectiveMobile,
        classin_phone: effectiveMobile,
        classin_initial_password: effectiveInitialPassword,
        candidate_id,
        updated_at: now,
      }

      const { data: teacher, error: teacherError } = await supabaseServer
        .from("teachers")
        .upsert(teacherPayload, { onConflict: "teacher_code" })
        .select(TEACHER_ENTRY_SELECT)
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
        hired_notes: mergedNotes,
        recruitment_step: "final_entry",
        recruitment_status: "in_teacher_pool",
        salary_confirmed_at: now,
        salary_confirmed_by_id: profile?.id || null,
        updated_at: now,
      }
      if (effectiveName && effectiveName !== candidate.name) {
        updatePayload.name = effectiveName
      }
      if (effectiveMobile && effectiveMobile !== candidate.phone) {
        updatePayload.phone = effectiveMobile
      }
      if (effectiveTeacherLevel !== undefined) {
        updatePayload.teacher_level = effectiveTeacherLevel
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

      return NextResponse.json({ data: { teacher: redactTeacherClassInSecrets(teacher, profile), uid: null } }, { status: 201 })
    } catch (error: any) {
      logger.error("老师入库确认失败", { error_summary: summarizeError(error) })
      return NextResponse.json({ error: "老师入库失败" }, { status: 500 })
    }
  })
}
