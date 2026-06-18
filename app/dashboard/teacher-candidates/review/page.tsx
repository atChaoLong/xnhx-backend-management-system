"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Edit, Loader2, Play, RefreshCw } from "lucide-react"
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
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { useToast } from "@/hooks/use-toast"
import TeachingReviewForm from "@/components/teacher/recruitment/TeachingReviewForm"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function formatDateTime(date?: string, time?: string) {
  if (!date) return "-"
  const formattedDate = format(new Date(date), "yyyy-MM-dd")
  return time ? `${formattedDate} ${time}` : formattedDate
}

export default function TeacherCandidateReviewPage() {
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<TeacherCandidate | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { teacherCandidates } = usePermission()

  const canReviewVideo = teacherCandidates.reviewVideo()

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
    if (!canReviewVideo) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TeacherCandidatesService.getTeacherCandidates(from, to, {
        queue: "teaching_review",
      })
      setCandidates(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载待复核候选人",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates(1, pageSize)
  }, [canReviewVideo])

  if (!canReviewVideo) {
    return (
      <div className="flex flex-col h-full">
        <Header title="教学复核" description="复核已上传录像的老师候选人" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              你没有教学复核权限
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading && candidates.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="教学复核" description="复核已上传录像的老师候选人" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="教学复核" description="复核已上传录像的老师候选人" />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">待复核列表</h3>
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
                    <TableHead>面试时间</TableHead>
                    <TableHead>录像状态</TableHead>
                    <TableHead>初评</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        暂无待教学复核的候选人
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
                        <TableCell>{formatDateTime(candidate.interview_date, candidate.interview_time)}</TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            已上传
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {candidate.initial_evaluation || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {candidate.video_recording_url && (
                              <Link href={candidate.video_recording_url} target="_blank" rel="noopener noreferrer">
                                <Button size="icon" variant="ghost">
                                  <Play className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            <Button size="sm" onClick={() => setSelectedCandidate(candidate)}>
                              复核
                            </Button>
                            <Link href={`/dashboard/teacher-candidates/${candidate.id}/edit`}>
                              <Button size="icon" variant="ghost">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
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

      {selectedCandidate && (
        <TeachingReviewForm
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onSuccess={() => {
            setSelectedCandidate(null)
            fetchCandidates(currentPage, pageSize)
          }}
        />
      )}
    </div>
  )
}
