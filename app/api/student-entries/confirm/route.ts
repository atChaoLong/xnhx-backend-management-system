import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger("API:StudentEntries:Confirm")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      student_name,
      student_code,
      parent_phone,
      initial_password,
      status = "active",
    } = body || {}

    if (!student_name || !student_code || !parent_phone || !initial_password) {
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
      logger.warn('添加学生到机构失败（可能已存在）', { message: e?.message })
    }

    // upsert 简化字段到 students
    const payload: any = {
      student_code,
      student_name,
      parent_phone,
      status,
      classin_initial_password: initial_password,
      classin_uid: uid,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseServer
      .from('students')
      .upsert(payload, { onConflict: 'student_code' })
      .select()
      .single()

    if (error) {
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error("学生入库确认失败", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "学生入库失败" }, { status: 500 })
  }
}

