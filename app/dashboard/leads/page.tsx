"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, Video, MessageCircle, Bell, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LeadsService, Lead } from "@/lib/services/leads"
import { TodosService } from "@/lib/services/todos"
import { DictionaryService } from "@/lib/services/dictionary"
import { CHAT_SCREENSHOT_ACCEPT, uploadChatScreenshot, validateChatScreenshotFile } from "@/lib/services/upload"
import { api } from "@/lib/fetch"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/hooks/usePermission"
import { usePagination } from "@/lib/hooks/usePagination"

export default function LeadsPage() {
  const router = useRouter()
  const { leads: leadsPerm, user, isLoading: isUserLoading } = usePermission()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const { toast } = useToast()

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

  // 字典数据映射
  const [dictMaps, setDictMaps] = useState<{
    grades: Map<string, string>
    subjects: Map<string, string>
    addMethods: Map<string, string>
    regions: Map<string, string>
    sources: Map<string, string>
  }>({
    grades: new Map(),
    subjects: new Map(),
    addMethods: new Map(),
    regions: new Map(),
    sources: new Map(),
  })

  // 加载线索列表
  const fetchLeads = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const scope = user?.role === 'sales' ? 'owned' : undefined
      const { data, count } = await LeadsService.getLeads(from, to, { scope })
      setLeads(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载线索列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 分页 hook
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
    onPageChange: (page, size) => {
      fetchLeads(page, size)
    },
  })

  // 并行加载字典和线索列表
  useEffect(() => {
    if (isUserLoading) return
    let cancelled = false

    const loadAll = async () => {
      const scope = user?.role === 'sales' ? 'owned' : undefined
      const [dictResult, leadsResult] = await Promise.allSettled([
        DictionaryService.getAllDictionaries(),
        LeadsService.getLeads(0, pageSize - 1, { scope }),
      ])

      if (cancelled) return

      if (dictResult.status === 'fulfilled') {
        const dicts = dictResult.value
        setDictMaps({
          grades: new Map((dicts.grade || []).map(item => [item.code, item.label])),
          subjects: new Map((dicts.subject || []).map(item => [item.code, item.label])),
          addMethods: new Map((dicts.add_method || []).map(item => [item.code, item.label])),
          regions: new Map((dicts.province || []).map(item => [item.code, item.label])),
          sources: new Map((dicts.xhs_source || []).map(item => [item.code, item.label])),
        })
      }
      setIsLoadingDict(false)

      if (leadsResult.status === 'fulfilled') {
        setLeads(leadsResult.value.data)
        setTotalCount(leadsResult.value.count)
      }
      setIsLoading(false)
    }

    setIsLoading(true)
    loadAll()
    return () => { cancelled = true }
  }, [isUserLoading, user?.role])

  const canWriteLead = (lead: Lead) => {
    if (!user) return false
    if (user.role === 'admin') return true

    const meName = user.name || ''

    if (user.role === 'operator') {
      return lead.operator_id === user.id || lead.created_by === meName
    }

    if (user.role === 'sales') {
      return isLeadAssignedToCurrentUser(lead) ||
        lead.created_by === meName
    }

    if (user.role === 'head_teacher') {
      return lead.operator_id === user.id || lead.grab_user_id === user.id || lead.created_by === meName
    }

    return false
  }

  const normalizeLeadText = (value?: string | null) => value?.trim() || ''

  const isLeadAssignedToCurrentUser = (lead: Lead) => {
    if (!user) return false
    if (lead.grab_user_id && lead.grab_user_id === user.id) return true
    const grabWechat = normalizeLeadText(lead.grab_wechat)
    const userName = normalizeLeadText(user.name)
    return Boolean(grabWechat && userName && grabWechat === userName)
  }

  const getUrgeKey = (lead: Lead, target: 'sales' | 'operator') => `${lead.id}:${target}`

  // 删除线索
  const handleDeleteClick = (lead: Lead) => {
    if (!leadsPerm.delete() || !canWriteLead(lead)) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "当前角色无权删除该线索",
      })
      return
    }

    setLeadToDelete(lead.id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!leadToDelete) return
    const lead = leads.find((item) => item.id === leadToDelete)
    if (!lead || !leadsPerm.delete() || !canWriteLead(lead)) {
      toast({
        variant: "destructive",
        title: "无法删除",
        description: "当前角色无权删除该线索",
      })
      setDeleteDialogOpen(false)
      setLeadToDelete(null)
      return
    }

    try {
      setIsDeleting(leadToDelete)
      await LeadsService.deleteLead(leadToDelete)
      setLeads((prev) => prev.filter((l) => l.id !== leadToDelete))
      toast({
        title: "删除成功",
        description: "线索已删除",
      })
      setDeleteDialogOpen(false)
      setLeadToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除线索",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setLeadToDelete(null)
  }

  const openFeedbackDialog = (lead: Lead) => {
    setFeedbackLead(lead)
    setFeedbackStatus('')
    setFeedbackScreenshots(lead.chat_screenshots ? lead.chat_screenshots.split(',').filter(url => url.trim()) : [])
    setFeedbackDialogOpen(true)
  }

  const handleFeedbackScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      const validationError = files
        .map((file) => validateChatScreenshotFile(file))
        .find((message): message is string => Boolean(message))

      if (validationError) {
        e.target.value = ''
        toast({
          variant: "destructive",
          title: "文件不可用",
          description: validationError,
        })
        return
      }

      try {
        setIsUploadingFeedback(true)
        const uploadPromises = files.map(file => uploadChatScreenshot(file))
        const urls = await Promise.all(uploadPromises)

        setFeedbackScreenshots(prev => [...prev, ...urls])
        toast({
          title: "上传成功",
          description: `已上传 ${files.length} 张聊天截图`,
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "上传失败",
          description: error.message || "无法上传聊天截图",
        })
      } finally {
        setIsUploadingFeedback(false)
        // 清除文件选择
        e.target.value = ''
      }
    }
  }

  const handleRemoveFeedbackScreenshot = (index: number) => {
    setFeedbackScreenshots(prev => prev.filter((_, i) => i !== index))
  }

  const getScreenshots = (value?: string) => {
    if (!value) return []
    return value.split(',').map(url => url.trim()).filter(Boolean)
  }

  const openImagePreview = (images: string[], index = 0) => {
    setPreviewImages(images)
    setPreviewImageIndex(index)
    setImagePreviewOpen(true)
  }

  const showPreviousPreviewImage = () => {
    setPreviewImageIndex(index => Math.max(index - 1, 0))
  }

  const showNextPreviewImage = () => {
    setPreviewImageIndex(index => Math.min(index + 1, previewImages.length - 1))
  }

  const submitFeedback = async () => {
    if (!feedbackLead || !feedbackStatus) {
      toast({ variant: "destructive", title: "验证失败", description: "请选择反馈结果（已添加或未添加）" })
      return
    }
    try {
      const response = await api.post('/api/leads/feedback', {
        id: feedbackLead.id,
        add_status: feedbackStatus,
        chat_screenshots: feedbackScreenshots.length > 0 ? feedbackScreenshots.join(',') : undefined,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '反馈失败' }))
        throw new Error(error.error || '反馈失败')
      }
      const result = await response.json().catch(() => ({ data: null }))
      const updatedLead = result.data as Lead | null
      const fallbackScreenshots = feedbackScreenshots.length > 0 ? feedbackScreenshots.join(',') : undefined
      setLeads(prev => prev.map(l =>
        l.id === feedbackLead.id
          ? {
              ...l,
              ...(updatedLead || {}),
              add_status: updatedLead?.add_status || feedbackStatus,
              chat_screenshots: updatedLead?.chat_screenshots ?? fallbackScreenshots,
            }
          : l
      ))
      setFeedbackDialogOpen(false)
      setFeedbackLead(null)
      toast({ title: "反馈成功", description: `已标记为${feedbackStatus === 'added' ? '已添加' : '未添加'}` })
    } catch (error: any) {
      toast({ variant: "destructive", title: "反馈失败", description: error.message || "无法反馈线索" })
    }
  }

  const getLeadConversionStatus = (lead: Lead) => {
    const status = (lead as any).convert_status || lead.conversion_status || ''
    return typeof status === 'string' ? status.trim() : ''
  }

  const hasLeadConversion = (lead: Lead) => {
    const status = getLeadConversionStatus(lead)
    return Boolean(status) && status !== 'empty'
  }

  const canCreateTrialFromLead = (lead: Lead) => {
    if (!leadsPerm.convert() || lead.add_status !== 'added') return false
    if (hasLeadConversion(lead)) return false
    if (!user) return false

    return (
      isLeadAssignedToCurrentUser(lead) ||
      lead.operator_id === user.id ||
      (Boolean(lead.created_by) && Boolean(user.name) && lead.created_by === user.name)
    )
  }

  const isLeadHandledBySales = (lead: Lead) => {
    return lead.add_status === 'added' || lead.add_status === 'not_added' || hasLeadConversion(lead)
  }

  const isLeadAwaitingFeedback = (lead: Lead) => {
    return !isLeadHandledBySales(lead)
  }

  const canReleaseLead = (lead: Lead) => {
    return user?.role === 'sales' && isLeadAssignedToCurrentUser(lead) && !isLeadHandledBySales(lead)
  }

  // 创建试听课程
  const handleCreateTrialLesson = (lead: Lead) => {
    if (!canCreateTrialFromLead(lead)) {
      toast({
        variant: "destructive",
        title: "无法创建试听",
        description: "只能从自己负责的已添加线索创建试听",
      })
      return
    }

    // 跳转到试听新增页面，并传递线索ID
    router.push(`/dashboard/trial-lessons/new?lead_id=${lead.id}`)
  }

  const [isReleasing, setIsReleasing] = useState<string | null>(null)
  const [isUrging, setIsUrging] = useState<string | null>(null)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [feedbackLead, setFeedbackLead] = useState<Lead | null>(null)
  const [feedbackStatus, setFeedbackStatus] = useState<'added' | 'not_added' | ''>('')
  const [feedbackScreenshots, setFeedbackScreenshots] = useState<string[]>([])
  const [isUploadingFeedback, setIsUploadingFeedback] = useState(false)

  const handleReleaseLead = async (lead: Lead) => {
    if (!canReleaseLead(lead)) {
      toast({
        variant: 'destructive',
        title: '无法丢弃',
        description: '线索已处理，不能再丢弃',
      })
      return
    }

    try {
      setIsReleasing(lead.id)
      const resp = await api.post('/api/leads/release', { id: lead.id })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: '释放失败' }))
        throw new Error(err.error || '释放失败')
      }
      toast({ title: '释放成功', description: '线索已丢弃' })
      fetchLeads(currentPage, pageSize)
    } catch (error: any) {
      toast({ variant: 'destructive', title: '释放失败', description: error.message || '无法释放线索' })
    } finally {
      setIsReleasing(null)
    }
  }

  const handleUrgeLead = async (lead: Lead, target: 'sales' | 'operator') => {
    const reportNumber = lead.report_number || '未命名线索'
    const targetUserId = target === 'sales' ? lead.grab_user_id : lead.operator_id

    if (!targetUserId) {
      toast({
        variant: 'destructive',
        title: '无法催促',
        description: target === 'sales' ? '该线索未分配给销售人员' : '该线索未绑定负责运营',
      })
      return
    }

    try {
      setIsUrging(getUrgeKey(lead, target))

      // 创建待办事项
      await TodosService.createTodo({
        assigned_to: targetUserId,
        title: target === 'sales' ? `尽快反馈线索：${reportNumber}` : `协助处理线索：${reportNumber}`,
        description: target === 'sales'
          ? '该线索尚未反馈添加结果，请在自己的线索列表中查看并尽快处理。'
          : '销售已请求运营协助处理该线索，请在可访问线索范围内查看并跟进。',
        priority: 'high',
        entity_type: 'lead',
        entity_id: lead.id,
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // 明天这个时候
      })

      toast({
        title: '催促成功',
        description: target === 'sales' ? '已创建待办提醒销售人员' : '已创建待办提醒负责运营',
      })
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '催促失败',
        description: error.message || '无法创建催促待办',
      })
    } finally {
      setIsUrging(null)
    }
  }

  const formatSubjects = (subjects: string[]) => {
    if (!subjects || subjects.length === 0) return "-"
    // 将代码转换为标签
    const labels = subjects.map(code => dictMaps.subjects.get(code) || code)
    return labels.join(", ")
  }

  // 获取标签的辅助函数
  const getLabel = (code: string | undefined, map: Map<string, string>) => {
    if (!code) return "-"
    return map.get(code) || code
  }

  const getStatusBadge = (status: string) => {
    if (status === 'unassigned') {
      return <Badge variant="outline">运营未派单</Badge>
    }
    if (status === 'added') {
      return <Badge className="bg-green-500">已添加</Badge>
    }
    if (status === 'not_added') {
      return <Badge variant="destructive">未添加</Badge>
    }
    if (status === 'waiting_feedback') {
      return <Badge variant="secondary">销售未反馈</Badge>
    }
    return <Badge variant="secondary">未知</Badge>
  }

  const getConvertStatusBadge = (status: string) => {
    if (status === 'trial') {
      return <Badge className="bg-blue-500">试听</Badge>
    }
    if (status === 'formal') {
      return <Badge className="bg-purple-500">正式</Badge>
    }
    return <Badge variant="outline">-</Badge>
  }

  const leadPendingDelete = leadToDelete ? leads.find((item) => item.id === leadToDelete) : null
  const canDeletePendingLead = Boolean(leadPendingDelete && leadsPerm.delete() && canWriteLead(leadPendingDelete))

  if (isLoading || isUserLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="线索管理" description="管理和查看所有销售线索信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="线索管理"
        description="管理和查看所有销售线索信息"
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">线索列表</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchLeads(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
                {/* 运营：新增线索 */}
                {leadsPerm.create() && (
                  <Link href="/dashboard/leads/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      新增线索
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">报单序号</TableHead>
                    <TableHead className="sticky left-[140px] z-30 bg-background w-[140px] min-w-[140px]">咨询学科</TableHead>
                    <TableHead>录单日期</TableHead>
                    <TableHead>小红书账号来源</TableHead>
                    <TableHead>渠道平台</TableHead>
                    <TableHead>客户社媒账号 ID</TableHead>
                    <TableHead>重复标记</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>地域</TableHead>
                    <TableHead>添加方式</TableHead>
                    <TableHead>家长微信</TableHead>
                    <TableHead>聊天截图</TableHead>
                    <TableHead>抢单微信</TableHead>
                    <TableHead>添加状态</TableHead>
                    <TableHead>转化状态</TableHead>
                    <TableHead>运营人员</TableHead>
                    <TableHead>创建人</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={18} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击&quot;新增线索&quot;开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => {
                      const isDuplicate = Boolean(lead.duplicate_mark)
                      const stickyCellBg = isDuplicate ? "bg-sky-50" : "bg-background group-hover:bg-muted/50"
                      const screenshots = getScreenshots(lead.chat_screenshots)
                      const canEditThisLead = leadsPerm.edit() && canWriteLead(lead)
                      const canDeleteThisLead = leadsPerm.delete() && canWriteLead(lead)

                      return (
                      <TableRow key={lead.id} className={isDuplicate ? "bg-sky-50 hover:bg-sky-100/70" : undefined}>
                        <TableCell className={`sticky left-0 z-20 ${stickyCellBg} font-medium w-[140px] min-w-[140px]`}>{lead.report_number || "-"}</TableCell>
                        <TableCell className={`sticky left-[140px] z-20 ${stickyCellBg} w-[140px] min-w-[140px]`}>
                          {formatSubjects(lead.subject_codes)}
                        </TableCell>
                        <TableCell>
                          {lead.entry_date ? format(new Date(lead.entry_date), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell>{getLabel(lead.xhs_source, dictMaps.sources)}</TableCell>
                        <TableCell>{lead.channel_platform || "-"}</TableCell>
                        <TableCell>{lead.customer_social_id || "-"}</TableCell>
                        <TableCell>
                          {isDuplicate ? (
                            <Badge className="bg-sky-500">疑似重复</Badge>
                          ) : (
                            <Badge variant="outline">-</Badge>
                          )}
                        </TableCell>
                        <TableCell>{getLabel(lead.grade_code, dictMaps.grades)}</TableCell>
                        <TableCell>{getLabel(lead.region_ip, dictMaps.regions)}</TableCell>
                        <TableCell>{getLabel(lead.add_method_code, dictMaps.addMethods)}</TableCell>
                        <TableCell>{lead.parent_wechat || "-"}</TableCell>
                        <TableCell>
                          {screenshots.length > 0 ? (
                            <Button variant="outline" size="sm" onClick={() => openImagePreview(screenshots)}>
                              <Eye className="mr-2 h-4 w-4" />
                              {screenshots.length} 张
                            </Button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{lead.grab_wechat || "-"}</TableCell>
                        <TableCell>{getStatusBadge(lead.add_status || "")}</TableCell>
                        <TableCell>{getConvertStatusBadge((lead as any).convert_status || (lead as any).conversion_status || "")}</TableCell>
                        <TableCell>{lead.operator_name || lead.operator_id || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">创建</span>
                            <span className="text-sm">{lead.created_by || "-"}</span>
                            {lead.updated_by && lead.updated_by !== lead.created_by && (
                              <>
                                <span className="text-xs text-muted-foreground">更新</span>
                                <span className="text-sm">{lead.updated_by}</span>
                              </>
                            )}
                            {lead.collision_operator && (
                              <>
                                <span className="text-xs text-muted-foreground">重复来源</span>
                                <span className="text-sm">{lead.collision_operator}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* 运营/Admin 催促销售：线索已分配给销售且未添加时显示 */}
                            {(user?.role === 'operator' || user?.role === 'admin') &&
                             lead.grab_user_id &&
                             isLeadAwaitingFeedback(lead) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUrgeLead(lead, 'sales')}
                                disabled={isUrging === getUrgeKey(lead, 'sales')}
                                title="创建待办提醒销售尽快处理"
                                className="text-orange-600 border-orange-600 hover:bg-orange-50"
                              >
                                {isUrging === getUrgeKey(lead, 'sales') ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    催促中...
                                  </>
                                ) : (
                                  <>
                                    <Bell className="mr-2 h-4 w-4" />
                                    催促销售
                                  </>
                                )}
                              </Button>
                            )}
                            {/* 销售催促运营：仅自己负责的线索可提醒负责运营 */}
                            {user?.role === 'sales' &&
                              isLeadAssignedToCurrentUser(lead) &&
                              lead.operator_id &&
                              isLeadAwaitingFeedback(lead) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUrgeLead(lead, 'operator')}
                                disabled={isUrging === getUrgeKey(lead, 'operator')}
                                title="创建待办提醒负责运营协助处理"
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              >
                                {isUrging === getUrgeKey(lead, 'operator') ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    催促中...
                                  </>
                                ) : (
                                  <>
                                    <Bell className="mr-2 h-4 w-4" />
                                    催促运营
                                  </>
                                )}
                              </Button>
                            )}
                            {/* 销售释放：仅分配给自己时显示 */}
                            {canReleaseLead(lead) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReleaseLead(lead)}
                                disabled={isReleasing === lead.id}
                              >
                                {isReleasing === lead.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    丢弃中...
                                  </>
                                ) : (
                                  '丢弃'
                                )}
                              </Button>
                            )}
                            {/* 销售反馈按钮 - 只在未反馈时显示 */}
                            {/* 显示条件：有反馈权限 + 可编辑该线索 + 未反馈（add_status为空） */}
                            {leadsPerm.feedback() &&
                              canWriteLead(lead) &&
                              isLeadAwaitingFeedback(lead) && (
                              <Button
                                variant="outline"
                                size="sm"
                                title="标记为已反馈"
                                onClick={() => openFeedbackDialog(lead)}
                              >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                反馈
                              </Button>
                            )}
                            {/* 创建试听按钮 - 只在已添加状态下显示 */}
                            {canCreateTrialFromLead(lead) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleCreateTrialLesson(lead)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Video className="mr-2 h-4 w-4" />
                                试听
                              </Button>
                            )}
                            {/* 运营编辑按钮 - 只有运营和管理员可以看到 */}
                            {canEditThisLead && (
                              <Link href={`/dashboard/leads/${lead.id}/edit`}>
                                <Button variant="ghost" size="icon" title="编辑">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {/* 运营删除按钮 - 只有运营和管理员可以看到 */}
                            {canDeleteThisLead && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(lead)}
                                disabled={isDeleting === lead.id}
                                title="删除"
                              >
                                {isDeleting === lead.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollableTable>

            <div className="mt-6 flex items-center justify-between flex-shrink-0">
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
                        className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        disabled={!canGoPrevious}
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
                            className="cursor-pointer"
                            disabled={false}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={goToNextPage}
                        className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        disabled={!canGoNext}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
              <div className="w-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen && canDeletePendingLead}
        onOpenChange={(open) => !open && handleDeleteCancel()}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这条线索吗？此操作无法撤销。
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
      {/* 反馈对话框 */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>线索反馈</DialogTitle>
            <DialogDescription>请选择该线索的添加结果并上传相关截图</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>反馈结果</Label>
              <select
                value={feedbackStatus}
                onChange={(e) => setFeedbackStatus(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">请选择</option>
                <option value="added">已添加</option>
                <option value="not_added">未添加</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>聊天截图</Label>
              <Input
                type="file"
                accept={CHAT_SCREENSHOT_ACCEPT}
                multiple
                onChange={handleFeedbackScreenshotChange}
                disabled={isUploadingFeedback}
              />
              {isUploadingFeedback && (
                <p className="text-xs text-muted-foreground flex items-center">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  上传中...
                </p>
              )}
              {feedbackScreenshots.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">已上传 {feedbackScreenshots.length} 张截图</p>
                  <div className="grid grid-cols-3 gap-2">
                    {feedbackScreenshots.map((screenshot, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={screenshot}
                          alt={`聊天截图 ${index + 1}`}
                          className="w-full h-auto border rounded cursor-zoom-in"
                          onClick={() => openImagePreview(feedbackScreenshots, index)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFeedbackScreenshot(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>取消</Button>
            <Button onClick={submitFeedback}>提交反馈</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 图片预览对话框 */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>聊天截图</DialogTitle>
            <DialogDescription>
              {previewImages.length > 0 ? `${previewImageIndex + 1} / ${previewImages.length}` : "无图片"}
            </DialogDescription>
          </DialogHeader>
          {previewImages.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-[70vh] overflow-auto rounded border bg-muted/30">
                <img
                  src={previewImages[previewImageIndex]}
                  alt={`聊天截图 ${previewImageIndex + 1}`}
                  className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>
              {previewImages.length > 1 && (
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={showPreviousPreviewImage}
                    disabled={previewImageIndex === 0}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    上一张
                  </Button>
                  <Button
                    variant="outline"
                    onClick={showNextPreviewImage}
                    disabled={previewImageIndex >= previewImages.length - 1}
                  >
                    下一张
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
