import { NextRequest, NextResponse } from "next/server"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { requireClassInOpsProfile } from "@/lib/server-classin-ops"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:TeacherEntries:RegisterClassIn")

export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = await request.json()
    const { telephone, nickname, password } = body || {}

    if (!telephone || !password || !nickname) {
      return NextResponse.json({ error: "telephone/nickname/password 不能为空" }, { status: 400 })
    }

    logger.info("开始注册老师到 ClassIn", {
      has_telephone: typeof telephone === "string" && telephone.trim().length > 0,
      has_nickname: typeof nickname === "string" && nickname.trim().length > 0,
    })

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
      logger.warn("同步 teacher_classin 失败（非致命）", { error_summary: summarizeError(err) })
    }

    return NextResponse.json({ uid }, { status: 201 })
  } catch (error: any) {
    logger.error("注册 ClassIn 异常", { error_summary: summarizeError(error) })
    return NextResponse.json({ error: "注册 ClassIn 失败" }, { status: 500 })
  }
}
