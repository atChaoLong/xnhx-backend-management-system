"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Edit, Loader2, RefreshCw, CalendarClock, Target } from "lucide-react"
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
import { api } from "@/lib/fetch"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { useToast } from "@/hooks/use-toast"
import SchedulingForm from "@/components/teacher/recruitment/SchedulingForm"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function TeacherCandidateInterviewPage() {
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<TeacherCandidate | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isGrabbing, setIsGrabbing] = useState<string | null>(null)
  const { toast } = useToast()
  const { user, teacherCandidates } = usePermission()

  const canScheduleInterview = teacherCandidates.interview()
  const canGrab = user?.role === 'teacher_recruiter' || user?.role === 'admin'

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
    if (!canScheduleInterview) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TeacherCandidatesService.getTeacherCandidates(from, to, {
        queue: "scheduling",
      })
      setCandidates(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载待约面候选人",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates(1, pageSize)
  }, [canScheduleInterview])

  const handleGrab = async (candidate: TeacherCandidate) => {
    try {
      setIsGrabbing(candidate.id)
      const response = await api.post("/api/teacher-candidates/grab", { id: candidate.id })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "抢单失败" }))
        throw new Error(error.error || "抢单失败")
      }

      toast({ title: "抢单成功", description: "该候选人已分配给你" })
      fetchCandidates(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "抢单失败",
        description: error.message || "无法抢单",
      })
    } finally {
      setIsGrabbing(null)
    }
  }

  if (!canScheduleInterview) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师约面" description="为候选老师安排面试时间" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              你没有约面权限
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading && candidates.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师约面" description="为候选老师安排面试时间" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="老师约面" description="为候选老师安排面试时间" />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">待约面列表</h3>
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
                    <TableHead>微信号</TableHead>
                    <TableHead>科目</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>简历</TableHead>
                    <TableHead>抢单状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        暂无待约面候选人
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">{candidate.name || "-"}</TableCell>
                        <TableCell>{candidate.wechat_id || "-"}</TableCell>
                        <TableCell>
                          {candidate.subjects_taught?.length ? candidate.subjects_taught.join(", ") : "-"}
                        </TableCell>
                        <TableCell>{candidate.grade_level || "-"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {candidate.resume_url ? (
                            <Link href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              查看简历
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.grab_user_name ? (
                            <Badge className="bg-orange-500">已抢单: {candidate.grab_user_name}</Badge>
                          ) : (
                            <Badge variant="outline">待抢单</Badge>
                          )}
                        </TableCell>
                        <TableCell>{candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canGrab && !candidate.grab_user_id && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleGrab(candidate)}
                                disabled={isGrabbing === candidate.id}
                              >
                                {isGrabbing === candidate.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    抢单中...
                                  </>
                                ) : (
                                  <>
                                    <Target className="mr-2 h-4 w-4" />
                                    抢单
                                  </>
                                )}
                              </Button>
                            )}
                            <Button size="sm" onClick={() => setSelectedCandidate(candidate)}>
                              <CalendarClock className="mr-2 h-4 w-4" />
                              约面
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
        <SchedulingForm
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
