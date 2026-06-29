"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Sparkles, Filter } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import { DictionaryService, type DictionaryItem } from "@/lib/services/dictionary"
import { TeachersService, type ClassInTeacherOption } from "@/lib/services/teachers"
import { TrialLessonsService, type TrialLesson } from "@/lib/services/trialLessons"

const LESSON_FETCH_LIMIT = 100

type DictionaryOptions = {
  grades: DictionaryItem[]
  subjects: DictionaryItem[]
  regions: DictionaryItem[]
}

type TeacherSelectOption = ClassInTeacherOption & {
  name: string
  label: string
}

type TeacherRecommendation = {
  teacher: ClassInTeacherOption
  score: number
  reasons: string[]
}

function isPendingMatchLesson(lesson: TrialLesson) {
  const lessonStatus = (lesson.lesson_status || "").trim()
  const baseStatus = (lesson.status || "").trim()

  if (lessonStatus === "waiting_match") {
    return true
  }

  if (lesson.matched_teacher?.trim()) {
    return false
  }

  if (["cancelled", "waiting_confirm", "waiting_time", "waiting_link", "scheduled", "waiting_feedback", "completed"].includes(lessonStatus)) {
    return false
  }

  return baseStatus !== "cancelled" && baseStatus !== "completed"
}

function formatDateTime(value?: string) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return format(date, "yyyy-MM-dd HH:mm")
}

function getLessonStatusBadge(status?: string) {
  const statusMap: Record<string, string> = {
    waiting_match: "bg-yellow-100 text-yellow-800",
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
  }

  return statusMap[status || ""] || "bg-gray-100 text-gray-800"
}

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase()
}

function normalizeList(values?: string[] | null) {
  return (values || []).map(normalizeText).filter(Boolean)
}

function getDictionaryLabel(code: string | undefined, items: DictionaryItem[]) {
  if (!code) return ""
  return items.find((item) => item.code === code)?.label || code
}

function listMatchesText(values: string[] | undefined, targets: string[]) {
  const normalizedValues = normalizeList(values)
  const normalizedTargets = targets.map(normalizeText).filter(Boolean)

  return normalizedValues.some((value) =>
    normalizedTargets.some((target) => value === target || value.includes(target) || target.includes(value))
  )
}

function getGradeSegments(gradeCode?: string, gradeLabel?: string) {
  const text = normalizeText(`${gradeCode || ""} ${gradeLabel || ""}`)
  const segments: string[] = []

  if (/小学|一年级|二年级|三年级|四年级|五年级|六年级|grade\s*[1-6]|g[1-6]/i.test(text)) {
    segments.push("小学")
  }
  if (/初中|初一|初二|初三|七年级|八年级|九年级|grade\s*[7-9]|g[7-9]/i.test(text)) {
    segments.push("初中")
  }
  if (/高中|高一|高二|高三|十年级|十一年级|十二年级|grade\s*(10|11|12)|g(10|11|12)/i.test(text)) {
    segments.push("高中")
  }

  return segments.length > 0 ? segments : [gradeCode, gradeLabel].filter(Boolean) as string[]
}

function getTrialTimeTokens(value?: string) {
  if (!value) return []

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return [value]

  const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  const weekday = weekdayLabels[date.getDay()]
  const hour = date.getHours()
  const period = hour < 12 ? "上午" : hour < 18 ? "下午" : "晚上"
  const dayType = date.getDay() === 0 || date.getDay() === 6 ? "周末" : "工作日"

  return [weekday, period, `${weekday}${period}`, dayType, `${hour}点`, `${String(hour).padStart(2, "0")}:00`]
}

