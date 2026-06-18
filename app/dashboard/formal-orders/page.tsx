"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2, Eye } from "lucide-react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { FormalOrdersService, FormalOrder } from "@/lib/services/formalOrders"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"

export default function FormalOrdersPage() {
  const router = useRouter()
  const { user } = useCurrentUser()
  const [orders, setOrders] = useState<FormalOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [paymentProofPreview, setPaymentProofPreview] = useState("")
  const [paymentProofDialogOpen, setPaymentProofDialogOpen] = useState(false)
  const { toast } = useToast()
  const canViewPaymentProof = user?.role === 'admin' || user?.role === 'finance' || user?.role === 'academic_affairs'
  const tableColumnCount = canViewPaymentProof ? 12 : 11

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

  // 加载正式订单列表
  const fetchOrders = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await FormalOrdersService.getFormalOrders(from, to)
      setOrders(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载正式订单列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
    onPageChange: (page, size) => {
      fetchOrders(page, size)
    },
  })

  useEffect(() => {
    fetchOrders(1, pageSize)
  }, [])

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'draft': 'bg-slate-100 text-slate-800',
      'pending_payment': 'bg-orange-100 text-orange-800',
      'active': 'bg-green-100 text-green-800',
      'completed': 'bg-blue-100 text-blue-800',
      'cancelled': 'bg-gray-100 text-gray-800',
      'suspended': 'bg-yellow-100 text-yellow-800',
      'refunded': 'bg-purple-100 text-purple-800',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'draft': '草稿',
      'pending_payment': '待付款',
      'active': '进行中',
      'completed': '已完成',
      'cancelled': '已取消',
      'suspended': '已暂停',
      'paused': '已暂停',
      'refunded': '已退费',
    }
    return statusMap[status] || status
  }

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|avif|heic|heif|bmp|tif|tiff)(\?.*)?$/i.test(url)

  const openPaymentProofPreview = (url: string) => {
    setPaymentProofPreview(url)
    setPaymentProofDialogOpen(true)
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
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="正式订单管理"
        description="管理正式订单信息"
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">正式订单列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchOrders(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
              </div>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[160px] min-w-[160px]">订单号</TableHead>
                    <TableHead className="sticky left-[160px] z-30 bg-background w-[140px] min-w-[140px]">学科</TableHead>
                    <TableHead>老师</TableHead>
                    <TableHead>订单类型</TableHead>
                    <TableHead>总课时数</TableHead>
                    <TableHead>付款金额</TableHead>
                    {canViewPaymentProof && <TableHead>付款凭证</TableHead>}
                    <TableHead>小时单价</TableHead>
                    <TableHead>签约顾问</TableHead>
                    <TableHead>首次课时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => {
                      const displayStatus = order.computed_status || order.status
                      return (
                      <TableRow key={order.id}>
                        <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[160px] min-w-[160px]">{order.order_number || "-"}</TableCell>
                        <TableCell className="sticky left-[160px] z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                          {order.subjects?.join(', ') || "-"}
                          {order.students?.student_name && (
                            <span className="ml-2 text-muted-foreground">({order.students.student_name})</span>
                          )}
                        </TableCell>
                        <TableCell>{order.teacher_names?.join(', ') || "-"}</TableCell>
                        <TableCell>{order.order_type || "-"}</TableCell>
                        <TableCell>{order.total_sessions || "-"}</TableCell>
                        <TableCell>{order.payment_amount || "-"}</TableCell>
                        {canViewPaymentProof && (
                          <TableCell>
                            {order.payment_proof ? (
                              <Button variant="outline" size="sm" onClick={() => openPaymentProofPreview(order.payment_proof)}>
                                <Eye className="mr-2 h-4 w-4" />
                                查看
                              </Button>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        )}
                        <TableCell>{order.hourly_rate || "-"}</TableCell>
                        <TableCell>{order.consultant_teacher || "-"}</TableCell>
                        <TableCell>
                          {order.first_class_time ? format(new Date(order.first_class_time), 'yyyy-MM-dd HH:mm') : "-"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(displayStatus)}`}>
                            {order.computed_status_label || getStatusText(displayStatus)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {order.student_id ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/students/${order.student_id}`)}
                                title="查看正式生详情"
                              >
                                查看正式生
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">无正式生</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )})
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
                          className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          disabled={!canGoPrevious}
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
                              disabled={false}
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
                          disabled={!canGoNext}
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

      {/* 付款凭证预览 */}
      <Dialog open={paymentProofDialogOpen} onOpenChange={setPaymentProofDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>付款凭证</DialogTitle>
            <DialogDescription>查看正式订单付款凭证</DialogDescription>
          </DialogHeader>
          {paymentProofPreview && (
            <div className="space-y-4">
              {isImageUrl(paymentProofPreview) ? (
                <div className="max-h-[70vh] overflow-auto rounded border bg-muted/30">
                  <img
                    src={paymentProofPreview}
                    alt="付款凭证"
                    className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="rounded border p-4">
                  <p className="mb-3 break-all text-sm text-muted-foreground">{paymentProofPreview}</p>
                  <a
                    href={paymentProofPreview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline"
                  >
                    打开凭证
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
