"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Edit, Video } from "lucide-react"
import { TrialLessonsService, TrialLesson } from "@/lib/services/trialLessons"
import { DictionaryService } from "@/lib/services/dictionary"
import { api } from "@/lib/fetch"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import Link from "next/link"
import { format } from "date-fns"

export default function TrialLessonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { trialLessons: trialLessonsPerm, isLoading: isPermissionLoading } = usePermission()
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [lesson, setLesson] = useState<TrialLesson | null>(null)

  const lessonId = params.id as string
  const canCreateClassIn = !isPermissionLoading && trialLessonsPerm.addLink()

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    subjects: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
    courseStatuses: Array<{ code: string; label: string }>
    studentTypes: Array<{ code: string; label: string }>
  }>({
    grades: [],
    subjects: [],
    regions: [],
    courseStatuses: [],
    studentTypes: [],
  })

  // 并行加载试听课程和字典数据
  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      const [lessonResult, dictResult] = await Promise.allSettled([
        TrialLessonsService.getTrialLessonById(lessonId),
        DictionaryService.getAllDictionaries(),
      ])

      if (cancelled) return

      if (lessonResult.status === 'fulfilled') {
        setLesson(lessonResult.value)
      } else {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: "无法加载试听课程数据",
        })
      }
      setIsLoading(false)

      if (dictResult.status === 'fulfilled') {
        const dicts = dictResult.value
        setDictOptions({
          grades: dicts.grade || [],
          subjects: dicts.subject || [],
          regions: dicts.province || [],
          courseStatuses: dicts.trial_course_status || [],
          studentTypes: dicts.student_type || [],
        })
      }
      setIsLoadingDict(false)
    }

    loadAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  // 根据编码获取标签
  const getLabelByCode = (
    code: string,
    category: 'grades' | 'subjects' | 'regions' | 'courseStatuses' | 'studentTypes'
  ) => {
    const items = dictOptions[category]
    const item = items.find(i => i.code === code)
    return item?.label || code
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

  // 创建ClassIn课程
  const handleCreateClassIn = async () => {
    if (!canCreateClassIn) {
      toast({
        variant: "destructive",
        title: "权限不足",
        description: "只有教务或管理员可以创建ClassIn课程",
      })
      return
    }

    if (!lesson) return

    // 检查是否已确认教师
    if (!lesson.confirmed_teacher) {
      toast({
        variant: "destructive",
        title: "无法创建课程",
        description: "请先确认教师后再创建ClassIn课程",
      })
      return
    }

    // 检查是否已经创建
    if (lesson.classin_course_id) {
      toast({
        variant: "destructive",
        title: "课程已存在",
        description: "该试听课程已创建ClassIn课程",
      })
      return
    }

    try {
      setIsCreating(true)

      const response = await api.post('/api/trial-lessons/create-classin', { trialLessonId: lesson.id })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '创建课程失败' }))
        throw new Error(error.error || '创建课程失败')
      }

      const result = await response.json()

      toast({
        title: "创建成功",
        description: `已成功创建课程（ID: ${result.data.courseId}）和课节（ID: ${result.data.classId}）`,
      })

      // 重新加载试听课程数据
      const updatedLesson = await TrialLessonsService.getTrialLessonById(lessonId)
      setLesson(updatedLesson)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建ClassIn课程",
      })
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading || isLoadingDict) {
    return (
      <div className="flex flex-col h-full">
        <Header title="试听课程详情" description="查看试听课程详细信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex flex-col h-full">
        <Header title="试听课程详情" description="查看试听课程详细信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">试听课程不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该试听课程信息</p>
            <Link href="/dashboard/trial-lessons">
              <Button>返回列表</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="试听课程详情"
        description="查看试听课程详细信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* 头部操作栏 */}
          <div className="flex justify-between items-center mb-6">
            <Link href="/dashboard/trial-lessons">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回列表
              </Button>
            </Link>
            <div className="flex gap-2">
              {lesson.classin_course_id ? (
                <Button disabled className="bg-green-600">
                  <Video className="mr-2 h-4 w-4" />
                  ClassIn课程已创建
                </Button>
              ) : canCreateClassIn ? (
                <Button
                  onClick={handleCreateClassIn}
                  disabled={isCreating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-4 w-4" />
                      创建ClassIn课程
                    </>
                  )}
                </Button>
              ) : null}
              <Link href={`/dashboard/trial-lessons/${lesson.id}/edit`}>
                <Button>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
              </Link>
            </div>
          </div>

          {/* 基本信息 */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b">基本信息</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">孩子称呼</span>
                <span className="text-base font-medium">{lesson.child_name || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">来源</span>
                <span className="text-base font-medium">
                  {lesson.lead?.report_number
                    ? `线索 ${lesson.lead.report_number}`
                    : lesson.student_id
                    ? `正式生 ${lesson.student_id}`
                    : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">手机号</span>
                <span className="text-base font-medium">{lesson.phone || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">ClassIn 学生账号</span>
                <span className="text-base font-medium">
                  {lesson.classin_student_uid
                    ? `已绑定 UID ${lesson.classin_student_uid}`
                    : lesson.classin_student_bound
                    ? "已绑定"
                    : lesson.classin_student_error
                    ? `绑定失败：${lesson.classin_student_error}`
                    : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">渠道</span>
                <span className="text-base font-medium">{lesson.channel || "-"}</span>
              </div>
            </div>
          </section>

          {/* 课程信息 */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b">课程信息</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">地域</span>
                <span className="text-base font-medium">{getLabelByCode(lesson.region || "", 'regions')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">年级</span>
                <span className="text-base font-medium">{getLabelByCode(lesson.grade || "", 'grades')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">试听科目</span>
                <span className="text-base font-medium">{getLabelByCode(lesson.trial_subject || "", 'subjects')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">试听时长</span>
                <span className="text-base font-medium">{lesson.trial_duration ? `${lesson.trial_duration} 分钟` : "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">试听时间</span>
                <span className="text-base font-medium">
                  {lesson.trial_time ? format(new Date(lesson.trial_time), 'yyyy-MM-dd HH:mm') : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">试听金额</span>
                <span className="text-base font-medium">
                  {lesson.trial_amount ? `¥${lesson.trial_amount}` : "-"}
                </span>
              </div>
            </div>
          </section>

          {/* 状态信息 */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b">状态信息</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">试听状态</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lesson.status)}`}>
                    {getStatusText(lesson.status)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">紧急程度</span>
                <div className="mt-1">
                  {lesson.urgency_level ? (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyBadge(lesson.urgency_level)}`}>
                      {getUrgencyText(lesson.urgency_level)}
                    </span>
                  ) : (
                    <span className="text-base font-medium">-</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 业务信息 */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b">业务信息</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">分配顾问</span>
                <span className="text-base font-medium">{lesson.assigned_consultant || "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">课程状态</span>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {lesson.course_status ? getLabelByCode(lesson.course_status, 'courseStatuses') : "-"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">学生类型</span>
                <span className="text-base font-medium">
                  {lesson.student_type ? getLabelByCode(lesson.student_type, 'studentTypes') : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">匹配教师</span>
                <span className="text-base font-medium">{lesson.matched_teacher || "-"}</span>
              </div>
            </div>
          </section>

          {/* 教务信息 */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b">教务信息</h3>
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">确认教师</span>
                <span className="text-base font-medium">{lesson.confirmed_teacher || "-"}</span>
              </div>

              {lesson.classin_course_id && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-green-600 mb-3">ClassIn 课程已创建</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">课程ID</span>
                      <span className="text-base font-medium">{lesson.classin_course_id}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">单元ID</span>
                      <span className="text-base font-medium">{lesson.classin_unit_id || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">课节ID</span>
                      <span className="text-base font-medium">{lesson.classin_class_id || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">活动ID</span>
                      <span className="text-base font-medium">{lesson.classin_activity_id || "-"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 备注信息 */}
          {lesson.notes && (
            <section className="mb-8">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">备注</h3>
              <p className="text-base whitespace-pre-wrap">{lesson.notes}</p>
            </section>
          )}

          {/* 付款凭证 */}
          {lesson.payment_proof && (
            <section className="mb-8">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">付款凭证</h3>
              <div className="space-y-3">
                {lesson.payment_proof.match(/\.(jpg|jpeg|png|gif|webp|avif|heic|heif|bmp|tif|tiff)/i) ? (
                  // 如果是图片URL，显示图片
                  <div>
                    <img
                      src={lesson.payment_proof}
                      alt="付款凭证"
                      className="max-w-sm h-auto border rounded cursor-pointer"
                      onClick={() => window.open(lesson.payment_proof, '_blank')}
                      onError={(e) => {
                        // 图片加载失败时显示URL
                        e.currentTarget.style.display = 'none'
                        const fallback = document.createElement('p')
                        fallback.className = 'text-sm text-muted-foreground break-all'
                        fallback.textContent = lesson.payment_proof
                        e.currentTarget.parentElement?.appendChild(fallback)
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      点击图片可在新窗口打开
                    </p>
                  </div>
                ) : (
                  // 如果不是图片URL，显示文本
                  <p className="text-sm text-muted-foreground break-all">{lesson.payment_proof}</p>
                )}
              </div>
            </section>
          )}

          {/* 系统信息 */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b">系统信息</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">创建时间</span>
                <span className="text-base font-medium">
                  {lesson.created_at ? format(new Date(lesson.created_at), 'yyyy-MM-dd HH:mm:ss') : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">更新时间</span>
                <span className="text-base font-medium">
                  {lesson.updated_at ? format(new Date(lesson.updated_at), 'yyyy-MM-dd HH:mm:ss') : "-"}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