function scoreTeacherForLesson(
  lesson: TrialLesson,
  teacher: ClassInTeacherOption,
  dictOptions: DictionaryOptions
): TeacherRecommendation {
  let score = 0
  const reasons: string[] = []
  const subjectLabel = getDictionaryLabel(lesson.trial_subject, dictOptions.subjects)
  const gradeLabel = getDictionaryLabel(lesson.grade, dictOptions.grades)
  const regionLabel = getDictionaryLabel(lesson.region, dictOptions.regions)
  const teacherSubjectText = normalizeText(`${teacher.teacher_subject || ""} ${(teacher.subjects || []).join(" ")}`)

  if (listMatchesText(teacher.subjects, [lesson.trial_subject || "", subjectLabel]) || (subjectLabel && teacherSubjectText.includes(normalizeText(subjectLabel)))) {
    score += 45
    reasons.push("学科匹配")
  }

  const gradeSegments = getGradeSegments(lesson.grade, gradeLabel)
  if (listMatchesText(teacher.grade_levels, gradeSegments)) {
    score += 30
    reasons.push("年级匹配")
  }

  if (listMatchesText(teacher.student_regions, [lesson.region || "", regionLabel])) {
    score += 10
    reasons.push("地域经验")
  }

  if (listMatchesText(teacher.available_times, getTrialTimeTokens(lesson.trial_time))) {
    score += 10
    reasons.push("时间接近")
  }

  const status = normalizeText(teacher.status)
  if (status && !/停用|暂停|离职|inactive|disabled|blocked/.test(status)) {
    score += 5
    reasons.push("状态可用")
  } else if (/停用|暂停|离职|inactive|disabled|blocked/.test(status)) {
    score -= 25
  }

  if (typeof teacher.total_hours === "number" && teacher.total_hours >= 0 && teacher.total_hours <= 20) {
    score += 3
    reasons.push("负载较轻")
  }

  return { teacher, score, reasons }
}

