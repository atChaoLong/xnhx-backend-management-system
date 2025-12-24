"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Eye, Edit, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { LeadDialog } from "@/components/leads/lead-dialog"

export default function LeadsPage() {
  const { leads, deleteLead } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<string | null>(null)

  const handleEdit = (id: string) => {
    setEditingLead(id)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("确定要删除这条线索吗？")) {
      deleteLead(id)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingLead(null)
  }

  const formatSubjects = (subjects: string[]) => {
    if (!subjects || subjects.length === 0) return "-"
    return subjects.join(", ")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "contacted":
        return <Badge variant="default">已联系</Badge>
      case "converted":
        return <Badge className="bg-green-500">已转化</Badge>
      case "lost":
        return <Badge variant="destructive">已流失</Badge>
      default:
        return <Badge variant="secondary">待处理</Badge>
    }
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
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新增线索
              </Button>
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
                          {lead.entryDate ? format(new Date(lead.entryDate), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{lead.orderSerial || "-"}</TableCell>
                        <TableCell>{lead.sourceAccount || "-"}</TableCell>
                        <TableCell>{lead.grade || "-"}</TableCell>
                        <TableCell>{formatSubjects(lead.subjects)}</TableCell>
                        <TableCell>{lead.regionIp || "-"}</TableCell>
                        <TableCell>{lead.addMethodCode || "-"}</TableCell>
                        <TableCell>{lead.parentWechat || "-"}</TableCell>
                        <TableCell>{lead.grabWechat || "-"}</TableCell>
                        <TableCell>{getStatusBadge(lead.feedbackStatus)}</TableCell>
                        <TableCell>{lead.operatorName || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(lead.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(lead.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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

      <LeadDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        leadId={editingLead}
      />
    </div>
  )
}
