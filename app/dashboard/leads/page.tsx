"use client"

import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { LeadsService, Lead } from "@/lib/services/leads"
import { useToast } from "@/hooks/use-toast"

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载线索列表
  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await LeadsService.getLeads()
      setLeads(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载线索列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // 删除线索
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条线索吗？")) return

    try {
      setIsDeleting(id)
      await LeadsService.deleteLead(id)
      setLeads((prev) => prev.filter((l) => l.id !== id))
      toast({
        title: "删除成功",
        description: "线索已删除",
      })
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

  const formatSubjects = (subjects: string[]) => {
    if (!subjects || subjects.length === 0) return "-"
    return subjects.join(", ")
  }

  const getStatusBadge = (status: string) => {
    if (status === 'added' || status === '已添加') {
      return <Badge className="bg-green-500">已添加</Badge>
    }
    if (status === 'not_added' || status === '未添加') {
      return <Badge variant="destructive">未添加</Badge>
    }
    return <Badge variant="secondary">未反馈</Badge>
  }

  if (isLoading) {
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
    <div className="flex flex-col h-full">
      <Header
        title="线索管理"
        description="管理和查看所有销售线索信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">线索列表</h3>
                <p className="text-sm text-muted-foreground">共 {leads.length} 条线索</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchLeads} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/leads/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增线索
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>录入日期</TableHead>
                    <TableHead>报单序号</TableHead>
                    <TableHead>来源账号</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>咨询学科</TableHead>
                    <TableHead>地域</TableHead>
                    <TableHead>添加方式</TableHead>
                    <TableHead>家长微信</TableHead>
                    <TableHead>抢单微信</TableHead>
                    <TableHead>反馈状态</TableHead>
                    <TableHead>运营人员</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增线索"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          {lead.entry_date ? format(new Date(lead.entry_date), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{lead.report_number || "-"}</TableCell>
                        <TableCell>{lead.xhs_source || "-"}</TableCell>
                        <TableCell>{lead.grade_code || "-"}</TableCell>
                        <TableCell>{formatSubjects(lead.subject_codes)}</TableCell>
                        <TableCell>{lead.region_ip || "-"}</TableCell>
                        <TableCell>{lead.add_method_code || "-"}</TableCell>
                        <TableCell>{lead.parent_wechat || "-"}</TableCell>
                        <TableCell>{lead.grab_wechat || "-"}</TableCell>
                        <TableCell>{getStatusBadge(lead.add_status || "")}</TableCell>
                        <TableCell>{lead.operator_id || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/leads/${lead.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(lead.id)}
                              disabled={isDeleting === lead.id}
                            >
                              {isDeleting === lead.id ? (
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
    </div>
  )
}
