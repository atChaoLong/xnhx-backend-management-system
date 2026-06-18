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
import { Loader2, RefreshCw, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { api } from "@/lib/fetch"

interface ClassInClassroom {
  class_id: number
  name: string
  course_id?: number
  course_name?: string
  class_status?: number
  class_type?: number
  start_time?: number
  end_time?: number
  stu_num?: number
  audit_num?: number
  teacher?: any
  sync_time?: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function ClassInIntegrationPage() {
  const [classrooms, setClassrooms] = useState<ClassInClassroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const { toast } = useToast()
  const { teachers, isLoading: isPermissionLoading } = usePermission()
  const canUseClassInOps = !isPermissionLoading && teachers.notes()

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
    onPageChange: (page, size) => fetchClassrooms(page, size),
  })

  // 加载课堂数据
  const fetchClassrooms = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1

      const response = await api.get(`/api/classin/classrooms?from=${from}&to=${to}`)

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const result = await response.json()
      setClassrooms(result.data || [])
      setTotalCount(result.count || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 课堂数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isPermissionLoading || !canUseClassInOps) return
    fetchClassrooms(1, pageSize)
  }, [isPermissionLoading, canUseClassInOps])

  // 格式化时间戳
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }

  // 获取课堂状态文本
  const getClassStatusText = (status?: number) => {
    const statusMap: Record<number, string> = {
      0: '未开始',
      1: '进行中',
      2: '已结束',
    }
    return statusMap[status || 0] || '未知'
  }

  // 获取课堂状态样式
  const getClassStatusStyle = (status?: number) => {
    const styleMap: Record<number, string> = {
      0: 'bg-gray-100 text-gray-800',
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
    }
    return styleMap[status || 0] || 'bg-gray-100 text-gray-800'
  }

  if (isPermissionLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 课堂" description="查看 ClassIn 平台的课堂数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!canUseClassInOps) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 课堂" description="查看 ClassIn 平台的课堂数据" />
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              当前角色无权访问 ClassIn 镜像数据。
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 课堂" description="查看 ClassIn 平台的课堂数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 课堂"
        description="查看 ClassIn 平台的课堂数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">课堂列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => fetchClassrooms(currentPage, pageSize)}
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
                    <TableHead>课堂ID</TableHead>
                    <TableHead>课堂名称</TableHead>
                    <TableHead>所属班级</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>学生数</TableHead>
                    <TableHead>听课数</TableHead>
                    <TableHead>状态</TableHead>
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
                  ) : classrooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    classrooms.map((classroom) => (
                      <TableRow key={classroom.class_id}>
                        <TableCell className="font-medium">{classroom.class_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 text-muted-foreground" />
                            {classroom.name || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{classroom.course_name || "-"}</TableCell>
                        <TableCell>{formatTimestamp(classroom.start_time)}</TableCell>
                        <TableCell>{formatTimestamp(classroom.end_time)}</TableCell>
                        <TableCell>{classroom.stu_num || 0}</TableCell>
                        <TableCell>{classroom.audit_num || 0}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getClassStatusStyle(classroom.class_status)}`}>
                            {getClassStatusText(classroom.class_status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {classroom.sync_time ? new Date(classroom.sync_time).toLocaleString('zh-CN') : '-'}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
