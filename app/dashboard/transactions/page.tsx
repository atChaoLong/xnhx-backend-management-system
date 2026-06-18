"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
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
import { CheckCircle2, Loader2, Plus, XCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TransactionsService, TransactionRecord, TransactionStats, TransactionWorkflowAction } from "@/lib/services/transactions"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

const TRANSACTIONS_LOAD_ERROR = "无法加载异动记录列表"
const TRANSACTIONS_WORKFLOW_ERROR = "无法更新异动流程"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const { toast } = useToast()
  const { transactions: transactionsPerm } = usePermission()

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
      const [{ data, count }, nextStats] = await Promise.all([
        TransactionsService.getTransactions(from, to),
        TransactionsService.getStats(),
      ])
      setTransactions(data)
      setTotalCount(count)
      setStats(nextStats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: getClientSafeErrorMessage(error, TRANSACTIONS_LOAD_ERROR),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions(1, pageSize)
  }, [])

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-800',
      'processing': 'bg-blue-100 text-blue-800',
      'completed': 'bg-emerald-100 text-emerald-800',
      'rejected': 'bg-red-100 text-red-800',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': '待教务核对',
      'processing': '待财务打款',
      'completed': '已完成打款',
      'rejected': '已拒绝',
    }
    return statusMap[status] || status
  }

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      submitted: '提交申请',
      verify_amount: '教务核对',
      mark_paid: '财务打款',
      verify_performance: '业绩核对',
      reject: '拒绝',
      status_change: '状态更新',
    }
    return actionMap[action] || action
  }

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
  }

  const statusSummaryItems = stats
    ? ([
        { status: 'pending' as const, label: getStatusText('pending'), tone: 'border-amber-200 bg-amber-50 text-amber-900' },
        { status: 'processing' as const, label: getStatusText('processing'), tone: 'border-blue-200 bg-blue-50 text-blue-900' },
        { status: 'completed' as const, label: getStatusText('completed'), tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
        { status: 'rejected' as const, label: getStatusText('rejected'), tone: 'border-red-200 bg-red-50 text-red-900' },
      ].map((item) => ({
        ...item,
        summary: stats.by_status[item.status],
      })))
    : []

  const renderWorkflowEvents = (transaction: TransactionRecord) => {
    const events = transaction.workflow_events || []

    if (events.length === 0) {
      return <div className="text-xs text-muted-foreground">暂无操作流水</div>
    }

    return (
      <div className="space-y-1">
        {events.slice(0, 3).map((event) => (
          <div key={event.id} className="text-xs leading-5">
            <span className="font-medium text-foreground">{getActionText(event.action)}</span>
            <span className="ml-1 text-muted-foreground">
              {format(new Date(event.created_at), 'MM-dd HH:mm')}
            </span>
            <span className="ml-1 text-muted-foreground">
              {event.actor_name || event.actor_role || '系统'}
            </span>
            {event.from_status && event.to_status && event.from_status !== event.to_status && (
              <span className="ml-1 text-muted-foreground">
                {getStatusText(event.from_status)} → {getStatusText(event.to_status)}
              </span>
            )}
          </div>
        ))}
        {events.length > 3 && (
          <div className="text-xs text-muted-foreground">还有 {events.length - 3} 条流水</div>
        )}
      </div>
    )
  }

  const handleWorkflowAction = async (
    transaction: TransactionRecord,
    workflowAction: TransactionWorkflowAction,
    successMessage: string
  ) => {
    try {
      setUpdatingId(transaction.id)
      await TransactionsService.advanceWorkflow(transaction.id, workflowAction)
      toast({
        title: "操作成功",
        description: successMessage,
      })
      await fetchTransactions(currentPage, pageSize)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: getClientSafeErrorMessage(error, TRANSACTIONS_WORKFLOW_ERROR),
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const getWorkflowActions = (transaction: TransactionRecord) => {
    const isUpdating = updatingId === transaction.id

    if (transaction.status === 'pending') {
      return (
        <div className="flex justify-end gap-2">
          {transactionsPerm.verifyHours() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleWorkflowAction(transaction, 'verify_amount', '已通过教务金额核对')}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
              教务通过
            </Button>
          )}
          {(transactionsPerm.verifyHours() || transactionsPerm.payment()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleWorkflowAction(transaction, 'reject', '已拒绝该异动记录')}
              disabled={isUpdating}
            >
              <XCircle className="mr-1 h-3 w-3" />
              拒绝
            </Button>
          )}
        </div>
      )
    }

    if (transaction.status === 'processing') {
      return (
        <div className="flex justify-end gap-2">
          {transactionsPerm.payment() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleWorkflowAction(transaction, 'mark_paid', '已确认财务打款')}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
              确认打款
            </Button>
          )}
          {(transactionsPerm.verifyHours() || transactionsPerm.payment()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleWorkflowAction(transaction, 'reject', '已拒绝该异动记录')}
              disabled={isUpdating}
            >
              <XCircle className="mr-1 h-3 w-3" />
              拒绝
            </Button>
          )}
        </div>
      )
    }

    if (transaction.status === 'completed' && transactionsPerm.verifyPerformance()) {
      const verified = Boolean(transaction.performance_verified_at)
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleWorkflowAction(transaction, 'verify_performance', '已完成人力业绩核对')}
          disabled={isUpdating || verified}
        >
          {isUpdating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
          {verified ? '业绩已核对' : '业绩核对'}
        </Button>
      )
    }

    return <span className="text-sm text-muted-foreground">无可用操作</span>
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
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="异动记录管理"
        description="管理退费异动记录"
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
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
                {transactionsPerm.create() && (
                  <Link href="/dashboard/transactions/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      新增异动记录
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {stats && (
              <div className="mb-6 grid gap-3 md:grid-cols-6 flex-shrink-0">
                <div className="rounded-md border bg-background p-4 md:col-span-2">
                  <div className="text-sm text-muted-foreground">可见异动总览</div>
                  <div className="mt-2 flex items-end gap-3">
                    <div className="text-2xl font-semibold">{stats.total_count}</div>
                    <div className="pb-1 text-sm text-muted-foreground">笔</div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    合计退费 {formatCurrency(stats.total_amount)}
                  </div>
                </div>
                {statusSummaryItems.map((item) => (
                  <div key={item.status} className={`rounded-md border p-4 ${item.tone}`}>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="mt-2 text-2xl font-semibold">{item.summary.count}</div>
                    <div className="mt-1 text-xs opacity-80">{formatCurrency(item.summary.amount)}</div>
                  </div>
                ))}
              </div>
            )}

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[180px] min-w-[180px]">学生姓名</TableHead>
                    <TableHead>创建日期</TableHead>
                    <TableHead>异动类型</TableHead>
                    <TableHead>退费金额</TableHead>
                    <TableHead>退费原因</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>流程记录</TableHead>
                    <TableHead>操作流水</TableHead>
                    <TableHead className="text-right">流程操作</TableHead>
                    <TableHead className="text-right">关联</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        暂无异动记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[180px] min-w-[180px]">
                          {transaction.student_name || "-"}
                        </TableCell>
                        <TableCell>
                          {transaction.creation_date ? format(new Date(transaction.creation_date), 'yyyy-MM-dd') : "-"}
                        </TableCell>
                        <TableCell>{transaction.transaction_type || "-"}</TableCell>
                        <TableCell>{transaction.refund_amount ? `¥${transaction.refund_amount}` : "-"}</TableCell>
                        <TableCell className="max-w-md truncate">{transaction.refund_reason || "-"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(transaction.status)}`}>
                            {getStatusText(transaction.status)}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[180px] text-xs text-muted-foreground">
                          <div>教务：{transaction.academic_verified_at ? format(new Date(transaction.academic_verified_at), 'yyyy-MM-dd HH:mm') : '-'}</div>
                          <div>财务：{transaction.paid_at ? format(new Date(transaction.paid_at), 'yyyy-MM-dd HH:mm') : '-'}</div>
                          <div>人力：{transaction.performance_verified_at ? format(new Date(transaction.performance_verified_at), 'yyyy-MM-dd HH:mm') : '-'}</div>
                        </TableCell>
                        <TableCell className="min-w-[260px]">
                          {renderWorkflowEvents(transaction)}
                        </TableCell>
                        <TableCell className="min-w-[220px] text-right">
                          {getWorkflowActions(transaction)}
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.student_id ? (
                            <Link href={`/dashboard/students/${transaction.student_id}`}>
                              <Button variant="outline" size="sm">
                                查看正式生
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">历史记录</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollableTable>

            <div className="mt-6 flex items-center justify-between flex-shrink-0">
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
                          disabled={!canGoPrevious}
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
                              disabled={false}
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
                          disabled={!canGoNext}
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

    </div>
  )
}
