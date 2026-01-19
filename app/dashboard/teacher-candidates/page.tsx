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
import { Plus, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TeacherCandidatesService, TeacherCandidate } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"

export default function TeacherCandidatesPage() {
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null)
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
    onPageChange: (page, size) => fetchCandidates(page, size),
  })

  // 加载候选列表
  const fetchCandidates = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await TeacherCandidatesService.getTeacherCandidates(from, to)
      setCandidates(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载老师面试列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates(1, pageSize)
  }, [])

  // 删除面试
  const handleDeleteClick = (id: string) => {
    setCandidateToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!candidateToDelete) return

    try {
      setIsDeleting(candidateToDelete)
      await TeacherCandidatesService.deleteTeacherCandidate(candidateToDelete)
      toast({
        title: "删除成功",
        description: "面试记录已删除",
      })
      fetchCandidates(currentPage, pageSize)
      setDeleteDialogOpen(false)
      setCandidateToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除面试记录",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setCandidateToDelete(null)
  }

  

  // 计算候选人的当前状态
  const calculateCandidateStatus = (candidate: TeacherCandidate): string => {
    // 如果已手动设置状态，使用该状态
    if (candidate.candidate_status === 'review_rejected') return '复核拒绝'
    if (candidate.candidate_status === 'pending_entry') return '待入库'
    if (candidate.candidate_status === 'pause_scheduling') return '暂停排课'
    if (candidate.candidate_status === 'disabled') return '停用'

    // 自动计算状态
    // 1. 复核结果非空 -> 已复核
    if (candidate.review_result && candidate.review_result.trim().length > 0) {
      return '已复核'
    }
    // 2. 有面试录像或试讲视频 -> 待复核
    if (candidate.video_recording_url || candidate.trial_video_url) {
      return '待复核'
    }

    // 3. 有确切的面试时间 -> 面试中
    if (candidate.interview_date) {
      return '面试中'
    }

    // 4. 有微信号 -> 已联系
    if (candidate.wechat_id) {
      return '已联系'
    }

    // 5. 默认状态 -> 待联系
    return '待联系'
  }

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case '待联系':
        return 'bg-gray-100 text-gray-800'
      case '已联系':
        return 'bg-blue-100 text-blue-800'
      case '面试中':
        return 'bg-purple-100 text-purple-800'
      case '待复核':
        return 'bg-yellow-100 text-yellow-800'
      case '已复核':
        return 'bg-green-100 text-green-800'
      case '待入库':
        return 'bg-cyan-100 text-cyan-800'
      case '复核拒绝':
        return 'bg-red-100 text-red-800'
      case '可排试听':
        return 'bg-green-100 text-green-800'
      case '试听后待复核':
        return 'bg-orange-100 text-orange-800'
      case '可排正式':
        return 'bg-emerald-100 text-emerald-800'
      case '暂停排课':
        return 'bg-amber-100 text-amber-800'
      case '停用':
        return 'bg-red-200 text-red-900'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师面试" description="管理老师面试信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="老师面试"
        description="管理老师面试信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">面试列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchCandidates(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/teacher-candidates/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增面试
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">姓名</TableHead>
                    <TableHead className="sticky left-[140px] z-30 bg-background w-[140px] min-w-[140px]">科目</TableHead>
                    <TableHead>微信号</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>面试日期</TableHead>
                    <TableHead>候选人状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击&quot;新增面试&quot;开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((candidate) => {
                      const status = calculateCandidateStatus(candidate)
                      return (
                        <TableRow key={candidate.id}>
                          <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 font-medium w-[140px] min-w-[140px]">{candidate.name || "-"}</TableCell>
                          <TableCell className="sticky left-[140px] z-20 bg-background group-hover:bg-muted/50 w-[140px] min-w-[140px]">
                            {candidate.subjects_taught && candidate.subjects_taught.length > 0
                              ? candidate.subjects_taught.join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell>{candidate.wechat_id || "-"}</TableCell>
                          <TableCell>{candidate.grade_level || "-"}</TableCell>
                          <TableCell>
                            {candidate.interview_date
                              ? format(new Date(candidate.interview_date), 'yyyy-MM-dd')
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(status)}`}>
                              {status}
                            </span>
                          </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {candidate.review_result === '通过' && !candidate.is_hired && (
                              <Link href={`/dashboard/teacher-candidates/${candidate.id}/entry`}>
                                <Button size="sm">
                                  入库
                                </Button>
                              </Link>
                            )}
                            <Link href={`/dashboard/teacher-candidates/${candidate.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(candidate.id)}
                                disabled={isDeleting === candidate.id}
                              >
                                {isDeleting === candidate.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

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

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个面试记录吗？此操作无法撤销。
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
