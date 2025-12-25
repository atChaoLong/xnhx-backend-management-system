"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TeacherCandidatesService, TeacherCandidate } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"

export default function TeacherCandidatesPage() {
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载候选列表
  const fetchCandidates = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await TeacherCandidatesService.getTeacherCandidates()
      setCandidates(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载老师面试列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  // 删除面试
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个面试记录吗？")) return

    try {
      setIsDeleting(id)
      await TeacherCandidatesService.deleteTeacherCandidate(id)
      toast({
        title: "删除成功",
        description: "面试记录已删除",
      })
      fetchCandidates()
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

  // 获取复核状态标签样式
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case '已复核':
        return 'bg-green-100 text-green-800'
      case '不符合':
        return 'bg-red-100 text-red-800'
      case '待复核':
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  // 获取是否录用标签样式
  const getHiredBadge = (isHired?: boolean) => {
    if (isHired) {
      return 'bg-blue-100 text-blue-800'
    }
    return 'bg-gray-100 text-gray-800'
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
                <p className="text-sm text-muted-foreground">共 {candidates.length} 位面试者</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchCandidates} disabled={isLoading}>
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
                    <TableHead>姓名</TableHead>
                    <TableHead>微信号</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>科目</TableHead>
                    <TableHead>面试日期</TableHead>
                    <TableHead>复核状态</TableHead>
                    <TableHead>录用状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增面试"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">{candidate.name || "-"}</TableCell>
                        <TableCell>{candidate.wechat_id || "-"}</TableCell>
                        <TableCell>{candidate.grade_level || "-"}</TableCell>
                        <TableCell>
                          {candidate.subjects_taught && candidate.subjects_taught.length > 0
                            ? candidate.subjects_taught.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {candidate.interview_date
                            ? format(new Date(candidate.interview_date), 'yyyy-MM-dd')
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(candidate.review_status)}`}>
                            {candidate.review_status || '待复核'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHiredBadge(candidate.is_hired)}`}>
                            {candidate.is_hired ? '已录用' : '未录用'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/teacher-candidates/${candidate.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(candidate.id)}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
