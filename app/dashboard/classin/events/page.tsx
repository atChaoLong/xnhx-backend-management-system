"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Loader2, RefreshCw, Bell, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { api } from "@/lib/fetch"

interface ClassInEvent {
  id: string
  event_type: string
  cmd: string
  sid: number | null
  classin_uid: number | null
  course_id: number | null
  classroom_id: number | null
  activity_id: number | null
  session_id: string | null
  event_time: string | null
  payload: Record<string, any>
  created_at: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const CMD_LABELS: Record<string, string> = {
  Test: "测试",
  raiseHand: "举手",
  reward: "奖励",
  enterRoom: "进入教室",
  leaveRoom: "离开教室",
  auth: "授权",
  muteAll: "全体静音",
  mute: "静音",
  answer: "答题",
  grab: "抢答",
  onStage: "上讲台",
  networkStatus: "网络状态",
  deviceCheck: "设备检测",
  help: "求助",
  extendLesson: "延长课节",
  recordStart: "开始录课",
  blackboardImage: "黑板截图",
  liveLogin: "直播登录",
  liveBooking: "直播预约",
  liveView: "直播观看",
  liveLike: "直播点赞",
  liveProductClick: "直播商品点击",
  lessonSummary: "课后汇总",
  lessonEvaluation: "课后评价",
  lessonRecord: "录课文件",
  quizResult: "测验结果",
  webPlayback: "网页回放",
  clientPlayback: "客户端回放",
  fileConvert: "文件转换",
  accountCancel: "账号注销",
  changePhone: "手机号变更",
  subAccount: "子账号",
  End: "课堂结束",
}

export default function ClassInEventsPage() {
  const [events, setEvents] = useState<ClassInEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<ClassInEvent | null>(null)
  const { toast } = useToast()
  const { teachers, isLoading: isPermissionLoading } = usePermission()
  const canView = !isPermissionLoading && teachers.notes()

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
    onPageChange: (page, size) => fetchEvents(page, size),
  })

  const fetchEvents = useCallback(async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1

      const response = await api.get(`/api/classin/events?from=${from}&to=${to}`)

      if (!response.ok) {
        throw new Error("加载失败")
      }

      const result = await response.json()
      setEvents(result.data || [])
      setTotalCount(result.total || 0)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 回调事件",
      })
    } finally {
      setIsLoading(false)
    }
  }, [pageSize, toast])

  useEffect(() => {
    if (isPermissionLoading || !canView) return
    fetchEvents(1, pageSize)
  }, [isPermissionLoading, canView, fetchEvents, pageSize])

  const formatTime = (time: string | null) => {
    if (!time) return "-"
    return new Date(time).toLocaleString("zh-CN")
  }

  const getCmdLabel = (cmd: string) => {
    return CMD_LABELS[cmd] || cmd
  }

  const getCmdBadgeStyle = (cmd: string) => {
    if (cmd === "Test") return "bg-gray-100 text-gray-700"
    if (cmd === "End") return "bg-blue-100 text-blue-700"
    if (cmd === "enterRoom" || cmd === "leaveRoom") return "bg-green-100 text-green-700"
    if (cmd === "lessonSummary" || cmd === "lessonRecord" || cmd === "lessonEvaluation")
      return "bg-purple-100 text-purple-700"
    if (cmd === "raiseHand" || cmd === "reward" || cmd === "answer" || cmd === "grab")
      return "bg-yellow-100 text-yellow-700"
    return "bg-muted text-muted-foreground"
  }

  if (isPermissionLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 消息订阅" description="查看 ClassIn 回调事件记录" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 消息订阅" description="查看 ClassIn 回调事件记录" />
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              当前角色无权访问 ClassIn 回调事件。
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="ClassIn 消息订阅" description="查看 ClassIn 回调事件记录" />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  回调事件列表
                </h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => fetchEvents(currentPage, pageSize)}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
            </div>

            <ScrollableTable flex={false} maxHeight="60vh">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead className="w-28">消息类型</TableHead>
                    <TableHead className="w-24">事件类型</TableHead>
                    <TableHead>课堂ID</TableHead>
                    <TableHead>课程ID</TableHead>
                    <TableHead>用户UID</TableHead>
                    <TableHead>关联课节</TableHead>
                    <TableHead>接收时间</TableHead>
                    <TableHead className="w-20 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无回调事件
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((event, index) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {(currentPage - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={getCmdBadgeStyle(event.cmd)}>
                            {getCmdLabel(event.cmd)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.event_type}
                        </TableCell>
                        <TableCell className="text-sm">{event.classroom_id || "-"}</TableCell>
                        <TableCell className="text-sm">{event.course_id || "-"}</TableCell>
                        <TableCell className="text-sm">{event.classin_uid || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {event.session_id ? (
                            <span className="text-blue-600">{event.session_id.slice(0, 8)}...</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTime(event.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollableTable>

            {totalPages > 1 && (
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
                          disabled={!canGoPrevious}
                          className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                              disabled={false}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={goToNextPage}
                          disabled={!canGoNext}
                          className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
                <div className="w-auto"></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              回调事件详情 - {selectedEvent && getCmdLabel(selectedEvent.cmd)}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && `接收时间：${formatTime(selectedEvent.created_at)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">消息类型 (Cmd)：</span>
                  <span className="font-medium">{selectedEvent.cmd}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">事件类型：</span>
                  <span className="font-medium">{selectedEvent.event_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SID：</span>
                  <span className="font-medium">{selectedEvent.sid || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">用户 UID：</span>
                  <span className="font-medium">{selectedEvent.classin_uid || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">课堂 ID：</span>
                  <span className="font-medium">{selectedEvent.classroom_id || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">课程 ID：</span>
                  <span className="font-medium">{selectedEvent.course_id || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">活动 ID：</span>
                  <span className="font-medium">{selectedEvent.activity_id || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">关联课节：</span>
                  <span className="font-medium">{selectedEvent.session_id || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">事件时间：</span>
                  <span className="font-medium">{formatTime(selectedEvent.event_time)}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Payload</h4>
                <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-96">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
