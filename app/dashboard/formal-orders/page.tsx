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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormalOrdersService, FormalOrder } from "@/lib/services/formalOrders"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import { usePagination } from "@/lib/hooks/usePagination"

export default function FormalOrdersPage() {
  const router = useRouter()
  const { formalOrders: formalOrdersPerm } = usePermission()
  const [orders, setOrders] = useState<FormalOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isCreatingClass, setIsCreatingClass] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const { toast } = useToast()

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

  // 删除正式订单
  const handleDeleteClick = (id: string) => {
    setOrderToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return

    try {
      setIsDeleting(orderToDelete)
      await FormalOrdersService.deleteFormalOrder(orderToDelete)
      toast({
        title: "删除成功",
        description: "正式订单已删除",
      })
      fetchOrders()
      setDeleteDialogOpen(false)
      setOrderToDelete(null)
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

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setOrderToDelete(null)
  }

  // 快捷开课（教务操作）
  const handleQuickCreateClass = async (order: FormalOrder) => {
    // 检查必要字段
    if (!order.teacher_names || order.teacher_names.length === 0) {
      toast({
        variant: "destructive",
        title: "无法开课",
        description: "请先选择授课老师",
      })
      return
    }

    if (!order.first_class_time) {
      toast({
        variant: "destructive",
        title: "无法开课",
        description: "请先确定首次上课时间",
      })
      return
    }

    try {
      setIsCreatingClass(order.id)

      // 获取第一个老师的 ClassIn UID
      const teacherResponse = await fetch('/api/teachers/classin')
      const { data: teachers } = await teacherResponse.json()
      const teacher = teachers.find((t: any) => t.teacher_name === order.teacher_names[0])

      if (!teacher || !teacher.classin_uid) {
        toast({
          variant: "destructive",
          title: "无法开课",
          description: `老师"${order.teacher_names[0]}"未绑定 ClassIn 账号`,
        })
        return
      }

      // 调用 ClassIn SDK 创建课室
      const classResponse = await fetch('/api/classin-sdk/classroom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          courseId: process.env.NEXT_PUBLIC_CLASSIN_DEFAULT_COURSE_ID || 'default_course',
          unitId: process.env.NEXT_PUBLIC_CLASSIN_DEFAULT_UNIT_ID || 'default_unit',
          name: `${order.order_number}正式课`,
          teacherUid: teacher.classin_uid,
          startTime: new Date(order.first_class_time).getTime() / 1000, // 转为秒级时间戳
          endTime: new Date(new Date(order.first_class_time).getTime() + (order.session_duration || 120) * 60 * 1000).getTime() / 1000,
        })
      })

      if (!classResponse.ok) {
        const error = await classResponse.json()
        throw new Error(error.error || '创建课室失败')
      }

      const { data: classroom } = await classResponse.json()

      // 更新订单备注，保存课室链接
      await FormalOrdersService.updateFormalOrder({
        ...order,
        order_notes: `${order.order_notes || ''}\n\n课室链接：${classroom.liveUrl || classroom.url || ''}`.trim(),
      })

      toast({
        title: "开课成功",
        description: "课室已创建，链接已保存到订单备注",
      })
      fetchOrders()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "开课失败",
        description: error.message || "无法创建课室",
      })
    } finally {
      setIsCreatingClass(null)
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
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
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
                            {/* 开课按钮 - 教务操作 */}
                            {formalOrdersPerm.addLink() && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleQuickCreateClass(order)}
                                disabled={isCreatingClass === order.id}
                                className="bg-purple-600 hover:bg-purple-700"
                                title="创建ClassIn课室"
                              >
                                {isCreatingClass === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    开课
                                  </>
                                )}
                              </Button>
                            )}

                            <Link href={`/dashboard/formal-orders/${order.id}/edit`}>
                              <Button variant="ghost" size="icon" title="编辑">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(order.id)}
                              disabled={isDeleting === order.id}
                              title="删除"
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

            {totalPages > 1 && (
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
            )}
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
              确定要删除这个正式订单吗？此操作无法撤销。
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
