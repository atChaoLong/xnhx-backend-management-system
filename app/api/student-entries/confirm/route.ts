import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { checkPermission } from "@/lib/middleware"
import { ACTIONS, RESOURCES } from "@/lib/permissions"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
import { redactStudentClassInSecrets } from "@/lib/server-student-redaction"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:StudentEntries:Confirm")
const STUDENT_ENTRY_CONFIRM_STUDENT_SELECT = `
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
`

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function summarizeStudentEntryPayload(payload: Record<string, any>) {
  const fields = Object.keys(payload || {}).sort()

  return {
    fields,
    field_count: fields.length,
    has_student_name: hasNonEmptyString(payload?.student_name),
    has_student_code: hasNonEmptyString(payload?.student_code),
    has_parent_phone: hasNonEmptyString(payload?.parent_phone),
    has_initial_password: hasNonEmptyString(payload?.initial_password),
    status: payload?.status || undefined,
  }
}

export async function POST(request: NextRequest) {
  return checkPermission(request, RESOURCES.students, ACTIONS.create, async () => {
    try {
      const body = await request.json()
      const profile = await getProfileFromHeaders(request)
      const bodySummary = summarizeStudentEntryPayload(body || {})

      const {
        student_name,
        student_code,
        parent_phone,
        initial_password,
        status = "active",
      } = body || {}

      if (!student_name || !student_code || !parent_phone || !initial_password) {
        logger.warn('学生入库确认失败 - 必填字段为空', { body_summary: bodySummary })
        return NextResponse.json(
          { error: "student_name/student_code/parent_phone/initial_password 不能为空" },
          { status: 400 }
        )
      }

      // 注册 ClassIn
      const sdk = getClassInSDKService()
      const uid = await sdk.registerStudent({
        telephone: parent_phone,
        nickname: student_name,
        password: initial_password,
      })

      try {
        await sdk.addSchoolStudent({
          studentAccount: parent_phone,
          studentName: student_name,
        })
      } catch (e: any) {
        logger.warn('添加学生到机构失败（可能已存在）', summarizeError(e))
      }

      // 先根据 parent_phone 查找是否已存在该学生
      const { data: existingStudent } = await supabaseServer
        .from('students')
        .select('id')
        .eq('parent_phone', parent_phone)
        .maybeSingle()

      // 准备 upsert 数据
      const payload: any = {
        student_code,
        student_name,
        parent_phone,
        status,
        classin_initial_password: initial_password,
        classin_uid: uid,
        updated_at: new Date().toISOString(),
      }

      // 如果已存在学生，添加 id 以触发更新
      if (existingStudent?.id) {
        payload.id = existingStudent.id
        logger.info('更新已有学生记录', { studentId: existingStudent.id, payload_summary: summarizeStudentEntryPayload(payload) })
      } else {
        logger.info('创建新学生记录', { payload_summary: summarizeStudentEntryPayload(payload) })
      }

      const { data, error } = await supabaseServer
        .from('students')
        .upsert(payload, { onConflict: 'id' })
        .select(STUDENT_ENTRY_CONFIRM_STUDENT_SELECT)
        .single()

      if (error) {
        const { message, status } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }

      return NextResponse.json({ data: redactStudentClassInSecrets(data, profile) }, { status: 201 })
    } catch (error: any) {
      logger.error("学生入库确认失败", summarizeError(error))
      return NextResponse.json({ error: "学生入库失败" }, { status: 500 })
    }
  })
}
