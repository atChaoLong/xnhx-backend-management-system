import { NextRequest, NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"
import { precheckBatchSchedule, type SchedulePrecheckItem } from "@/lib/server-schedule-precheck"

const logger = createLogger("ScheduleBatchPrecheckAPI")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : ""
    const items = Array.isArray(body?.items) ? body.items as SchedulePrecheckItem[] : []

    if (!orderId) {
      return NextResponse.json({ ok: false, error: "订单ID不能为空", issues: [] }, { status: 400 })
    }

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "排课列表不能为空", issues: [] }, { status: 400 })
    }

    if (items.length > 120) {
      return NextResponse.json({ ok: false, error: "单次最多预检120条排课", issues: [] }, { status: 400 })
    }

    const result = await precheckBatchSchedule(request, orderId, items)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    logger.error("批量排课预检失败", { error_summary: summarizeError(error) })
    return NextResponse.json({ ok: false, error: "批量排课预检失败，请稍后重试", issues: [] }, { status: 500 })
  }
}
