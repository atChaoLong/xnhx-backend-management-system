"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { UsersService, CreateUserRequest, UserRole } from "@/lib/services/users"
import { useToast } from "@/hooks/use-toast"

export default function NewAccountPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [roles, setRoles] = useState<UserRole[]>([])

  const [formData, setFormData] = useState<CreateUserRequest>({
    email: "",
    password: "",
    phone: "",
    full_name: "",
    role_id: "",
    organization: "",
    position: "",
    notes: "",
  })

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

  const handleInputChange = (field: keyof CreateUserRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.email || !formData.password || !formData.role_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "邮箱、密码和角色为必填项",
      })
      return
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "邮箱格式不正确",
      })
      return
    }

    // 验证密码长度
    if (formData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "密码长度不能少于6位",
      })
      return
    }

    try {
      setIsLoading(true)
      await UsersService.createUser(formData)
      toast({
        title: "创建成功",
        description: "用户已创建",
      })
      router.push("/dashboard/accounts")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建用户",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="新增用户" description="创建新的系统用户账号" />

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
                {/* 基本信息 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">基本信息</h3>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">
                        邮箱 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="example@company.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        用于登录系统的邮箱地址
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="password">
                        密码 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="请输入密码（至少6位）"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        required
                        minLength={6}
                        disabled={isLoading}
                      />
                    </div>

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
                        创建中...
                      </>
                    ) : (
                      "创建用户"
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
