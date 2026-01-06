import { NextRequest, NextResponse } from "next/server"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger("API:TeacherEntries:RegisterClassIn")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telephone, nickname, password } = body || {}

    if (!telephone || !password || !nickname) {
      return NextResponse.json({ error: "telephone/nickname/password 不能为空" }, { status: 400 })
    }

    const sdk = getClassInSDKService()
    const uid = await sdk.registerTeacher({
      telephone,
      nickname,
      password,
    })

    // 同步到 teacher_classin（可选）
    try {
      await supabaseServer
        .from("teacher_classin")
        .upsert(
          {
            uid,
            name: nickname,
            mobile: telephone,
            is_del: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "uid" }
        )
    } catch (err: any) {
      logger.warn("同步 teacher_classin 失败（非致命）", { message: err.message })
    }

    return NextResponse.json({ uid }, { status: 201 })
  } catch (error: any) {
    logger.error("注册 ClassIn 异常", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "注册 ClassIn 失败" }, { status: 500 })
  }
}