export default function PendingTrialsPage() {
  const { toast } = useToast()
  const { role, isLoading: isPermissionLoading, trialLessons: trialLessonsPerm } = usePermission()
  const canMatchTeacher = !isPermissionLoading && (role === "admin" || trialLessonsPerm.matchTeacher())
  const canConfirmTeacher = !isPermissionLoading && (role === "admin" || trialLessonsPerm.confirmTeacher())
  const [lessons, setLessons] = useState<TrialLesson[]>([])
  const [teachers, setTeachers] = useState<ClassInTeacherOption[]>([])
  const [dictOptions, setDictOptions] = useState<DictionaryOptions>({
    grades: [],
    subjects: [],
    regions: [],
  })
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Record<string, string>>({})
  const [isLoadingLessons, setIsLoadingLessons] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [isLoadingDict, setIsLoadingDict] = useState(false)
  const [matchingLessonId, setMatchingLessonId] = useState<string | null>(null)
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set())
  const [isBatchMatching, setIsBatchMatching] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [dateFilter, setDateFilter] = useState<string>("")

  const pendingLessons = useMemo(() => {
    let filtered = lessons.filter(isPendingMatchLesson)
    if (dateFilter) {
      const filterDate = dateFilter
      filtered = filtered.filter((lesson) => {
        if (!lesson.trial_time) return false
        const lessonDate = new Date(lesson.trial_time).toISOString().split('T')[0]
        return lessonDate === filterDate
      })
    }
    return filtered
  }, [lessons, dateFilter])
  const selectedPendingLessons = useMemo(
    () => pendingLessons.filter((lesson) => selectedLessonIds.has(lesson.id)),
    [pendingLessons, selectedLessonIds]
  )
  const selectedReadyCount = selectedPendingLessons.filter((lesson) => selectedTeacherIds[lesson.id]).length
  const allVisibleSelected = pendingLessons.length > 0 && pendingLessons.every((lesson) => selectedLessonIds.has(lesson.id))

  const teacherOptions = useMemo<TeacherSelectOption[]>(() => {
    return teachers.map((teacher) => ({
      ...teacher,
      name: teacher.teacher_name,
      label: teacher.teacher_subject
        ? `${teacher.teacher_name} / ${teacher.teacher_subject}`
        : teacher.teacher_name,
    }))
  }, [teachers])

  const recommendationsByLessonId = useMemo<Record<string, TeacherRecommendation[]>>(() => {
    return pendingLessons.reduce<Record<string, TeacherRecommendation[]>>((acc, lesson) => {
      acc[lesson.id] = teachers
        .map((teacher) => scoreTeacherForLesson(lesson, teacher, dictOptions))
        .filter((recommendation) => recommendation.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      return acc
    }, {})
  }, [dictOptions, pendingLessons, teachers])

  const recommendedReadyCount = pendingLessons.filter((lesson) => {
    const selectedTeacherId = selectedTeacherIds[lesson.id]
    return selectedTeacherId && recommendationsByLessonId[lesson.id]?.some((recommendation) => recommendation.teacher.id === selectedTeacherId)
  }).length

  const getLabelByCode = (code: string | undefined, category: keyof DictionaryOptions) => {
    if (!code) return "-"
    return dictOptions[category].find((item) => item.code === code)?.label || code
  }

  const loadLessons = async () => {
    try {
      setIsLoadingLessons(true)
      const { data, count } = await TrialLessonsService.getTrialLessons(0, LESSON_FETCH_LIMIT - 1)
      setLessons(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载待试听记录",
      })
    } finally {
      setIsLoadingLessons(false)
    }
  }

  useEffect(() => {
    if (!canMatchTeacher) return

    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getAllDictionaries()
        setDictOptions({
          grades: dicts.grade || [],
          subjects: dicts.subject || [],
          regions: dicts.province || [],
        })
      } catch {
        toast({
          variant: "destructive",
          title: "加载字典失败",
          description: "无法加载试听课程字典",
        })
      } finally {
        setIsLoadingDict(false)
      }
    }

    const loadTeachers = async () => {
      try {
        setIsLoadingTeachers(true)
        const data = await TeachersService.getClassInTeachers()
        setTeachers(data || [])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载教师失败",
          description: error.message || "无法加载 ClassIn 老师列表",
        })
      } finally {
        setIsLoadingTeachers(false)
      }
    }

    loadDictionaries()
    loadTeachers()
    loadLessons()
  }, [canMatchTeacher])

  useEffect(() => {
    setSelectedLessonIds((prev) => {
      const pendingIds = new Set(pendingLessons.map((lesson) => lesson.id))
      const next = new Set([...prev].filter((lessonId) => pendingIds.has(lessonId)))
      return next.size === prev.size ? prev : next
    })
  }, [pendingLessons])

  useEffect(() => {
    setSelectedTeacherIds((prev) => {
      const next = { ...prev }
      let changed = false

      pendingLessons.forEach((lesson) => {
        if (next[lesson.id]) return

        const topRecommendation = recommendationsByLessonId[lesson.id]?.[0]
        if (topRecommendation) {
          next[lesson.id] = topRecommendation.teacher.id
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [pendingLessons, recommendationsByLessonId])

  const handleTeacherChange = (lessonId: string, teacherId: string) => {
    setSelectedTeacherIds((prev) => ({
      ...prev,
      [lessonId]: teacherId,
    }))
  }

  const handleLessonSelectionChange = (lessonId: string, checked: boolean) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(lessonId)
      } else {
        next.delete(lessonId)
      }
      return next
    })
  }

  const handleSelectAllChange = (checked: boolean) => {
    setSelectedLessonIds(checked ? new Set(pendingLessons.map((lesson) => lesson.id)) : new Set())
  }

  const handleApplyRecommendations = () => {
    let appliedCount = 0

    setSelectedTeacherIds((prev) => {
      const next = { ...prev }

      pendingLessons.forEach((lesson) => {
        const topRecommendation = recommendationsByLessonId[lesson.id]?.[0]
        if (!topRecommendation) return

        if (next[lesson.id] !== topRecommendation.teacher.id) {
          next[lesson.id] = topRecommendation.teacher.id
          appliedCount += 1
        }
      })

      return next
    })

    toast({
      title: "已应用推荐",
      description: appliedCount > 0 ? `已更新 ${appliedCount} 条试听的推荐老师` : "当前待匹配试听已使用推荐老师",
    })
  }

  const handleMatchTeacher = async (lesson: TrialLesson) => {
    const selectedTeacherId = selectedTeacherIds[lesson.id]
    const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId)

    if (!selectedTeacher) {
      toast({
        variant: "destructive",
        title: "请选择老师",
        description: "需要先选择一个可用的 ClassIn 老师",
      })
      return
    }

    try {
      setMatchingLessonId(lesson.id)
      await TrialLessonsService.updateTrialLesson({
        id: lesson.id,
        matched_teacher: selectedTeacher.teacher_name,
      })
      toast({
        title: "匹配成功",
        description: `已匹配老师：${selectedTeacher.teacher_name}`,
      })
      setSelectedTeacherIds((prev) => {
        const next = { ...prev }
        delete next[lesson.id]
        return next
      })
      setSelectedLessonIds((prev) => {
        const next = new Set(prev)
        next.delete(lesson.id)
        return next
      })
      await loadLessons()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "匹配失败",
        description: error.message || "无法匹配老师",
      })
    } finally {
      setMatchingLessonId(null)
    }
  }

  const handleBatchMatch = async () => {
    if (selectedPendingLessons.length === 0) {
      toast({
        variant: "destructive",
        title: "请选择试听",
        description: "需要先勾选待匹配的试听课程",
      })
      return
    }

    const missingTeacherCount = selectedPendingLessons.length - selectedReadyCount
    if (missingTeacherCount > 0) {
      toast({
        variant: "destructive",
        title: "老师未选完",
        description: `还有 ${missingTeacherCount} 条试听未选择老师`,
      })
      return
    }

    const updates = selectedPendingLessons.map((lesson) => {
      const teacher = teachers.find((item) => item.id === selectedTeacherIds[lesson.id])
      return { lesson, teacher }
    })
    const missingAvailableTeacherCount = updates.filter(({ teacher }) => !teacher).length

    if (missingAvailableTeacherCount > 0) {
      toast({
        variant: "destructive",
        title: "老师不可用",
        description: `有 ${missingAvailableTeacherCount} 条试听选择的老师已不在当前目录中`,
      })
      return
    }

    try {
      setIsBatchMatching(true)
      const results = await Promise.allSettled(
        updates.map(({ lesson, teacher }) =>
          TrialLessonsService.updateTrialLesson({
            id: lesson.id,
            matched_teacher: teacher!.teacher_name,
          })
        )
      )
      const successCount = results.filter((result) => result.status === "fulfilled").length
      const failureCount = results.length - successCount

      if (failureCount > 0) {
        toast({
          variant: "destructive",
          title: "批量匹配部分失败",
          description: `成功 ${successCount} 条，失败 ${failureCount} 条`,
        })
      } else {
        toast({
          title: "批量匹配成功",
          description: `已匹配 ${successCount} 条试听课程`,
        })
      }

      setSelectedTeacherIds((prev) => {
        const next = { ...prev }
        updates.forEach(({ lesson }, index) => {
          if (results[index].status === "fulfilled") {
            delete next[lesson.id]
          }
        })
        return next
      })
      setSelectedLessonIds((prev) => {
        const next = new Set(prev)
        updates.forEach(({ lesson }, index) => {
          if (results[index].status === "fulfilled") {
            next.delete(lesson.id)
          }
        })
        return next
      })
      await loadLessons()
    } finally {
      setIsBatchMatching(false)
    }
  }

  const isLoading = isPermissionLoading || isLoadingLessons || isLoadingTeachers || isLoadingDict

  if (isPermissionLoading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="待试听匹配" description="教务试听老师匹配工作台" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!canMatchTeacher) {
    return (
      <div className="flex h-full flex-col">
        <Header title="待试听匹配" description="教务试听老师匹配工作台" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>当前账号无试听老师匹配权限。</span>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="待试听匹配" description="教务试听老师匹配工作台" />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs text-muted-foreground">待匹配</div>
              <div className="mt-1 text-2xl font-semibold">{pendingLessons.length}</div>
            </div>
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs text-muted-foreground">ClassIn 老师</div>
              <div className="mt-1 text-2xl font-semibold">{teachers.length}</div>
            </div>
            <div className="rounded-md border px-4 py-3">
              <div className="text-xs text-muted-foreground">已载入试听</div>
              <div className="mt-1 text-2xl font-semibold">{Math.min(totalCount, LESSON_FETCH_LIMIT)}</div>
            </div>
          </div>

          <Button variant="outline" onClick={loadLessons} disabled={isLoadingLessons}>
            {isLoadingLessons ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            刷新
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-md border px-4 py-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm text-muted-foreground whitespace-nowrap">按试听时间筛选</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm"
          />
          {dateFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateFilter("")}
              className="h-7 px-2 text-xs"
            >
              清除
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            已选择 {selectedPendingLessons.length} 条，可提交 {selectedReadyCount} 条，推荐已填 {recommendedReadyCount} 条
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleApplyRecommendations}
              disabled={isLoading || pendingLessons.length === 0}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              应用推荐
            </Button>
            <Button
              onClick={handleBatchMatch}
              disabled={isBatchMatching || selectedPendingLessons.length === 0 || selectedReadyCount !== selectedPendingLessons.length}
            >
              {isBatchMatching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              批量匹配
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingLessons.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                暂无待匹配老师的试听课程
              </div>
            ) : (
              <ScrollableTable flex={false} maxHeight="calc(100vh - 300px)" className="rounded-none border-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px]">
                        <Checkbox
                          aria-label="选择全部待匹配试听"
                          checked={allVisibleSelected ? true : selectedPendingLessons.length > 0 ? "indeterminate" : false}
                          onCheckedChange={(checked) => handleSelectAllChange(checked === true)}
                        />
                      </TableHead>
                      <TableHead className="w-[120px]">线索编号</TableHead>
                      <TableHead className="w-[120px]">学生称呼</TableHead>
                      <TableHead className="w-[110px]">年级</TableHead>
                      <TableHead className="w-[120px]">学科</TableHead>
                      <TableHead className="w-[120px]">地域</TableHead>
                      <TableHead className="w-[150px]">试听时间</TableHead>
                      <TableHead className="w-[140px]">联系方式</TableHead>
                      <TableHead className="w-[140px]">渠道</TableHead>
                      <TableHead className="w-[120px]">状态</TableHead>
                      <TableHead className="w-[260px]">智能推荐</TableHead>
                      <TableHead className="w-[260px]">匹配老师</TableHead>
                      <TableHead className="w-[220px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLessons.map((lesson) => {
                      const recommendations = recommendationsByLessonId[lesson.id] || []
                      const topRecommendation = recommendations[0]

                      return (
                      <TableRow key={lesson.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={`选择 ${lesson.child_name || "试听课程"}`}
                            checked={selectedLessonIds.has(lesson.id)}
                            onCheckedChange={(checked) => handleLessonSelectionChange(lesson.id, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{lesson.lead?.report_number || "-"}</TableCell>
                        <TableCell>{lesson.child_name || "-"}</TableCell>
                        <TableCell>{getLabelByCode(lesson.grade, "grades")}</TableCell>
                        <TableCell>{getLabelByCode(lesson.trial_subject, "subjects")}</TableCell>
                        <TableCell>{getLabelByCode(lesson.region, "regions")}</TableCell>
                        <TableCell>{formatDateTime(lesson.trial_time)}</TableCell>
                        <TableCell>{lesson.phone || "-"}</TableCell>
                        <TableCell>{lesson.channel || "-"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getLessonStatusBadge(lesson.lesson_status || lesson.status)}`}>
                            {lesson.lesson_status_name || "待匹配老师"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {topRecommendation ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{topRecommendation.teacher.teacher_name}</span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  {topRecommendation.score}
                                </span>
                              </div>
                              <div className="line-clamp-2 text-xs text-muted-foreground">
                                {topRecommendation.reasons.join("、") || "画像相近"}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {recommendations.map((recommendation) => (
                                  <Button
                                    key={recommendation.teacher.id}
                                    type="button"
                                    size="sm"
                                    variant={selectedTeacherIds[lesson.id] === recommendation.teacher.id ? "default" : "outline"}
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleTeacherChange(lesson.id, recommendation.teacher.id)}
                                  >
                                    {recommendation.teacher.teacher_name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无推荐</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SearchableSelect
                            id={`teacher-${lesson.id}`}
                            label="老师"
                            value={selectedTeacherIds[lesson.id] || ""}
                            onChange={(teacherId) => handleTeacherChange(lesson.id, teacherId)}
                            options={teacherOptions}
                            loading={isLoadingTeachers}
                            placeholder="搜索老师"
                            displayKey="label"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMatchTeacher(lesson)}
                              disabled={isBatchMatching || matchingLessonId === lesson.id || !selectedTeacherIds[lesson.id]}
                            >
                              {matchingLessonId === lesson.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  匹配
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollableTable>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
