"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/fetch"
import { cn } from "@/lib/utils"
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, MessageCircle, RefreshCw, UserRound } from "lucide-react"

type SessionStatus = "scheduled" | "completed" | "cancelled" | "missed" | "no-show" | string

interface CalendarSession {
  id: string
  course_id: string
  session_number?: number | null
  session_name?: string | null
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  scheduled_time_end?: string | null
  scheduled_duration_minutes?: number | null
  status?: SessionStatus | null
  teacher_name?: string | null
  student_attendance_status?: string | null
  course?: {
    id?: string
    course_name?: string | null
    subject?: string | null
    grade?: string | null
    student?: {
      id?: string
      student_name?: string | null
      student_code?: string | null
    } | null
  } | null
}

interface FollowUpVisit {
  id: string
  student_id: string
  student_name?: string | null
  student_code?: string | null
  visit_date: string
  visit_method: string
  parent_attitude?: string | null
  visit_personnel_name?: string | null
  next_visit_date?: string | null
  visit_notes?: string | null
}

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "scheduled", label: "未开始" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "missed", label: "缺课" },
  { value: "no-show", label: "未到课" },
]

const STATUS_META: Record<string, { label: string; className: string }> = {
  scheduled: { label: "未开始", className: "bg-blue-100 text-blue-800" },
  completed: { label: "已完成", className: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", className: "bg-slate-100 text-slate-700" },
  missed: { label: "缺课", className: "bg-amber-100 text-amber-800" },
  "no-show": { label: "未到课", className: "bg-red-100 text-red-800" },
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"]

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getMonthRange(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  return {
    startDate: formatDateKey(firstDay),
    endDate: formatDateKey(lastDay),
  }
}

function getCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - mondayOffset)

  const days: Date[] = []
  const totalDays = Math.ceil((mondayOffset + lastDay.getDate()) / 7) * 7
  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    days.push(date)
  }
  return days
}

function formatTimeRange(session: CalendarSession) {
  const start = (session.scheduled_time_start || "").slice(0, 5)
  const end = (session.scheduled_time_end || "").slice(0, 5)
  if (start && end) return `${start}-${end}`
  return start || end || "未定"
}

function getSessionTitle(session: CalendarSession) {
  return session.session_name || session.course?.course_name || `第 ${session.session_number || "-"} 节`
}

function getStatusMeta(status?: string | null) {
  return STATUS_META[status || "scheduled"] || { label: status || "未开始", className: "bg-muted text-muted-foreground" }
}

function buildVisitStudentName(visit: FollowUpVisit) {
  if (!visit.student_name) return "未知学生"
  return visit.student_code ? `${visit.student_name}（${visit.student_code}）` : visit.student_name
}

