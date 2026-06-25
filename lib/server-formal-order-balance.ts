import { supabaseServer } from "@/lib/supabase"

export interface FormalOrderBalanceSummary {
  order_id: string
  order_number: string | null
  total_hours: number
  scheduled_hours: number
  completed_hours: number
  gross_remaining_hours: number
  refunded_hours: number
  remaining_hours: number
  payment_amount: number
  hourly_rate: number
  refunded_amount: number
  gross_remaining_amount: number
  remaining_amount: number
  computed_status: string
  computed_status_label: string
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getFormalOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    pending_payment: "待付款",
    active: "进行中",
    suspended: "已暂停",
    paused: "已暂停",
    completed: "已完成",
    refunded: "已退费",
    cancelled: "已取消",
  }

  return labels[status] || status
}

export function calculateFormalOrderComputedStatus(
  order: any,
  summary: {
    total_hours: number
    scheduled_hours: number
    completed_hours: number
    refunded_hours: number
    remaining_hours: number
    refunded_amount: number
  },
): string {
  const rawStatus = String(order?.status || "active").trim()
  const normalizedStatus = rawStatus === "paused" ? "suspended" : rawStatus
  const manualStatuses = new Set(["draft", "pending_payment", "suspended", "cancelled", "refunded"])

  if (manualStatuses.has(normalizedStatus)) {
    return normalizedStatus
  }

  const totalHours = Math.max(0, summary.total_hours)
  const completedHours = Math.max(0, summary.completed_hours)
  const remainingHours = Math.max(0, summary.remaining_hours)
  const refundedHours = Math.max(0, summary.refunded_hours)
  const refundedAmount = Math.max(0, summary.refunded_amount)
  const hasRefund = refundedHours > 0.01 || refundedAmount > 0.01
  const isFullyConsumed = totalHours > 0 && remainingHours <= 0.01
  const isCompletedByHours = totalHours > 0 && completedHours >= totalHours - 0.01

  if (hasRefund && isFullyConsumed && !isCompletedByHours) {
    return "refunded"
  }

  if (normalizedStatus === "completed" || isCompletedByHours || isFullyConsumed) {
    return "completed"
  }

  return "active"
}

export async function calculateFormalOrderBalanceSummaries(
  orders: any[],
  options: { excludeTransactionId?: string } = {},
): Promise<FormalOrderBalanceSummary[]> {
  const orderIds = Array.from(new Set((orders || []).map((order) => order?.id).filter(Boolean)))

  if (orderIds.length === 0) return []

  const { data: courses } = await supabaseServer
    .from("courses")
    .select("id, order_id")
    .in("order_id", orderIds)

  const courseOrderMap = new Map<string, string>()
  ;(courses || []).forEach((course: any) => {
    if (course.id && course.order_id) {
      courseOrderMap.set(course.id, course.order_id)
    }
  })

  const courseIds = Array.from(courseOrderMap.keys())
  const orderStats = new Map<string, { scheduledHours: number; completedHours: number }>()

  // courses+class_sessions chain runs in parallel with transaction_records query
  let refundQuery = supabaseServer
    .from("transaction_records")
    .select("id, order_id, refund_amount, unit_price")
    .in("order_id", orderIds)
    .neq("status", "rejected")

  if (options.excludeTransactionId) {
    refundQuery = refundQuery.neq("id", options.excludeTransactionId)
  }

  const [sessionsResult, refundResult] = await Promise.all([
    courseIds.length > 0
      ? supabaseServer
          .from("class_sessions")
          .select("course_id, status, scheduled_duration_minutes, actual_duration_minutes")
          .in("course_id", courseIds)
          .neq("status", "cancelled")
      : Promise.resolve({ data: [] as any[], error: null }),
    refundQuery,
  ])

  ;(sessionsResult.data || []).forEach((session: any) => {
    const orderId = courseOrderMap.get(session.course_id)
    if (!orderId) return

    const existing = orderStats.get(orderId) || { scheduledHours: 0, completedHours: 0 }
    const scheduledHours = toNumber(session.scheduled_duration_minutes) / 60
    const completedHours = toNumber(session.actual_duration_minutes ?? session.scheduled_duration_minutes) / 60

    existing.scheduledHours += scheduledHours
    if (session.status === "completed") {
      existing.completedHours += completedHours
    }
    orderStats.set(orderId, existing)
  })

  const refundRecords = refundResult.data
  const refundedByOrder = new Map<string, { amount: number; hours: number; amountWithUnitPrice: number }>()
  ;(refundRecords || []).forEach((record: any) => {
    if (!record.order_id) return
    const existing = refundedByOrder.get(record.order_id) || { amount: 0, hours: 0, amountWithUnitPrice: 0 }
    const refundAmount = Math.max(0, toNumber(record.refund_amount))
    const unitPrice = toNumber(record.unit_price)

    existing.amount += refundAmount
    if (unitPrice > 0) {
      existing.hours += refundAmount / unitPrice
      existing.amountWithUnitPrice += refundAmount
    }
    refundedByOrder.set(record.order_id, existing)
  })

  return (orders || []).map((order: any) => {
    const stats = orderStats.get(order.id) || { scheduledHours: 0, completedHours: 0 }
    const totalHours = toNumber(order.total_hours)
    const paymentAmount = toNumber(order.payment_amount)
    const hourlyRate = toNumber(order.hourly_rate) || (totalHours > 0 ? paymentAmount / totalHours : 0)
    const grossRemainingHours = Math.max(0, totalHours - stats.completedHours)
    const refundStats = refundedByOrder.get(order.id) || { amount: 0, hours: 0, amountWithUnitPrice: 0 }
    const refundedAmount = refundStats.amount
    const refundAmountWithoutUnitPrice = Math.max(0, refundedAmount - refundStats.amountWithUnitPrice)
    const refundedHours = Math.min(
      grossRemainingHours,
      refundStats.hours + (hourlyRate > 0 ? refundAmountWithoutUnitPrice / hourlyRate : 0),
    )
    const remainingHours = Math.max(0, grossRemainingHours - refundedHours)
    const grossRemainingAmount = Math.max(0, grossRemainingHours * hourlyRate)
    const computedStatus = calculateFormalOrderComputedStatus(order, {
      total_hours: totalHours,
      scheduled_hours: stats.scheduledHours,
      completed_hours: stats.completedHours,
      refunded_hours: refundedHours,
      remaining_hours: remainingHours,
      refunded_amount: refundedAmount,
    })

    return {
      order_id: order.id,
      order_number: order.order_number || null,
      total_hours: totalHours,
      scheduled_hours: stats.scheduledHours,
      completed_hours: stats.completedHours,
      gross_remaining_hours: grossRemainingHours,
      refunded_hours: refundedHours,
      remaining_hours: remainingHours,
      payment_amount: paymentAmount,
      hourly_rate: hourlyRate,
      refunded_amount: refundedAmount,
      gross_remaining_amount: grossRemainingAmount,
      remaining_amount: Math.max(0, grossRemainingAmount - refundedAmount),
      computed_status: computedStatus,
      computed_status_label: getFormalOrderStatusLabel(computedStatus),
    }
  })
}
