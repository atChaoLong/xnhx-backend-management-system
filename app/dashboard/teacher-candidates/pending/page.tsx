"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationPageSize,
  PaginationInfo,
} from "@/components/ui/pagination"
import { TeacherCandidatesService, type TeacherCandidate } from "@/lib/services/teacherCandidates"
import SalaryNegotiationForm from "@/components/teacher/recruitment/SalaryNegotiationForm"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { useToast } from "@/hooks/use-toast"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function formatDate(value?: string) {
  if (!value) return "-"
  return format(new Date(value), "yyyy-MM-dd")
}

export default function PendingTeacherCandidatesPage() {
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [salaryCandidate, setSalaryCandidate] = useState<TeacherCandidate | null>(null)
  const { toast } = useToast()
  const { teacherCandidates } = usePermission()

  const canReviewCandidates = teacherCandidates.confirmEntry()

  const {
    currentPage,
    pageSize,
    totalPages,
    canGoNext,
    canGoPrevious,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
  } = usePagination({
    totalCount,
    pageSize: 20,
    onPageChange: (page, size) => fetchCandidates(page, size),
  })

  async function fetchCandidates(page: number = 1, size: number = pageSize) {
    if (!canReviewCandidates) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TeacherCandidatesService.getTeacherCandidates(from, to, {
        queue: "pending_entry",
      })
      setCandidates(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载待入库候选人",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates(1, pageSize)
  }, [canReviewCandidates])

  if (!canReviewCandidates) {
    return (
      <div className="flex flex-col h-full">
        <Header title="待入库老师" description="复核通过后的老师入库队列" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              你没有查看待入库队列的权限
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading && candidates.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="待入库老师" description="复核通过后的老师入库队列" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="待入库老师" description="复核通过后的老师入库队列" />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">待入库列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => fetchCandidates(currentPage, pageSize)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                刷新
              </Button>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px] min-w-[140px]">姓名</TableHead>
                    <TableHead>科目</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>复核结果</TableHead>
                    <TableHead>老师等级</TableHead>
                    <TableHead>核定课时费</TableHead>
                    <TableHead>复核日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        暂无待入库老师
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">{candidate.name || "-"}</TableCell>
                        <TableCell>
                          {candidate.subjects_taught?.length ? candidate.subjects_taught.join(", ") : "-"}
                        </TableCell>
                        <TableCell>{candidate.grade_level || "-"}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            {candidate.review_result || "通过"}
                          </Badge>
                        </TableCell>
                        <TableCell>{candidate.teacher_level || "-"}</TableCell>
                        <TableCell>
                          {candidate.approved_hourly_rate !== undefined && candidate.approved_hourly_rate !== null
                            ? `${candidate.approved_hourly_rate} 元/小时`
                            : "-"}
                        </TableCell>
                        <TableCell>{formatDate(candidate.review_date)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setSalaryCandidate(candidate)}>
                            谈薪入库
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
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
                        className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 py-2 text-sm">
                        第 {currentPage} / {totalPages || 1} 页
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={goToNextPage}
                        className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {salaryCandidate && (
        <SalaryNegotiationForm
          candidate={salaryCandidate}
          onClose={() => setSalaryCandidate(null)}
          onSuccess={() => {
            setSalaryCandidate(null)
            fetchCandidates(currentPage, pageSize)
          }}
        />
      )}
    </div>
  )
}