export default function CalendarPage() {
  const { toast } = useToast()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()))
  const [statusFilter, setStatusFilter] = useState("all")
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [followUpVisits, setFollowUpVisits] = useState<FollowUpVisit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const monthRange = useMemo(() => getMonthRange(currentMonth), [currentMonth])
  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth])
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>()
    sessions.forEach((session) => {
      if (!session.scheduled_date) return
      const list = map.get(session.scheduled_date) || []
      list.push(session)
      map.set(session.scheduled_date, list)
    })
    return map
  }, [sessions])
  const selectedSessions = sessionsByDate.get(selectedDate) || []
  const visitsByDate = useMemo(() => {
    const map = new Map<string, FollowUpVisit[]>()
    followUpVisits.forEach((visit) => {
      if (!visit.next_visit_date) return
      const list = map.get(visit.next_visit_date) || []
      list.push(visit)
      map.set(visit.next_visit_date, list)
    })
    return map
  }, [followUpVisits])
  const selectedFollowUps = visitsByDate.get(selectedDate) || []
  const todayKey = formatDateKey(new Date())

  const fetchCalendarData = async () => {
    try {
      setIsLoading(true)
      const sessionParams = new URLSearchParams({
        start_date: monthRange.startDate,
        end_date: monthRange.endDate,
      })
      if (statusFilter !== "all") {
        sessionParams.set("status", statusFilter)
      }
      const followUpParams = new URLSearchParams({
        mode: "follow_up_calendar",
        follow_up_from: monthRange.startDate,
        follow_up_to: monthRange.endDate,
      })

      const [sessionResponse, followUpResponse] = await Promise.all([
        api.get(`/api/class-sessions?${sessionParams.toString()}`),
        api.get(`/api/visit-records?${followUpParams.toString()}`),
      ])
      const sessionResult = await sessionResponse.json()
      const followUpResult = await followUpResponse.json()

      if (!sessionResponse.ok) {
        throw new Error(sessionResult.error || "加载课节失败")
      }
      if (!followUpResponse.ok) {
        throw new Error(followUpResult.error || "加载回访日历失败")
      }

      setSessions(sessionResult.data || [])
      setFollowUpVisits(followUpResult.data || [])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课程日历",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [monthRange.startDate, monthRange.endDate, statusFilter])

  const changeMonth = (offset: number) => {
    setCurrentMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + offset, 1)
      setSelectedDate(formatDateKey(new Date(next.getFullYear(), next.getMonth(), 1)))
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="课程与回访日历" description="按月查看可访问课节和下次回访提醒" />
      <div className="flex-1 space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="上个月">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 min-w-40 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium">
              {currentMonth.getFullYear()} 年 {currentMonth.getMonth() + 1} 月
            </div>
            <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="下个月">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const now = new Date()
                setCurrentMonth(now)
                setSelectedDate(formatDateKey(now))
              }}
            >
              本月
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchCalendarData} disabled={isLoading} aria-label="刷新">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                月日历
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 border-l border-t text-center text-xs font-medium text-muted-foreground">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="border-b border-r px-2 py-2">
                    周{day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l">
                {calendarDays.map((date) => {
                  const dateKey = formatDateKey(date)
                  const daySessions = sessionsByDate.get(dateKey) || []
                  const dayFollowUps = visitsByDate.get(dateKey) || []
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                  const isSelected = dateKey === selectedDate
                  const isToday = dateKey === todayKey

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={cn(
                        "min-h-28 border-b border-r bg-background p-2 text-left transition-colors hover:bg-muted/60",
                        !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                        isSelected && "bg-primary/5 ring-2 ring-inset ring-primary"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            isToday && "bg-primary text-primary-foreground"
                          )}
                        >
                          {date.getDate()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {daySessions.length > 0 ? `${daySessions.length} 节` : ""}
                          {daySessions.length > 0 && dayFollowUps.length > 0 ? " / " : ""}
                          {dayFollowUps.length > 0 ? `${dayFollowUps.length} 访` : ""}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {daySessions.slice(0, 2).map((session) => {
                          const statusMeta = getStatusMeta(session.status)
                          return (
                            <div key={session.id} className="truncate rounded border bg-card px-1.5 py-1 text-xs">
                              <span className="mr-1 text-muted-foreground">{formatTimeRange(session)}</span>
                              <span>{getSessionTitle(session)}</span>
                              <span className={cn("ml-1 rounded px-1", statusMeta.className)}>{statusMeta.label}</span>
                            </div>
                          )
                        })}
                        {dayFollowUps.slice(0, 2).map((visit) => (
                          <div key={visit.id} className="truncate rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-xs text-amber-900">
                            <MessageCircle className="mr-1 inline h-3 w-3" />
                            {buildVisitStudentName(visit)}
                          </div>
                        ))}
                        {daySessions.length + dayFollowUps.length > 4 && (
                          <div className="text-xs text-muted-foreground">+{daySessions.length + dayFollowUps.length - 4}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selectedDate} 课节与回访</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))
              ) : selectedSessions.length === 0 && selectedFollowUps.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  当天暂无课节或回访
                </div>
              ) : (
                <>
                  {selectedSessions.map((session) => {
                    const statusMeta = getStatusMeta(session.status)
                    return (
                      <div key={session.id} className="rounded-md border p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{getSessionTitle(session)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {session.course?.course_name || "未命名课程"}
                            </div>
                          </div>
                          <Badge className={cn("shrink-0", statusMeta.className)}>{statusMeta.label}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{formatTimeRange(session)}</span>
                            {session.scheduled_duration_minutes ? <span>{session.scheduled_duration_minutes} 分钟</span> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4" />
                            <span>{session.course?.student?.student_name || "未关联学生"}</span>
                            <span>{session.teacher_name || "未指定老师"}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/courses/${session.course_id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              课程详情
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {selectedFollowUps.map((visit) => (
                    <div key={visit.id} className="rounded-md border border-amber-200 bg-amber-50/70 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{buildVisitStudentName(visit)}</div>
                          <div className="mt-1 text-xs text-amber-900/80">
                            上次回访：{visit.visit_date || "-"}
                          </div>
                        </div>
                        <Badge className="shrink-0 bg-amber-100 text-amber-900">回访</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-amber-950/80">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          <span>下次回访提醒</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4" />
                          <span>{visit.visit_personnel_name || "未知回访人员"}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/students/${visit.student_id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            学生详情
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
