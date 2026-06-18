import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"
import { supabaseServer } from "@/lib/supabase"

const logger = createLogger("Server:TeacherCode")

function parseTeacherCodeNumber(code: unknown) {
  const match = String(code || "").match(/^TH(\d+)$/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function formatTeacherCode(value: number) {
  return `TH${String(value).padStart(5, "0")}`
}

async function generateTeacherCodeFallback() {
  const { data, error } = await supabaseServer
    .from("teachers")
    .select("teacher_code")
    .not("teacher_code", "is", null)
    .limit(1000)

  if (error) {
    logger.error("老师编号兼容生成失败", { error_summary: summarizeError(error) })
    throw new Error("生成老师编号失败，请确认数据库迁移已执行")
  }

  const maxCodeNumber = (data || []).reduce((max, row) => {
    const value = parseTeacherCodeNumber(row.teacher_code)
    return value && value > max ? value : max
  }, 0)

  return formatTeacherCode(maxCodeNumber + 1)
}

export async function generateTeacherCode() {
  const { data, error } = await supabaseServer.rpc("generate_teacher_code")

  if (!error && data) {
    return String(data)
  }

  logger.warn("老师编号 RPC 不可用，改用兼容生成", { error_summary: summarizeError(error) })
  return generateTeacherCodeFallback()
}

export async function findTeacherCodeForCandidate(candidateId?: string | null) {
  if (!candidateId) return null

  const { data, error } = await supabaseServer
    .from("teachers")
    .select("teacher_code")
    .eq("candidate_id", candidateId)
    .not("teacher_code", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    logger.warn("查询候选人已有关联老师编号失败", {
      candidateId,
      error_summary: summarizeError(error),
    })
    return null
  }

  return data?.[0]?.teacher_code ? String(data[0].teacher_code) : null
}

export async function resolveTeacherCodeForCandidate(candidateId?: string | null) {
  return (await findTeacherCodeForCandidate(candidateId)) || generateTeacherCode()
}
