import { createLogger } from "@/lib/logger"
import { resolveClassInInitialPassword } from "@/lib/server-classin-password"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { supabaseServer } from "@/lib/supabase"

const logger = createLogger("Server:ClassInTeachers")

export interface EnsureClassInTeacherResult {
  uid?: number
  teacherId?: string
  error?: string
  source?: "teachers" | "teacher_classin" | "registered"
}

export interface AvailableTrialTeacher {
  name: string
  uid?: number
  teacherId?: string
  source: "teachers" | "teacher_classin"
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim()
}

async function findClassInTeacherByName(teacherName: string): Promise<AvailableTrialTeacher | null> {
  const normalizedName = teacherName.trim()
  if (!normalizedName) return null

  const { data, error } = await supabaseServer
    .from("teacher_classin")
    .select("uid, name")
    .eq("name", normalizedName)
    .eq("is_del", 0)
    .limit(1)

  if (error) {
    logger.warn("查询 ClassIn 老师镜像失败", { has_teacher_name: true, code: error.code })
    return null
  }

  const teacher = data?.[0]
  if (!teacher?.uid) return null

  return {
    name: teacher.name || normalizedName,
    uid: Number(teacher.uid),
    source: "teacher_classin",
  }
}

export async function findAvailableTrialTeacherByName(
  teacherName: string
): Promise<AvailableTrialTeacher | null> {
  const normalizedName = teacherName.trim()
  if (!normalizedName) return null

  const { data: teachers, error: teacherError } = await supabaseServer
    .from("teachers")
    .select("id, name, classin_uid")
    .eq("name", normalizedName)
    .order("created_at", { ascending: false })
    .limit(1)

  if (teacherError) {
    logger.warn("查询试听老师库存失败", { has_teacher_name: true, code: teacherError.code })
  }

  const teacher = teachers?.[0]
  if (teacher) {
    return {
      name: teacher.name || normalizedName,
      uid: teacher.classin_uid ? Number(teacher.classin_uid) : undefined,
      teacherId: teacher.id,
      source: "teachers",
    }
  }

  return findClassInTeacherByName(normalizedName)
}

async function upsertClassInTeacherSnapshot(uid: number, telephone: string, nickname: string) {
  await supabaseServer
    .from("teacher_classin")
    .upsert({
      uid,
      name: nickname,
      mobile: telephone,
      is_del: 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "uid",
      ignoreDuplicates: false,
    })
}

async function findSyncedTeacherUid(telephone: string) {
  if (!telephone) return undefined

  const { data } = await supabaseServer
    .from("teacher_classin")
    .select("uid")
    .eq("mobile", telephone)
    .eq("is_del", 0)
    .maybeSingle()

  return data?.uid ? Number(data.uid) : undefined
}

export async function ensureClassInTeacherAccountByName(
  teacherName: string
): Promise<EnsureClassInTeacherResult> {
  const normalizedName = teacherName.trim()
  if (!normalizedName) {
    return { error: "缺少老师姓名，无法创建 ClassIn 老师账号" }
  }

  const { data: teachers, error: teacherError } = await supabaseServer
    .from("teachers")
    .select("id, name, classin_phone, mobile, used_classin, classin_uid, classin_initial_password")
    .eq("name", normalizedName)
    .order("created_at", { ascending: false })
    .limit(1)

  if (teacherError) {
    logger.warn("查询老师库存失败", { has_teacher_name: true, code: teacherError.code })
    return { error: "查询老师库存失败" }
  }

  const teacher = teachers?.[0]
  if (!teacher) {
    const classInTeacher = await findClassInTeacherByName(normalizedName)
    if (classInTeacher?.uid) {
      return {
        uid: classInTeacher.uid,
        source: "teacher_classin",
      }
    }

    return { error: "老师库存中未找到该老师" }
  }

  const telephone = normalizePhone(teacher.classin_phone || teacher.mobile || "")
  const nickname = (teacher.name || normalizedName).trim()

  if (!telephone) {
    return { teacherId: teacher.id, error: "老师缺少 ClassIn 手机号，无法创建 ClassIn 老师账号" }
  }

  if (teacher.classin_uid) {
    const uid = Number(teacher.classin_uid)
    await upsertClassInTeacherSnapshot(uid, telephone, nickname)
    return { uid, teacherId: teacher.id, source: "teachers" }
  }

  const syncedUid = await findSyncedTeacherUid(telephone)
  if (syncedUid) {
    await supabaseServer
      .from("teachers")
      .update({
        used_classin: true,
        classin_uid: syncedUid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teacher.id)

    return { uid: syncedUid, teacherId: teacher.id, source: "teacher_classin" }
  }

  const password = resolveClassInInitialPassword(
    teacher.classin_initial_password,
    process.env.CLASSIN_TEACHER_DEFAULT_PASSWORD
  )

  try {
    const sdk = getClassInSDKService()
    const uid = Number(await sdk.registerTeacher({
      telephone,
      nickname,
      password,
    }))

    if (!Number.isFinite(uid) || uid <= 0) {
      return { teacherId: teacher.id, error: "ClassIn 未返回有效老师 UID" }
    }

    await supabaseServer
      .from("teachers")
      .update({
        used_classin: true,
        classin_uid: uid,
        classin_initial_password: password,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teacher.id)

    await upsertClassInTeacherSnapshot(uid, telephone, nickname)

    return { uid, teacherId: teacher.id, source: "registered" }
  } catch (error: any) {
    const fallbackUid = await findSyncedTeacherUid(telephone)
    if (fallbackUid) {
      await supabaseServer
        .from("teachers")
        .update({
          used_classin: true,
          classin_uid: fallbackUid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", teacher.id)

      return {
        uid: fallbackUid,
        teacherId: teacher.id,
        source: "teacher_classin",
        error: error?.message,
      }
    }

    return { teacherId: teacher.id, error: error?.message || "创建 ClassIn 老师账号失败" }
  }
}
