import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"

const logger = createLogger('API:TeacherEntries')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      teacher_code,
      name,
      status = 'active',
      mobile,
      classin_initial_password,
      classin_uid,
      candidate_id,
      notes,
    } = body || {}

    if (!teacher_code || !name) {
      return NextResponse.json({ error: "teacher_code 与 name 为必填" }, { status: 400 })
    }

    const payload: any = {
      teacher_code,
      name: name.trim(),
      status,
      mobile: mobile || null,
      classin_initial_password: classin_initial_password || null,
      candidate_id: candidate_id || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }

    if (classin_uid !== undefined && classin_uid !== null) {
      payload.classin_uid = classin_uid
    }

    logger.debug("入库预览提交 - 准备 upsert teachers", { payload })

    const { data, error } = await supabaseServer
      .from('teachers')
      .upsert(payload, { onConflict: 'teacher_code' })
      .select()
      .single()

    if (error) {
      const { message, status } = handleDatabaseError(error)
      logger.error("入库预览提交 - upsert 失败", { message, status })
      return NextResponse.json({ error: message }, { status })
    }

    logger.info("入库预览提交 - upsert 成功", { id: data.id, teacher_code })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error("入库预览提交 - 异常", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "老师入库失败" }, { status: 500 })
  }
}

