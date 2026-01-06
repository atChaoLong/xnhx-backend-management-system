"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPageSize, PaginationPrevious, PaginationInfo } from "@/components/ui/pagination"
import { Loader2 } from "lucide-react"
import { ClassroomsService, Classroom } from "@/lib/services/classrooms"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

export default function ClassroomPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
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
    onPageChange: (page, size) => fetchClassrooms(page, size),
  })

  const fetchClassrooms = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await ClassroomsService.getClassrooms(from, to)
      setClassrooms(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课堂列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClassrooms(1, pageSize)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="课堂管理" description="展示 ClassIn 课堂列表" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="课堂管理" description="展示 ClassIn 课堂列表" />
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">课堂列表</h3>
                <PaginationInfo currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} />
              </div>
              <div>
                <Button variant="outline" onClick={() => fetchClassrooms(currentPage, pageSize)} disabled={isLoading}>刷新</Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>课堂ID</TableHead>
                    <TableHead>课堂名称</TableHead>
                    <TableHead>班级名称</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>活动ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classrooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无数据</TableCell>
                    </TableRow>
                  ) : (
                    classrooms.map((c) => (
                      <TableRow key={c.class_id}>
                        <TableCell className="font-medium">{c.class_id}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.course_name || "-"}</TableCell>
                        <TableCell>{c.start_time ? new Date(c.start_time * 1000).toLocaleString() : "-"}</TableCell>
                        <TableCell>{c.end_time ? new Date(c.end_time * 1000).toLocaleString() : "-"}</TableCell>
                        <TableCell>{c.activity_id ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <PaginationInfo currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} />
              <div className="flex items-center gap-4">
                <PaginationPageSize pageSize={pageSize} onPageSizeChange={handlePageSizeChange} options={PAGE_SIZE_OPTIONS} />
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={goToPreviousPage} className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"} disabled={!canGoPrevious} />
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
                          <PaginationLink onClick={() => goToPage(page)} isActive={page === currentPage} className="cursor-pointer" disabled={false}>
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    <PaginationItem>
                      <PaginationNext onClick={goToNextPage} className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"} disabled={!canGoNext} />
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
