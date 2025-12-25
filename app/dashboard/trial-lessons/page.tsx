"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Plus, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TrialLessonsService, TrialLesson } from "@/lib/services/trialLessons"
import { useToast } from "@/hooks/use-toast"

export default function TrialLessonsPage() {
  const [lessons, setLessons] = useState<TrialLesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载试听课程列表
  const fetchLessons = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await TrialLessonsService.getTrialLessons()
      setLessons(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载试听课程列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  // 删除试听课程
  const handleDeleteClick = (id: string) => {
    setLessonToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!lessonToDelete) return

    try {
      setIsDeleting(lessonToDelete)
      await TrialLessonsService.deleteTrialLesson(lessonToDelete)
      toast({
        title: "删除成功",
        description: "试听课程已删除",
      })
      fetchLessons()
      setDeleteDialogOpen(false)
      setLessonToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除试听课程",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setLessonToDelete(null)
  }

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-gray-100 text-gray-800',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-800'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': '待确认',
      'confirmed': '已确认',
      'completed': '已完成',
      'cancelled': '已取消',
    }
    return statusMap[status] || status
  }

  // 获取紧急程度标签样式
  const getUrgencyBadge = (urgency?: string) => {
    if (!urgency) return ''
    const urgencyMap: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-800',
      'medium': 'bg-blue-100 text-blue-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800',
    }
    return urgencyMap[urgency] || ''
  }

  // 获取紧急程度文本
  const getUrgencyText = (urgency?: string) => {
    if (!urgency) return '-'
    const urgencyMap: Record<string, string> = {
      'low': '低',
      'medium': '中',
      'high': '高',
      'urgent': '紧急',
    }
    return urgencyMap[urgency] || urgency
  }

  // 切换状态
  const handleToggleStatus = async (lesson: TrialLesson) => {
    const statusFlow: Record<string, string> = {
      'pending': 'confirmed',
      'confirmed': 'completed',
      'completed': 'cancelled',
      'cancelled': 'pending',
    }

    try {
      await TrialLessonsService.updateTrialLesson({
        ...lesson,
        status: statusFlow[lesson.status] as any,
      })
      toast({
        title: "更新成功",
        description: "状态已更新",
      })
      fetchLessons()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新状态",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="试听课程管理" description="管理试听课程安排" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="试听课程管理"
        description="管理试听课程安排"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">试听课程列表</h3>
                <p className="text-sm text-muted-foreground">共 {lessons.length} 个试听课程</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchLessons} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/trial-lessons/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增试听课程
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>孩子称呼</TableHead>
                    <TableHead>试听科目</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>地域</TableHead>
                    <TableHead>试听时间</TableHead>
                    <TableHead>时长(小时)</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>紧急程度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增试听课程"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    lessons.map((lesson) => (
                      <TableRow key={lesson.id}>
                        <TableCell className="font-medium">{lesson.child_name || "-"}</TableCell>
                        <TableCell>{lesson.trial_subject || "-"}</TableCell>
                        <TableCell>{lesson.grade || "-"}</TableCell>
                        <TableCell>{lesson.region || "-"}</TableCell>
                        <TableCell>
                          {lesson.trial_time ? format(new Date(lesson.trial_time), 'yyyy-MM-dd HH:mm') : "-"}
                        </TableCell>
                        <TableCell>{lesson.trial_duration || "-"}</TableCell>
                        <TableCell>{lesson.phone || "-"}</TableCell>
                        <TableCell>{lesson.channel || "-"}</TableCell>
                        <TableCell>
                          {lesson.urgency_level && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyBadge(lesson.urgency_level)}`}>
                              {getUrgencyText(lesson.urgency_level)}
                            </span>
                          )}
                          {!lesson.urgency_level && "-"}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(lesson)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${getStatusBadge(lesson.status)}`}
                          >
                            {getStatusText(lesson.status)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/trial-lessons/${lesson.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(lesson.id)}
                              disabled={isDeleting === lesson.id}
                            >
                              {isDeleting === lesson.id ? (
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

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个试听课程吗？此操作无法撤销。
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
