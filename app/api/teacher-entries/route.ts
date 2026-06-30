import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { checkPermission } from "@/lib/middleware"
import { ACTIONS, RESOURCES } from "@/lib/permissions"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { redactTeacherClassInSecrets } from "@/lib/server-teacher-redaction"
import { resolveTeacherCodeForCandidate } from "@/lib/server-teacher-code"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:TeacherEntries')
const TEACHER_ENTRY_SELECT = "id,teacher_code,name,teacher_level,status,mobile,classin_phone,classin_initial_password,candidate_id,used_classin,classin_uid,created_at,updated_at"

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function summarizeTeacherEntryPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_name: hasNonEmptyString(payload?.name),
    has_teacher_code: hasNonEmptyString(payload?.teacher_code),
    has_mobile: hasNonEmptyString(payload?.mobile),
    has_classin_phone: hasNonEmptyString(payload?.classin_phone),
    has_classin_initial_password: hasNonEmptyString(payload?.classin_initial_password),
    has_classin_uid: hasValue(payload?.classin_uid),
    has_candidate_id: hasNonEmptyString(payload?.candidate_id),
    has_notes: hasNonEmptyString(payload?.notes),
    status: payload?.status || undefined,
  }
}

export async function POST(request: NextRequest) {
  return checkPermission(request, RESOURCES.teacherCandidates, ACTIONS.interview, async () => {
    try {
      const body = await request.json()
      const profile = await getProfileFromHeaders(request)
      const bodySummary = summarizeTeacherEntryPayload(body || {})

      const {
        name,
        status = 'active',
        mobile,
        teacher_level,
        classin_initial_password,
        classin_uid,
        candidate_id,
        notes,
      } = body || {}

      if (!name) {
        logger.warn("入库预览提交失败 - 老师姓名为空", { body_summary: bodySummary })
        return NextResponse.json({ error: "name 为必填" }, { status: 400 })
      }

      const teacher_code = await resolveTeacherCodeForCandidate(candidate_id)

      const payload: any = {
        teacher_code,
        name: name.trim(),
        teacher_level: teacher_level || null,
        status,
        mobile: mobile || null,
        classin_phone: mobile || null,
        classin_initial_password: classin_initial_password || null,
        candidate_id: candidate_id || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }

      if (classin_uid !== undefined && classin_uid !== null) {
        payload.classin_uid = classin_uid
      }

      logger.debug("入库预览提交 - 准备 upsert teachers", { payload_summary: summarizeTeacherEntryPayload(payload) })

      const { data, error } = await supabaseServer
        .from('teachers')
        .upsert(payload, { onConflict: 'teacher_code' })
        .select(TEACHER_ENTRY_SELECT)
        .single()

      if (error) {
        const { message, status } = handleDatabaseError(error)
        logger.error("入库预览提交 - upsert 失败", { message, status })
        return NextResponse.json({ error: message }, { status })
      }

      logger.info("入库预览提交 - upsert 成功", { id: data.id, teacher_code })
      return NextResponse.json({ data: redactTeacherClassInSecrets(data, profile) }, { status: 201 })
    } catch (error: any) {
      logger.error("入库预览提交 - 异常", { error_summary: summarizeError(error) })
      return NextResponse.json({ error: "老师入库失败" }, { status: 500 })
    }
  })
}
