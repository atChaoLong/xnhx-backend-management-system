"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationPageSize,
  PaginationInfo,
} from "@/components/ui/pagination"
import { Plus, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TransactionsService } from "@/lib/services/transactions"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

  const {
    currentPage,
    pageSize,
    totalPages,
    canGoNext,
    canGoPrevious,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    getPageRange,
  } = usePagination({
    totalCount,
    pageSize: 20,
    onPageChange: (page, size) => fetchTransactions(page, size),
  })

  // 加载异动记录列表
  const fetchTransactions = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TransactionsService.getTransactions(from, to)
      setTransactions(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载异动记录列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions(1, pageSize)
  }, [])

  // 删除异动记录
  const handleDeleteClick = (id: string) => {
    setTransactionToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return

    try {
      setIsDeleting(transactionToDelete)
      await TransactionsService.deleteTransaction(transactionToDelete)
      toast({
        title: "删除成功",
        description: "异动记录已删除",
      })
      fetchTransactions(currentPage, pageSize)
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
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

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setTransactionToDelete(null)
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
      fetchTransactions(currentPage, pageSize)
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
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchTransactions(currentPage, pageSize)} disabled={isLoading}>
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
                              onClick={() => handleDeleteClick(transaction.id)}
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

            <div className="mt-6 flex items-center justify-between">
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
                <div className="flex items-center gap-4">
                  <PaginationPageSize
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    options={PAGE_SIZE_OPTIONS}
                  />
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={goToPreviousPage}
                          className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {getPageRange().map((page, index) => {
                        if (page === -1) {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => goToPage(page)}
                              isActive={page === currentPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={goToNextPage}
                          className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
                <div className="w-auto"></div>
                    </div>
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个异动记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeleting !== null}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting !== null}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
