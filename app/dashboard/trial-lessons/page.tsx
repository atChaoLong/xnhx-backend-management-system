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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, Eye, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TrialLessonsService, TrialLesson } from "@/lib/services/trialLessons"
import { DictionaryService } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"

export default function TrialLessonsPage() {
  const router = useRouter()
  const [lessons, setLessons] = useState<TrialLesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    subjects: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
  }>({
    grades: [],
    subjects: [],
    regions: [],
  })

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

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getAllDictionaries()

        setDictOptions({
          grades: dicts.grade || [],
          subjects: dicts.subject || [],
          regions: dicts.province || [],
        })
      } catch (error) {
        console.error("加载字典失败:", error)
      } finally {
        setIsLoadingDict(false)
      }
    }

    loadDictionaries()
  }, [])

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  // 根据编码获取标签
  const getLabelByCode = (code: string, category: 'grades' | 'subjects' | 'regions') => {
    const items = dictOptions[category]
    const item = items.find(i => i.code === code)
    return item?.label || code
  }

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

  // 转正为正式订单
  const handleConvertToFormal = (lesson: TrialLesson) => {
    // 跳转到正式订单创建页面，并传递试听课信息
    router.push(`/dashboard/formal-orders/new?trialLessonId=${lesson.id}`)
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

  if (isLoading || isLoadingDict) {
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
                    <TableHead>时长</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>试听金额</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>课程状态</TableHead>
                    <TableHead>分配顾问</TableHead>
                    <TableHead>匹配教师</TableHead>
                    <TableHead>确认教师</TableHead>
                    <TableHead>学生类型</TableHead>
                    <TableHead>紧急程度</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增试听课程"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    lessons.map((lesson) => (
                      <TableRow key={lesson.id}>
                        <TableCell className="font-medium">
                          {lesson.child_name || "-"}
                        </TableCell>
                        <TableCell>{getLabelByCode(lesson.trial_subject || "", 'subjects')}</TableCell>
                        <TableCell>{getLabelByCode(lesson.grade || "", 'grades')}</TableCell>
                        <TableCell>{getLabelByCode(lesson.region || "", 'regions')}</TableCell>
                        <TableCell>
                          {lesson.trial_time ? format(new Date(lesson.trial_time), 'yyyy-MM-dd HH:mm') : "-"}
                        </TableCell>
                        <TableCell>{lesson.trial_duration || "-"}</TableCell>
                        <TableCell>{lesson.phone || "-"}</TableCell>
                        <TableCell>
                          {lesson.trial_amount ? `¥${lesson.trial_amount}` : "-"}
                        </TableCell>
                        <TableCell>{lesson.channel || "-"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {lesson.course_status || "-"}
                          </span>
                        </TableCell>
                        <TableCell>{lesson.assigned_consultant || "-"}</TableCell>
                        <TableCell>{lesson.matched_teacher || "-"}</TableCell>
                        <TableCell>{lesson.confirmed_teacher || "-"}</TableCell>
                        <TableCell>{lesson.student_type || "-"}</TableCell>
                        <TableCell>
                          {lesson.urgency_level && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyBadge(lesson.urgency_level)}`}>
                              {getUrgencyText(lesson.urgency_level)}
                            </span>
                          )}
                          {!lesson.urgency_level && "-"}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={lesson.notes || ""}>
                            {lesson.notes || "-"}
                          </div>
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
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleConvertToFormal(lesson)}
                              className="bg-green-600 hover:bg-green-700"
                              title="转正为正式订单"
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              转正
                            </Button>
                            <Link href={`/dashboard/trial-lessons/${lesson.id}`}>
                              <Button variant="ghost" size="icon" title="查看详情">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/trial-lessons/${lesson.id}/edit`}>
                              <Button variant="ghost" size="icon" title="编辑">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(lesson.id)}
                              disabled={isDeleting === lesson.id}
                              title="删除"
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
