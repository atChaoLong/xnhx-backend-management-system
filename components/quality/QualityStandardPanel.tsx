"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { QualityMetric } from "@/lib/quality-standards"

interface QualityStandardPanelProps {
  title: string
  metrics: QualityMetric[]
}

export function QualityStandardPanel({ title, metrics }: QualityStandardPanelProps) {
  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0)

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">用于自动生成质检报告的评分项与扣分依据</div>
          </div>
          <Badge variant="outline">总分 {totalWeight}</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{metric.title}</div>
                <Badge variant="secondary">{metric.weight}分</Badge>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <span>{metric.passLabel}</span>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{metric.failIssue}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
