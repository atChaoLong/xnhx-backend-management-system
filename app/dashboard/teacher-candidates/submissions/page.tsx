"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "@/lib/fetch"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TeacherDetailsTab } from "@/components/dashboard/teacher-candidates/TeacherDetailsTab"

interface Submission {
  id: string
  created_at: string
  candidate_id: string
  teacher_name: string
  gender: string
  wechat: string
  classin_phone: string
  location: string
  subjects: string[]
  grade_levels: string[]
  used_classin: string
  has_certificate: string
  education: string
  university: string
  teaching_years: number
  available_times: string[]
  textbook_versions: string[]
  student_regions: string[]
  student_levels: string[]
  teaching_style: string
  teaching_experience: string
  success_cases: string
  notes: string | null
  photo_url: string | null
  review_screenshots: string[] | null
}

function joinArray(arr: string[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return "-"
  return arr.filter(Boolean).join("、") || "-"
}

export default function TeacherFormSubmissionsPage() {
  const { toast } = useToast()
  const { role } = usePermission()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const pageSize = 20

  const fetchSubmissions = useCallback(async (page: number) => {
    try {
      setIsLoading(true)
      const response = await api.get(`/api/teacher-form-submissions?page=${page}&limit=${pageSize}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "获取采集记录失败" }))
        throw new Error(err.error || "获取采集记录失败")
      }
      const result = await response.json()
      setSubmissions(result.data || [])
      setTotal(result.pagination?.total || 0)
      setTotalPages(result.pagination?.totalPages || 1)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法获取采集记录",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubmissions(currentPage)
  }, [currentPage, fetchSubmissions])

  return (
    <div className="flex flex-col h-full">
      <Header title="信息采集记录" description="老师通过二维码/链接填写的信息采集记录" />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-6xl mx-auto">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">暂无采集记录</p>
                <p className="text-xs text-muted-foreground mt-1">老师通过二维码或链接填写信息后，记录会显示在这里</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">姓名</TableHead>
                        <TableHead className="w-[80px]">性别</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead>年级</TableHead>
                        <TableHead className="w-[120px]">微信</TableHead>
                        <TableHead className="w-[120px]">手机号</TableHead>
                        <TableHead className="w-[100px]">教资证</TableHead>
                        <TableHead className="w-[80px]">学历</TableHead>
                        <TableHead className="w-[150px]">提交时间</TableHead>
                        <TableHead className="w-[80px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.teacher_name}</TableCell>
                          <TableCell>{s.gender}</TableCell>
                          <TableCell className="text-xs">{joinArray(s.subjects)}</TableCell>
                          <TableCell className="text-xs">{joinArray(s.grade_levels)}</TableCell>
                          <TableCell className="text-xs">{s.wechat}</TableCell>
                          <TableCell className="text-xs">{s.classin_phone}</TableCell>
                          <TableCell>{s.has_certificate}</TableCell>
                          <TableCell>{s.education}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleString("zh-CN")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCandidateId(s.candidate_id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    共 {total} 条记录，第 {currentPage}/{totalPages} 页
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={!!selectedCandidateId} onOpenChange={(open) => !open && setSelectedCandidateId(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>老师信息采集详情</DialogTitle>
          </DialogHeader>
          {selectedCandidateId && (
            <TeacherDetailsTab candidateId={selectedCandidateId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
