"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { FormalOrdersService, FormalOrder } from "@/lib/services/formalOrders"
import { useToast } from "@/hooks/use-toast"

export default function FormalOrdersPage() {
  const [orders, setOrders] = useState<FormalOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载正式订单列表
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await FormalOrdersService.getFormalOrders()
      setOrders(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载正式订单列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // 删除正式订单
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个正式订单吗？")) return

    try {
      setIsDeleting(id)
      await FormalOrdersService.deleteFormalOrder(id)
      toast({
        title: "删除成功",
        description: "正式订单已删除",
      })
      fetchOrders()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除正式订单",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': 'bg-green-100 text-green-800',
      'completed': 'bg-blue-100 text-blue-800',
      'cancelled': 'bg-gray-100 text-gray-800',
      'suspended': 'bg-yellow-100 text-yellow-800',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': '进行中',
      'completed': '已完成',
      'cancelled': '已取消',
      'suspended': '已暂停',
    }
    return statusMap[status] || status
  }

  // 切换状态
  const handleToggleStatus = async (order: FormalOrder) => {
    const statusFlow: Record<string, string> = {
      'active': 'completed',
      'completed': 'cancelled',
      'cancelled': 'suspended',
      'suspended': 'active',
    }

    try {
      await FormalOrdersService.updateFormalOrder({
        ...order,
        status: statusFlow[order.status] as any,
      })
      toast({
        title: "更新成功",
        description: "状态已更新",
      })
      fetchOrders()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新状态",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="正式订单管理" description="管理正式订单信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="正式订单管理"
        description="管理正式订单信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">正式订单列表</h3>
                <p className="text-sm text-muted-foreground">共 {orders.length} 个正式订单</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/formal-orders/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增正式订单
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>老师</TableHead>
                    <TableHead>学科</TableHead>
                    <TableHead>订单类型</TableHead>
                    <TableHead>总课时数</TableHead>
                    <TableHead>付款金额</TableHead>
                    <TableHead>小时单价</TableHead>
                    <TableHead>签约顾问</TableHead>
                    <TableHead>首次课时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增正式订单"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number || "-"}</TableCell>
                        <TableCell>{order.teacher_names?.join(', ') || "-"}</TableCell>
                        <TableCell>{order.subjects?.join(', ') || "-"}</TableCell>
                        <TableCell>{order.order_type || "-"}</TableCell>
                        <TableCell>{order.total_sessions || "-"}</TableCell>
                        <TableCell>{order.payment_amount || "-"}</TableCell>
                        <TableCell>{order.hourly_rate || "-"}</TableCell>
                        <TableCell>{order.consultant_teacher || "-"}</TableCell>
                        <TableCell>
                          {order.first_class_time ? format(new Date(order.first_class_time), 'yyyy-MM-dd HH:mm') : "-"}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(order)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${getStatusBadge(order.status)}`}
                          >
                            {getStatusText(order.status)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/formal-orders/${order.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(order.id)}
                              disabled={isDeleting === order.id}
                            >
                              {isDeleting === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
