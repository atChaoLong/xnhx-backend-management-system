"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { WechatAccountsService, WechatAccount } from "@/lib/services/wechatAccounts"
import { useToast } from "@/hooks/use-toast"

export default function WechatAccountsPage() {
  const [accounts, setAccounts] = useState<WechatAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载微信号列表
  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await WechatAccountsService.getWechatAccounts()
      setAccounts(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载微信号列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // 删除微信号
  const handleDeleteClick = (id: string) => {
    setAccountToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return

    try {
      setIsDeleting(accountToDelete)
      await WechatAccountsService.deleteWechatAccount(accountToDelete)
      toast({
        title: "删除成功",
        description: "微信号已删除",
      })
      fetchAccounts()
      setDeleteDialogOpen(false)
      setAccountToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除微信号",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setAccountToDelete(null)
  }

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    return status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'
  }

  // 切换状态
  const handleToggleStatus = async (account: WechatAccount) => {
    try {
      await WechatAccountsService.updateWechatAccount({
        ...account,
        status: account.status === 'active' ? 'inactive' : 'active',
      })
      toast({
        title: "更新成功",
        description: `状态已${account.status === 'active' ? '停用' : '启用'}`,
      })
      fetchAccounts()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新状态",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="微信号管理" description="管理企业微信账号" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="微信号管理"
        description="管理企业微信账号"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">微信号列表</h3>
                <p className="text-sm text-muted-foreground">共 {accounts.length} 个微信号</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchAccounts} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/wechat-accounts/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增微信号
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>优先级</TableHead>
                    <TableHead>微信号</TableHead>
                    <TableHead>微信昵称</TableHead>
                    <TableHead>负责顾问</TableHead>
                    <TableHead>团队</TableHead>
                    <TableHead>账号类型</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>实名人</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增微信号"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.priority || "-"}</TableCell>
                        <TableCell>{account.wechat_id || "-"}</TableCell>
                        <TableCell>{account.wechat_name || "-"}</TableCell>
                        <TableCell>{account.responsible_consultant || "-"}</TableCell>
                        <TableCell>{account.team || "-"}</TableCell>
                        <TableCell>{account.account_type || "-"}</TableCell>
                        <TableCell>{account.phone || "-"}</TableCell>
                        <TableCell>{account.real_name_person || "-"}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(account)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${getStatusBadge(account.status)}`}
                          >
                            {account.status === 'active' ? '启用' : '停用'}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/wechat-accounts/${account.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(account.id)}
                              disabled={isDeleting === account.id}
                            >
                              {isDeleting === account.id ? (
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

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这个微信号吗？此操作无法撤销。
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
    </div>
  )
}
