"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { UsersService, UserProfile, UserRole } from "@/lib/services/users"
import { useToast } from "@/hooks/use-toast"

export default function EditAccountPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    role_id: "",
    organization: "",
    position: "",
    notes: "",
    is_active: true,
  })

  // 加载用户信息
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoadingUser(true)
        const data = await UsersService.getUserById(userId)
        setUser(data)

        // 填充表单
        setFormData({
          full_name: data.full_name || "",
          phone: data.phone || "",
          role_id: data.role_id || "",
          organization: data.organization || "",
          position: data.position || "",
          notes: data.notes || "",
          is_active: data.is_active,
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载用户信息",
        })
        router.push("/dashboard/accounts")
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUser()
  }, [userId])

  // 加载角色列表
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setIsLoadingRoles(true)
        const data = await UsersService.getRoles()
        setRoles(data)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载角色失败",
          description: error.message || "无法加载角色列表",
        })
      } finally {
        setIsLoadingRoles(false)
      }
    }

    loadRoles()
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    // 验证必填字段
    if (!formData.role_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "角色为必填项",
      })
      return
    }

    try {
      setIsLoading(true)
      await UsersService.updateUser({
        user_id: user.user_id,
        ...formData,
      })
      toast({
        title: "更新成功",
        description: "用户信息已更新",
      })
      router.push("/dashboard/accounts")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "更新失败",
        description: error.message || "无法更新用户信息",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingUser) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑用户" description="编辑用户信息和角色权限" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="编辑用户" description="编辑用户信息和角色权限" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/accounts">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <CardTitle>用户信息</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 基本信息（只读） */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">账号信息（不可修改）</h3>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="user_id">用户ID</Label>
                      <Input
                        id="user_id"
                        value={user.user_id}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>邮箱</Label>
                      <div className="text-sm text-muted-foreground">
                        {user.user_id.slice(0, 8)}...
                      </div>
                      <p className="text-xs text-muted-foreground">
                        邮箱地址无法修改
                      </p>
                    </div>
                  </div>
                </div>

                {/* 基本信息 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">基本信息</h3>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="full_name">真实姓名</Label>
                      <Input
                        id="full_name"
                        type="text"
                        placeholder="请输入真实姓名"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange("full_name", e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="phone">手机号</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange("is_active", e.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_active" className="cursor-pointer">
                        启用账号
                      </Label>
                    </div>
                  </div>
                </div>

                {/* 角色信息 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">角色信息</h3>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="role_id">
                        用户角色 <span className="text-destructive">*</span>
                      </Label>
                      {isLoadingRoles ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          加载角色列表中...
                        </div>
                      ) : (
                        <Select
                          value={formData.role_id}
                          onValueChange={(value) => handleInputChange("role_id", value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger id="role_id">
                            <SelectValue placeholder="请选择用户角色" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{role.name}</span>
                                  <span className="text-xs text-muted-foreground">({role.code})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {formData.role_id && (
                        <p className="text-xs text-muted-foreground">
                          {roles.find(r => r.id === formData.role_id)?.description}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="organization">所属机构</Label>
                      <Input
                        id="organization"
                        type="text"
                        placeholder="请输入所属机构/部门"
                        value={formData.organization}
                        onChange={(e) => handleInputChange("organization", e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="position">职位</Label>
                      <Input
                        id="position"
                        type="text"
                        placeholder="请输入职位"
                        value={formData.position}
                        onChange={(e) => handleInputChange("position", e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* 备注 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">备注</h3>

                  <div className="grid gap-2">
                    <Label htmlFor="notes">备注信息</Label>
                    <Textarea
                      id="notes"
                      placeholder="请输入备注信息"
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      disabled={isLoading}
                      rows={3}
                    />
                  </div>
                </div>

                {/* 提交按钮 */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Link href="/dashboard/accounts">
                    <Button type="button" variant="outline" disabled={isLoading}>
                      取消
                    </Button>
                  </Link>
                  <Button type="submit" disabled={isLoading || isLoadingRoles}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      "保存修改"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
