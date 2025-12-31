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
import { usePermission } from "@/lib/hooks/usePermission"

export default function TrialLessonsPage() {
  const router = useRouter()
  const { trialLessons: trialLessonsPerm } = usePermission()
  const [lessons, setLessons] = useState<TrialLesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isMatching, setIsMatching] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState<string | null>(null)
  const [isCreatingClass, setIsCreatingClass] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [lessonToConfirm, setLessonToConfirm] = useState<TrialLesson | null>(null)
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

  // 教师数据
  const [teachers, setTeachers] = useState<Array<{
    id: string
    name: string
    subject?: string
    classin_uid?: number
  }>>([])

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

  // 加载教师数据
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setIsLoadingTeachers(true)

        // 检查 localStorage 中的 token
        const token = localStorage.getItem('supabase.auth.token')
        if (!token) {
          console.warn('未找到认证 token')
          toast({
            variant: "destructive",
            title: "认证失败",
            description: "请重新登录"
          })
          setIsLoadingTeachers(false)
          return
        }

        // 从 user_profiles 表获取 role = 'teacher' 的用户
        const response = await fetch('/api/user-profiles?role=teacher', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('API错误:', response.status, errorData)
          throw new Error(errorData.error || `加载教师失败 (${response.status})`)
        }

        const result = await response.json()
        const data = result.data || []

        console.log('API返回结果:', result)
        console.log('教师数据:', data)
        console.log('教师数量:', data.length)

        // 如果没有教师数据，显示提示
        if (data.length === 0) {
          console.warn('没有找到教师数据，请检查 user_profiles 表中是否有 role=teacher 的记录')
          toast({
            title: "提示",
            description: "系统中暂无教师数据，请先添加教师账号",
            variant: "default"
          })
        }

        // 映射 user_profiles 字段到 teachers 状态
        const mappedTeachers = data.map((profile: any) => {
          console.log('映射教师档案:', profile)
          return {
            id: profile.id,
            name: profile.name || profile.username || '未知',
            subject: profile.subject || profile.teacher_subject || '',
            classin_uid: profile.classin_uid
          }
        })

        console.log('映射后的教师数据:', mappedTeachers)
        setTeachers(mappedTeachers)
      } catch (error: any) {
        console.error("加载教师失败:", error)
        toast({
          variant: "destructive",
          title: "加载教师失败",
          description: error.message || "无法加载教师列表"
        })
      } finally {
        setIsLoadingTeachers(false)
      }
    }

    loadTeachers()
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

  // 快捷匹配老师（销售操作）
  const handleQuickMatchTeacher = async (lesson: TrialLesson) => {
    const teacherName = prompt("请输入匹配的老师姓名：")
    if (!teacherName || !teacherName.trim()) return

    try {
      setIsMatching(lesson.id)
      await TrialLessonsService.updateTrialLesson({
        ...lesson,
        matched_teacher: teacherName.trim(),
      })
      toast({
        title: "匹配成功",
        description: "已成功匹配老师",
      })
      fetchLessons()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "匹配失败",
        description: error.message || "无法匹配老师",
      })
    } finally {
      setIsMatching(null)
    }
  }

  // 快捷确认老师（教务操作）
  const handleQuickConfirmTeacher = (lesson: TrialLesson) => {
    setLessonToConfirm(lesson)
    setConfirmDialogOpen(true)
  }

  // 确认老师对话框中的确认操作
  const handleConfirmTeacherSelect = async (teacherName: string) => {
    if (!lessonToConfirm) return

    try {
      setIsConfirming(lessonToConfirm.id)
      await TrialLessonsService.updateTrialLesson({
        ...lessonToConfirm,
        confirmed_teacher: teacherName,
      })
      toast({
        title: "确认成功",
        description: `已确认老师：${teacherName}`,
      })
      setConfirmDialogOpen(false)
      setLessonToConfirm(null)
      fetchLessons()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "确认失败",
        description: error.message || "无法确认老师",
      })
    } finally {
      setIsConfirming(null)
    }
  }

  // 快捷开课（教务操作）
  const handleQuickCreateClass = async (lesson: TrialLesson) => {
    // 检查必要字段
    if (!lesson.confirmed_teacher) {
      toast({
        variant: "destructive",
        title: "无法开课",
        description: "请先确认老师",
      })
      return
    }

    if (!lesson.trial_time) {
      toast({
        variant: "destructive",
        title: "无法开课",
        description: "请先确定试听时间",
      })
      return
    }

    try {
      setIsCreatingClass(lesson.id)

      // 获取老师的 ClassIn UID
      const teacherResponse = await fetch('/api/teachers/classin')
      const { data: teachers } = await teacherResponse.json()
      const teacher = teachers.find((t: any) => t.teacher_name === lesson.confirmed_teacher)

      if (!teacher || !teacher.classin_uid) {
        toast({
          variant: "destructive",
        title: "无法开课",
        description: "老师未绑定 ClassIn 账号",
        })
        return
      }

      // 调用 ClassIn SDK 创建课室
      const classResponse = await fetch('/api/classin-sdk/classroom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          courseId: process.env.NEXT_PUBLIC_CLASSIN_DEFAULT_COURSE_ID || 'default_course',
          unitId: process.env.NEXT_PUBLIC_CLASSIN_DEFAULT_UNIT_ID || 'default_unit',
          name: `${lesson.child_name || '学生'}的试听课`,
          teacherUid: teacher.classin_uid,
          startTime: new Date(lesson.trial_time).getTime() / 1000, // 转为秒级时间戳
          endTime: new Date(new Date(lesson.trial_time).getTime() + (lesson.trial_duration || 60) * 60 * 1000).getTime() / 1000,
        })
      })

      if (!classResponse.ok) {
        const error = await classResponse.json()
        throw new Error(error.error || '创建课室失败')
      }

      const { data: classroom } = await classResponse.json()

      // 更新试听课程的上课链接
      await TrialLessonsService.updateTrialLesson({
        ...lesson,
        class_link: classroom.liveUrl || classroom.url || '',
      })

      toast({
        title: "开课成功",
        description: "课室已创建，链接已生成",
      })
      fetchLessons()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "开课失败",
        description: error.message || "无法创建课室",
      })
    } finally {
      setIsCreatingClass(null)
    }
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
    // 验证状态：只有试听完并反馈后才能转正
    if (lesson.lesson_status !== 'waiting_feedback' && lesson.lesson_status !== 'completed') {
      toast({
        variant: "destructive",
        title: "无法转正",
        description: "只有试听完并反馈后才能转正为正式订单",
      })
      return
    }

    setIsConverting(lesson.id)
    // 跳转到正式订单创建页面
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

  // 获取试听课程状态标签样式（新）
  const getLessonStatusBadge = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    const statusMap: Record<string, string> = {
      'cancelled': 'bg-gray-100 text-gray-800',           // 取消试听 - 灰色
      'waiting_match': 'bg-yellow-100 text-yellow-800',   // 待匹配老师 - 黄色
      'waiting_confirm': 'bg-blue-100 text-blue-800',     // 待确认老师 - 蓝色
      'waiting_time': 'bg-indigo-100 text-indigo-800',    // 待确认时间 - 靛蓝
      'waiting_link': 'bg-purple-100 text-purple-800',    // 待开链接 - 紫色
      'scheduled': 'bg-cyan-100 text-cyan-800',           // 已排待上课 - 青色
      'waiting_feedback': 'bg-orange-100 text-orange-800',// 上完待反馈 - 橙色
      'completed': 'bg-green-100 text-green-800',         // 已完成 - 绿色
    }
    return statusMap[status] || 'bg-gray-100 text-gray-800'
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
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLessonStatusBadge(lesson.lesson_status)}`}>
                            {lesson.lesson_status_name || "-"}
                          </span>
                          {lesson.is_converted !== undefined && (
                            <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${lesson.is_converted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {lesson.is_converted ? '已转化' : '未转化'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* 快捷匹配老师 - 销售操作，状态为待匹配老师时显示 */}
                            {lesson.lesson_status === 'waiting_match' && trialLessonsPerm.matchTeacher() && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickMatchTeacher(lesson)}
                                disabled={isMatching === lesson.id}
                                title="匹配老师"
                              >
                                {isMatching === lesson.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Plus className="mr-1 h-4 w-4" />
                                    匹配老师
                                  </>
                                )}
                              </Button>
                            )}

                            {/* 快捷确认老师 - 教务操作，状态为待确认老师时显示 */}
                            {lesson.lesson_status === 'waiting_confirm' && trialLessonsPerm.confirmTeacher() && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleQuickConfirmTeacher(lesson)}
                                disabled={isConfirming === lesson.id}
                                className="bg-blue-600 hover:bg-blue-700"
                                title="确认老师"
                              >
                                {isConfirming === lesson.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    确认老师
                                  </>
                                )}
                              </Button>
                            )}

                            {/* 快捷开课 - 教务操作，状态为待开链接时显示 */}
                            {lesson.lesson_status === 'waiting_link' && trialLessonsPerm.addLink() && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleQuickCreateClass(lesson)}
                                disabled={isCreatingClass === lesson.id}
                                className="bg-purple-600 hover:bg-purple-700"
                                title="创建课室并生成链接"
                              >
                                {isCreatingClass === lesson.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    开课
                                  </>
                                )}
                              </Button>
                            )}

                            {/* 转正按钮 - 销售操作，仅在试听完并反馈后显示 */}
                            {(lesson.lesson_status === 'waiting_feedback' || lesson.lesson_status === 'completed') && trialLessonsPerm.convert() && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleConvertToFormal(lesson)}
                                disabled={isConverting === lesson.id}
                                className="bg-green-600 hover:bg-green-700"
                                title="将试听课转正为正式订单"
                              >
                                {isConverting === lesson.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    转正
                                  </>
                                )}
                              </Button>
                            )}

                            {/* 查看详情 */}
                            <Link href={`/dashboard/trial-lessons/${lesson.id}`}>
                              <Button variant="ghost" size="icon" title="查看详情">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>

                            {/* 编辑 */}
                            <Link href={`/dashboard/trial-lessons/${lesson.id}/edit`}>
                              <Button variant="ghost" size="icon" title="编辑">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>

                            {/* 删除 */}
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

      {/* 确认老师对话框 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认老师</DialogTitle>
            <DialogDescription>
              请从教师列表中选择要确认的老师
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto py-4">
            {isLoadingTeachers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无教师数据
              </div>
            ) : (
              <div className="space-y-2">
                {teachers.map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => handleConfirmTeacherSelect(teacher.name)}
                    disabled={isConfirming !== null}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{teacher.name}</span>
                      {teacher.subject && (
                        <span className="text-xs text-muted-foreground">{teacher.subject}</span>
                      )}
                    </div>
                    {teacher.classin_uid && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        已绑定ClassIn
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={isConfirming !== null}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
