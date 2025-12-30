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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, Shield } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { UsersService, UserProfile, ROLES } from "@/lib/services/users"
import { useToast } from "@/hooks/use-toast"

// 角色名称映射
const getRoleName = (roleCode: string): string => {
  const role = Object.values(ROLES).find(r => r.code === roleCode)
  return role?.name || roleCode || "-"
}

export default function AccountsPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null)
  const { toast } = useToast()

  // 加载用户列表
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await UsersService.getUsers()
      setUsers(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载用户列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // 删除用户
  const handleDeleteClick = (user: UserProfile) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return

    try {
      setIsDeleting(userToDelete.id)
      await UsersService.deleteUser(userToDelete.id)
      toast({
        title: "删除成功",
        description: "用户已删除",
      })
      fetchUsers()
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除用户",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="账号管理" description="管理系统用户和角色权限" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="账号管理"
        description="管理系统用户和角色权限"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">用户列表</h3>
                <p className="text-sm text-muted-foreground">共 {users.length} 个用户</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/accounts/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增用户
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户ID</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>团队</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增用户"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-xs">
                          {user.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.avatar_url && (
                              <img
                                src={user.avatar_url}
                                alt={user.name || '用户'}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            {user.name || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {user.email || "-"}
                        </TableCell>
                        <TableCell>{user.phone || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5 text-primary" />
                            {getRoleName(user.role)}
                          </div>
                        </TableCell>
                        <TableCell>{user.team_name || "-"}</TableCell>
                        <TableCell>
                          {user.is_active ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              启用
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              停用
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.created_at ? format(new Date(user.created_at), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/accounts/${user.id}/edit`}>
                              <Button variant="ghost" size="icon" title="编辑">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(user)}
                              disabled={isDeleting === user.id}
                              title="删除"
                            >
                              {isDeleting === user.id ? (
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
              确定要删除用户 <span className="font-semibold">{userToDelete?.name || '未知'}</span> 吗？
              此操作将同时删除该用户的登录信息和相关数据，无法撤销。
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
