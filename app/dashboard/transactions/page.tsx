"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TransactionsService } from "@/lib/services/transactions"
import { useToast } from "@/hooks/use-toast"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载异动记录列表
  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await TransactionsService.getTransactions()
      setTransactions(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载异动记录列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // 删除异动记录
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个异动记录吗？")) return

    try {
      setIsDeleting(id)
      await TransactionsService.deleteTransaction(id)
      toast({
        title: "删除成功",
        description: "异动记录已删除",
      })
      fetchTransactions()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除异动记录",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'rejected': '已拒绝',
    }
    return statusMap[status] || status
  }

  // 切换状态
  const handleToggleStatus = async (transaction: any) => {
    const statusFlow: Record<string, string> = {
      'pending': 'processing',
      'processing': 'completed',
      'completed': 'rejected',
      'rejected': 'pending',
    }

    try {
      await TransactionsService.updateTransaction({
        ...transaction,
        status: statusFlow[transaction.status] as any,
      })
      toast({
        title: "更新成功",
        description: "状态已更新",
      })
      fetchTransactions()
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
        <Header title="异动记录管理" description="管理退费异动记录" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="异动记录管理"
        description="管理退费异动记录"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">异动记录列表</h3>
                <p className="text-sm text-muted-foreground">共 {transactions.length} 条异动记录</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchTransactions} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/transactions/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增异动记录
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>创建日期</TableHead>
                    <TableHead>学生姓名</TableHead>
                    <TableHead>异动类型</TableHead>
                    <TableHead>退费金额</TableHead>
                    <TableHead>退费原因</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增异动记录"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {transaction.creation_date ? format(new Date(transaction.creation_date), 'yyyy-MM-dd') : "-"}
                        </TableCell>
                        <TableCell>{transaction.student_name || "-"}</TableCell>
                        <TableCell>{transaction.transaction_type || "-"}</TableCell>
                        <TableCell>{transaction.refund_amount ? `¥${transaction.refund_amount}` : "-"}</TableCell>
                        <TableCell className="max-w-md truncate">{transaction.refund_reason || "-"}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(transaction)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${getStatusBadge(transaction.status)}`}
                          >
                            {getStatusText(transaction.status)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/transactions/${transaction.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(transaction.id)}
                              disabled={isDeleting === transaction.id}
                            >
                              {isDeleting === transaction.id ? (
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
