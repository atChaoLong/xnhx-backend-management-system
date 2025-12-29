"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ArrowLeft, Edit } from "lucide-react"
import { TrialLessonsService, TrialLesson } from "@/lib/services/trialLessons"
import { DictionaryService } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { format } from "date-fns"

export default function TrialLessonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [lesson, setLesson] = useState<TrialLesson | null>(null)

  const lessonId = params.id as string

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

  // 加载试听课程数据
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setIsLoading(true)
        const data = await TrialLessonsService.getTrialLessonById(lessonId)
        setLesson(data)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载试听课程数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchLesson()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

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

  // 根据编码获取标签
  const getLabelByCode = (code: string, category: 'grades' | 'subjects' | 'regions') => {
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 头部操作栏 */}
          <div className="flex justify-between items-center">
            <Link href="/dashboard/trial-lessons">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回列表
              </Button>
            </Link>
            <Link href={`/dashboard/trial-lessons/${lesson.id}/edit`}>
              <Button>
                <Edit className="mr-2 h-4 w-4" />
                编辑
              </Button>
            </Link>
          </div>

          {/* 基本信息 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">孩子称呼</p>
                  <p className="text-base font-medium">{lesson.child_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">关联线索ID</p>
                  <p className="text-base font-medium">{lesson.lead_id || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">手机号</p>
                  <p className="text-base font-medium">{lesson.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">渠道</p>
                  <p className="text-base font-medium">{lesson.channel || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 课程信息 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">课程信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">地域</p>
                  <p className="text-base font-medium">{getLabelByCode(lesson.region || "", 'regions')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">年级</p>
                  <p className="text-base font-medium">{getLabelByCode(lesson.grade || "", 'grades')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">试听科目</p>
                  <p className="text-base font-medium">{getLabelByCode(lesson.trial_subject || "", 'subjects')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">试听时长</p>
                  <p className="text-base font-medium">{lesson.trial_duration ? `${lesson.trial_duration} 小时` : "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">试听时间</p>
                  <p className="text-base font-medium">
                    {lesson.trial_time ? format(new Date(lesson.trial_time), 'yyyy-MM-dd HH:mm') : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">试听金额</p>
                  <p className="text-base font-medium">
                    {lesson.trial_amount ? `¥${lesson.trial_amount}` : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 状态信息 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">状态信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">试听状态</p>
                  <p className="text-base font-medium mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lesson.status)}`}>
                      {getStatusText(lesson.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">紧急程度</p>
                  <p className="text-base font-medium mt-1">
                    {lesson.urgency_level && (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyBadge(lesson.urgency_level)}`}>
                        {getUrgencyText(lesson.urgency_level)}
                      </span>
                    )}
                    {!lesson.urgency_level && "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 业务信息 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">业务信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">分配顾问</p>
                  <p className="text-base font-medium">{lesson.assigned_consultant || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">课程状态</p>
                  <p className="text-base font-medium">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {lesson.course_status || "-"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">学生类型</p>
                  <p className="text-base font-medium">{lesson.student_type || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">匹配教师</p>
                  <p className="text-base font-medium">{lesson.matched_teacher || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 教务信息 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">教务信息</h3>
              <div>
                <p className="text-sm text-muted-foreground">确认教师</p>
                <p className="text-base font-medium">{lesson.confirmed_teacher || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* 备注信息 */}
          {lesson.notes && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">备注</h3>
                <p className="text-base whitespace-pre-wrap">{lesson.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* 付款凭证 */}
          {lesson.payment_proof && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">付款凭证</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground break-all">{lesson.payment_proof}</p>
                  {lesson.payment_proof.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                    <img
                      src={lesson.payment_proof}
                      alt="付款凭证"
                      className="max-w-sm h-auto border rounded"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 时间戳 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">系统信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">创建时间</p>
                  <p className="text-base font-medium">
                    {lesson.created_at ? format(new Date(lesson.created_at), 'yyyy-MM-dd HH:mm:ss') : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">更新时间</p>
                  <p className="text-base font-medium">
                    {lesson.updated_at ? format(new Date(lesson.updated_at), 'yyyy-MM-dd HH:mm:ss') : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
