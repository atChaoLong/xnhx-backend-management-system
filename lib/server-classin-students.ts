import { supabaseServer } from "@/lib/supabase"
import { resolveClassInInitialPassword } from "@/lib/server-classin-password"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"

export interface EnsureClassInStudentParams {
  telephone: string
  nickname: string
  password?: string
}

export interface EnsureClassInStudentResult {
  uid?: number
  error?: string
  source?: "students_classin" | "registered"
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim()
}

async function findSyncedStudentUid(telephone: string): Promise<number | undefined> {
  const { data } = await supabaseServer
    .from("students_classin")
    .select("uid")
    .eq("mobile", telephone)
    .maybeSingle()

  return data?.uid ? Number(data.uid) : undefined
}

async function upsertClassInStudentSnapshot(uid: number, telephone: string, nickname: string) {
  await supabaseServer
    .from("students_classin")
    .upsert({
      uid,
      name: nickname,
      mobile: telephone,
      isdel: 0,
      sync_time: new Date().toISOString(),
    }, {
      onConflict: "uid",
      ignoreDuplicates: false,
    })
}

export async function ensureClassInStudentAccount(
  params: EnsureClassInStudentParams
): Promise<EnsureClassInStudentResult> {
  const telephone = normalizePhone(params.telephone || "")
  const nickname = (params.nickname || "学生").trim()
  const password = resolveClassInInitialPassword(
    params.password,
    process.env.CLASSIN_STUDENT_DEFAULT_PASSWORD
  )

  if (!telephone) {
    return { error: "缺少学生手机号，无法创建 ClassIn 学生账号" }
  }

  const syncedUid = await findSyncedStudentUid(telephone)
  const sdk = getClassInSDKService()

  if (syncedUid) {
    try {
      await sdk.addSchoolStudent({
        studentAccount: telephone,
        studentName: nickname,
      })
    } catch {
      // 已在机构内或 ClassIn 暂时不可用时不影响复用本地 UID。
    }

    return { uid: syncedUid, source: "students_classin" }
  }

  try {
    const registeredUid = await sdk.registerStudent({
      telephone,
      nickname,
      password,
    })
    const uid = Number(registeredUid)

    if (!Number.isFinite(uid) || uid <= 0) {
      return { error: "ClassIn 未返回有效学生 UID" }
    }

    try {
      await sdk.addSchoolStudent({
        studentAccount: telephone,
        studentName: nickname,
      })
    } catch {
      // 注册成功后加入机构失败不影响账号 UID 绑定，后续同步/重试可补。
    }

    await upsertClassInStudentSnapshot(uid, telephone, nickname)
    return { uid, source: "registered" }
  } catch (error: any) {
    const fallbackUid = await findSyncedStudentUid(telephone)
    if (fallbackUid) {
      return { uid: fallbackUid, error: error?.message, source: "students_classin" }
    }

    return { error: error?.message || "创建 ClassIn 学生账号失败" }
  }
}
