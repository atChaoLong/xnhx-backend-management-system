"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2, RefreshCw, ScrollText } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationInfo,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPageSize,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { api } from "@/lib/fetch"
import { usePagination } from "@/lib/hooks/usePagination"
import { useToast } from "@/hooks/use-toast"
import { summarizeError } from "@/lib/safe-error"

interface GrabLog {
  id: string
  lead_id: string
  report_number: string | null
  sales_user_id: string
  sales_user_name: string
  grab_wechat: string | null
  created_at: string
}

export default function GrabLogsPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<GrabLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

  const fetchLogs = async (page: number, size: number) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const response = await api.get(`/api/lead-grab-logs?from=${from}&to=${to}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "加载失败" }))
        throw new Error(error.error || "加载抢单日志失败")
      }

      const result = await response.json()
      setLogs(result.data || [])
      setTotalCount(result.count || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载抢单日志",
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
      fetchLogs(page, size)
    },
  })

  useEffect(() => {
    fetchLogs(1, 20)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="抢单记录日志"
        description="查看销售抢单操作记录"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-5xl mx-auto">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">共 {totalCount} 条记录</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(currentPage, pageSize)}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                刷新
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                暂无抢单记录
              </div>
            ) : (
              <ScrollableTable maxHeight="600px">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>抢单时间</TableHead>
                      <TableHead>销售人员</TableHead>
                      <TableHead>抢单微信</TableHead>
                      <TableHead>线索编号</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.created_at
                            ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")
                            : "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.sales_user_name || "-"}
                        </TableCell>
                        <TableCell>
                          {log.grab_wechat || "-"}
                        </TableCell>
                        <TableCell>
                          {log.report_number || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            )}

            {totalCount > 0 && (
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
