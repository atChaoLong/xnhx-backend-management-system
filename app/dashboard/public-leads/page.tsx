"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2, RefreshCw, Target } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollableTable } from "@/components/ui/scrollable-table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationInfo,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPageSize,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { useDictionaryContext } from "@/contexts/DictionaryContext"
import { LeadsService, Lead } from "@/lib/services/leads"
import { api } from "@/lib/fetch"
import { usePagination } from "@/lib/hooks/usePagination"
import { usePermission } from "@/lib/hooks/usePermission"
import { useToast } from "@/hooks/use-toast"
import { summarizeError } from "@/lib/safe-error"

export default function PublicLeadsPage() {
  const { user } = usePermission()
  const { dicts } = useDictionaryContext()
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isGrabbing, setIsGrabbing] = useState<string | null>(null)

  const dictMaps = {
    grades: new Map((dicts?.grade || []).map((item: { code: string; label: string }) => [item.code, item.label])),
    subjects: new Map((dicts?.subject || []).map((item: { code: string; label: string }) => [item.code, item.label])),
    addMethods: new Map((dicts?.add_method || []).map((item: { code: string; label: string }) => [item.code, item.label])),
    regions: new Map((dicts?.province || []).map((item: { code: string; label: string }) => [item.code, item.label])),
    sources: new Map((dicts?.xhs_source || []).map((item: { code: string; label: string }) => [item.code, item.label])),
  }

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
  const canAccessPublicPool = user?.role === "sales" || user?.role === "admin"
  const canGrabPublicLead = user?.role === "sales"

  const fetchLeads = async (page: number = 1, size: number = pageSize) => {
    if (!canAccessPublicPool) return

    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await LeadsService.getLeads(from, to, { scope: "public" })
      setLeads(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载公共线索池",
      })
    } finally {
      setIsLoading(false)
    }
  }

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

  useEffect(() => {
    if (canAccessPublicPool) {
      fetchLeads(1, pageSize)
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  const handleGrabLead = async (lead: Lead) => {
    if (!canGrabPublicLead) {
      toast({
        variant: "destructive",
        title: "无法抢单",
        description: "当前角色只能查看公共线索池",
      })
      return
    }

    try {
      setIsGrabbing(lead.id)
      const response = await api.post("/api/leads/grab", { id: lead.id })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "抢单失败" }))
        throw new Error(error.error || "抢单失败")
      }

      toast({ title: "抢单成功", description: "该线索已分配给你" })
      fetchLeads(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "抢单失败",
        description: error.message || "无法抢单",
      })
    } finally {
      setIsGrabbing(null)
    }
  }

  const formatSubjects = (subjects?: string[]) => {
    if (!subjects || subjects.length === 0) return "-"
    return subjects.map(code => dictMaps.subjects.get(code) || code).join(", ")
  }

  const getLabel = (code: string | undefined, map: Map<string, string>) => {
    if (!code) return "-"
    return map.get(code) || code
  }

  const getStatusBadge = (status?: string) => {
    if (status === "unassigned") return <Badge variant="outline">公共池</Badge>
    if (status === "waiting_feedback") return <Badge variant="secondary">销售未反馈</Badge>
    if (status === "added") return <Badge className="bg-green-500">已添加</Badge>
    if (status === "not_added") return <Badge variant="destructive">未添加</Badge>
    return <Badge variant="outline">公共池</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="公共线索池" description="查看未分配线索并抢单" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!canAccessPublicPool) {
    return (
      <div className="flex flex-col h-full">
        <Header title="公共线索池" description="查看未分配线索并抢单" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              当前角色无权访问公共线索池。
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="公共线索池" description="查看未分配线索并抢单" />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">公共线索</h3>
                <PaginationInfo
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                />
              </div>
              <Button variant="outline" onClick={() => fetchLeads(currentPage, pageSize)} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
            </div>

            <ScrollableTable>
              <Table className="border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 bg-background w-[140px] min-w-[140px]">线索编号</TableHead>
                    <TableHead className="sticky left-[140px] z-30 bg-background w-[140px] min-w-[140px]">咨询学科</TableHead>
                    <TableHead>录单日期</TableHead>
                    <TableHead>渠道平台</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>地域</TableHead>
                    <TableHead>添加方式</TableHead>
                    <TableHead>添加状态</TableHead>
                    <TableHead>重复标记</TableHead>
                    <TableHead>创建人</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        暂无公共线索
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map(lead => {
                      const isDuplicate = Boolean(lead.duplicate_mark)
                      const stickyCellBg = isDuplicate ? "bg-sky-50" : "bg-background group-hover:bg-muted/50"

                      return (
                      <TableRow key={lead.id} className={isDuplicate ? "bg-sky-50 hover:bg-sky-100/70" : undefined}>
                        <TableCell className={`sticky left-0 z-20 ${stickyCellBg} font-medium w-[140px] min-w-[140px]`}>
                          {lead.report_number || "-"}
                        </TableCell>
                        <TableCell className={`sticky left-[140px] z-20 ${stickyCellBg} w-[140px] min-w-[140px]`}>
                          {formatSubjects(lead.subject_codes)}
                        </TableCell>
                        <TableCell>{lead.entry_date ? format(new Date(lead.entry_date), "yyyy-MM-dd") : "-"}</TableCell>
                        <TableCell>{lead.channel_platform || getLabel(lead.xhs_source, dictMaps.sources)}</TableCell>
                        <TableCell>{getLabel(lead.grade_code, dictMaps.grades)}</TableCell>
                        <TableCell>{getLabel(lead.region_ip, dictMaps.regions)}</TableCell>
                        <TableCell>{getLabel(lead.add_method_code, dictMaps.addMethods)}</TableCell>
                        <TableCell>{getStatusBadge(lead.add_status)}</TableCell>
                        <TableCell>
                          {isDuplicate ? (
                            <Badge className="bg-sky-500">疑似重复</Badge>
                          ) : (
                            <Badge variant="outline">-</Badge>
                          )}
                        </TableCell>
                        <TableCell>{lead.created_by || "-"}</TableCell>
                        <TableCell className="text-right">
                          {canGrabPublicLead ? (
                            <Button
                              size="sm"
                              onClick={() => handleGrabLead(lead)}
                              disabled={isGrabbing === lead.id}
                            >
                              {isGrabbing === lead.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  抢单中...
                                </>
                              ) : (
                                <>
                                  <Target className="mr-2 h-4 w-4" />
                                  抢单
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">仅查看</span>
                          )}
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
              <div className="w-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
