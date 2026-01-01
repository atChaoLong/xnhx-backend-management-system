"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

interface ClassInStudent {
  uid: number
  stud_id?: number
  name: string
  mobile?: string
  email?: string
  account_status?: number
  serve_state?: number
  is_del?: number
  stuno?: string
  sync_time?: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function ClassInStudentsPage() {
  const [students, setStudents] = useState<ClassInStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const { toast } = useToast()

  // 分页 hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalCount: paginationTotal,
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
      fetchStudents(page, size)
    },
  })

  // 加载学生数据
  const fetchStudents = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1

      const response = await fetch(
        `/api/classin/students?from=${from}&to=${to}`
      )

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const result = await response.json()
      setStudents(result.data || [])
      setTotalCount(result.count || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 学生数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents(1, pageSize)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 学生"
        description="查看 ClassIn 平台的学生数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">学生列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => fetchStudents(currentPage, pageSize)}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>学号</TableHead>
                    <TableHead>账号状态</TableHead>
                    <TableHead>最后同步</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.uid}>
                        <TableCell className="font-medium">{student.uid}</TableCell>
                        <TableCell>{student.name || "-"}</TableCell>
                        <TableCell>{student.mobile || "-"}</TableCell>
                        <TableCell>{student.email || "-"}</TableCell>
                        <TableCell>{student.stuno || "-"}</TableCell>
                        <TableCell>
                          {student.is_del === 1 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              已删除
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              正常
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.sync_time ? new Date(student.sync_time).toLocaleString('zh-CN') : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            <div className="mt-6 flex items-center justify-between">
                {/* 左侧：统计信息 */}
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />

                {/* 中间：分页按钮 */}
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

                {/* 右侧：占位，保持布局平衡 */}
                <div className="w-auto"></div>
                    </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
