"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { TransactionsService, TransactionRecord } from "@/lib/services/transactions"
import { useToast } from "@/hooks/use-toast"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

const TRANSACTION_LEGACY_LOAD_ERROR = "无法加载异动记录数据"

export default function EditTransactionPage() {
  const params = useParams()
  const { toast } = useToast()
  const [transaction, setTransaction] = useState<TransactionRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const transactionId = params.id as string

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        setIsLoading(true)
        const data = await TransactionsService.getTransactionById(transactionId)
        setTransaction(data)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: getClientSafeErrorMessage(error, TRANSACTION_LEGACY_LOAD_ERROR),
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransaction()
  }, [transactionId, toast])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="异动记录不可直接编辑" description="退费和异动操作迁移到正式生详情统一管理" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="异动记录不可直接编辑" description="退费和异动操作迁移到正式生详情统一管理" />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-2">请从正式生管理发起后续操作</h2>
              <p className="text-sm text-muted-foreground">
                异动记录列表仅用于查询和核对。退费、续费、扩科和回访记录请进入正式生详情处理。
              </p>
            </div>

            {transaction && (
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">学生姓名</span>
                  <span className="font-medium">{transaction.student_name || "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">异动类型</span>
                  <span>{transaction.transaction_type || "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">退费金额</span>
                  <span>{transaction.refund_amount ? `¥${transaction.refund_amount}` : "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">状态</span>
                  <span>{transaction.status || "-"}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Link href="/dashboard/transactions">
                <Button variant="outline">返回异动列表</Button>
              </Link>
              {transaction?.student_id && (
                <Link href={`/dashboard/students/${transaction.student_id}`}>
                  <Button>进入正式生详情</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
