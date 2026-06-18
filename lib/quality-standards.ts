export type QualityReportType = "trial_conversion" | "service_quality"
export type QualityScoreLevel = "excellent" | "good" | "warning" | "risk"

export interface QualityMetric {
  id: string
  title: string
  weight: number
  passLabel: string
  failIssue: string
}

export interface QualityMetricResult extends QualityMetric {
  passed: boolean
}

export interface QualityDraftScore {
  quality_score: number
  score_level: QualityScoreLevel
  issues: string[]
  checked_items: QualityMetricResult[]
}

export const TRIAL_CONVERSION_QUALITY_METRICS: QualityMetric[] = [
  {
    id: "trial_result_closed",
    title: "试听结果闭环",
    weight: 30,
    passLabel: "试听状态已有明确结果或仍在有效跟进",
    failIssue: "试听已完成但未形成转化或明确跟进结论",
  },
  {
    id: "teacher_confirmed",
    title: "老师匹配记录",
    weight: 20,
    passLabel: "已记录匹配或确认老师",
    failIssue: "缺少匹配老师或确认老师记录",
  },
  {
    id: "schedule_recorded",
    title: "试听时间记录",
    weight: 20,
    passLabel: "已记录试听时间",
    failIssue: "缺少试听时间，无法复核履约节奏",
  },
  {
    id: "follow_up_action",
    title: "后续动作明确",
    weight: 30,
    passLabel: "已转化、取消或仍处于跟进状态",
    failIssue: "试听完成后缺少下一步跟进动作",
  },
]

export const SERVICE_QUALITY_METRICS: QualityMetric[] = [
  {
    id: "balance_safe",
    title: "课时余额安全",
    weight: 35,
    passLabel: "剩余课时充足或仍有可消耗金额",
    failIssue: "剩余课时和金额不足，存在结课或流失风险",
  },
  {
    id: "balance_known",
    title: "订单课消可核对",
    weight: 25,
    passLabel: "已聚合正式订单和课消余额",
    failIssue: "缺少正式订单或课消余额汇总，无法判断服务状态",
  },
  {
    id: "service_owner_visible",
    title: "服务责任人清晰",
    weight: 20,
    passLabel: "已记录班主任、正式课老师或服务负责人",
    failIssue: "缺少班主任或正式课老师，后续服务责任不清",
  },
  {
    id: "latest_order_known",
    title: "最近订单可追踪",
    weight: 20,
    passLabel: "已记录最近正式订单时间",
    failIssue: "缺少最近正式订单时间，续费节奏难以复核",
  },
]

export function getQualityScoreLevel(score: number): QualityScoreLevel {
  if (score >= 90) return "excellent"
  if (score >= 75) return "good"
  if (score >= 60) return "warning"
  return "risk"
}

export function buildQualityDraftScore(
  metrics: QualityMetric[],
  checks: Record<string, boolean>
): QualityDraftScore {
  const checkedItems = metrics.map((metric) => ({
    ...metric,
    passed: Boolean(checks[metric.id]),
  }))
  const qualityScore = checkedItems.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0)
  const issues = checkedItems.filter((item) => !item.passed).map((item) => item.failIssue)

  return {
    quality_score: qualityScore,
    score_level: getQualityScoreLevel(qualityScore),
    issues,
    checked_items: checkedItems,
  }
}
