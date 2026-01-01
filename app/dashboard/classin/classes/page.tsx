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

interface ClassInClass {
  course_id: number
  course_name: string
  school_uid?: number
  course_type?: number
  course_state?: number
  teacher_num?: number
  student_num?: number
  complete_class_num?: number
  total_class_num?: number
  creator_name?: string
  sync_time?: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function ClassInClassesPage() {
  const [classes, setClasses] = useState<ClassInClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const { toast } = useToast()

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
    onPageChange: (page, size) => fetchClasses(page, size),
  })

  // 加载班级数据
  const fetchClasses = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1

      const response = await fetch(`/api/classin/classes?from=${from}&to=${to}`)

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const result = await response.json()
      setClasses(result.data || [])
      setTotalCount(result.count || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 班级数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses(1, pageSize)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 班级" description="查看 ClassIn 平台的班级数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 班级"
        description="查看 ClassIn 平台的班级数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">班级列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => fetchClasses(currentPage, pageSize)}
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
                    <TableHead>班级ID</TableHead>
                    <TableHead>班级名称</TableHead>
                    <TableHead>创建者</TableHead>
                    <TableHead>老师数</TableHead>
                    <TableHead>学生数</TableHead>
                    <TableHead>已完成课时</TableHead>
                    <TableHead>总课时</TableHead>
                    <TableHead>进度</TableHead>
                    <TableHead>最后同步</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((classInfo) => {
                      const progress = classInfo.total_class_num > 0
                        ? Math.round((classInfo.complete_class_num || 0) / classInfo.total_class_num * 100)
                        : 0

                      return (
                        <TableRow key={classInfo.course_id}>
                          <TableCell className="font-medium">{classInfo.course_id}</TableCell>
                          <TableCell>{classInfo.course_name || "-"}</TableCell>
                          <TableCell>{classInfo.creator_name || "-"}</TableCell>
                          <TableCell>{classInfo.teacher_num || 0}</TableCell>
                          <TableCell>{classInfo.student_num || 0}</TableCell>
                          <TableCell>{classInfo.complete_class_num || 0}</TableCell>
                          <TableCell>{classInfo.total_class_num || 0}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {classInfo.sync_time ? new Date(classInfo.sync_time).toLocaleString('zh-CN') : '-'}
                          </TableCell>
                        </TableRow>
                      )
                    })
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
    </div>
  )
}
