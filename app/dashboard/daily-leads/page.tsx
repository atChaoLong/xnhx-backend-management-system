"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { DailyLeadsService, DailyLead } from "@/lib/services/dailyLeads"
import { useToast } from "@/hooks/use-toast"

export default function DailyLeadsPage() {
  const [leads, setLeads] = useState<DailyLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载线索列表
  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await DailyLeadsService.getDailyLeads()
      setLeads(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载每日线索列表",
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
    if (!confirm("确定要删除这个线索吗？")) return

    try {
      setIsDeleting(id)
      await DailyLeadsService.deleteDailyLead(id)
      toast({
        title: "删除成功",
        description: "线索已删除",
      })
      fetchLeads()
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

  // 切换"是否添加"状态
  const handleToggleAdded = async (lead: DailyLead) => {
    try {
      await DailyLeadsService.updateDailyLead({
        ...lead,
        is_added: !lead.is_added,
      })
      toast({
        title: "更新成功",
        description: `已${lead.is_added ? '标记为未添加' : '标记为已添加'}`,
      })
      fetchLeads()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新线索",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="每日线索" description="管理每日招聘线索" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="每日线索"
        description="管理每日招聘线索"
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
                <Link href="/dashboard/daily-leads/new">
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
                    <TableHead>姓名</TableHead>
                    <TableHead>微信号</TableHead>
                    <TableHead>归属人员</TableHead>
                    <TableHead>领取日期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增线索"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                        <TableCell>{lead.wechat_number || "-"}</TableCell>
                        <TableCell>{lead.assigned_person || "-"}</TableCell>
                        <TableCell>
                          {lead.received_date ? format(new Date(lead.received_date), 'yyyy-MM-dd') : "-"}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleAdded(lead)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                              lead.is_added
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {lead.is_added ? '已添加' : '未添加'}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {lead.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/daily-leads/${lead.id}/edit`}>
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
