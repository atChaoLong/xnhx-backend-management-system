"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { FormalOrdersService, FormalOrder } from "@/lib/services/formalOrders"
import { useToast } from "@/hooks/use-toast"

export default function EditFormalOrderPage() {
  const params = useParams()
  const { toast } = useToast()
  const [order, setOrder] = useState<FormalOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const orderId = params.id as string

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsLoading(true)
        const data = await FormalOrdersService.getFormalOrderById(orderId)
        setOrder(data)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载正式订单数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()
  }, [orderId, toast])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="正式订单不可直接编辑" description="正式订单信息迁移到正式生详情统一管理" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="正式订单不可直接编辑" description="正式订单信息迁移到正式生详情统一管理" />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-2">请从正式生管理发起后续操作</h2>
              <p className="text-sm text-muted-foreground">
                正式订单列表仅用于查询和核对。续费、扩科、退费、新试听和回访记录请进入正式生详情处理。
              </p>
            </div>

            {order && (
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">订单号</span>
                  <span className="font-medium">{order.order_number || "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">订单类型</span>
                  <span>{order.order_type || "-"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">付款金额</span>
                  <span>{order.payment_amount || "-"}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Link href="/dashboard/formal-orders">
                <Button variant="outline">返回订单列表</Button>
              </Link>
              {order?.student_id && (
                <Link href={`/dashboard/students/${order.student_id}`}>
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
