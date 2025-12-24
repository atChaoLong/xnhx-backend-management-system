"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { WechatAccountsService, NewWechatAccount } from "@/lib/services/wechatAccounts"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewWechatAccountPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    priority: "0",
    wechat_id: "",
    wechat_name: "",
    responsible_consultant: "",
    team: "",
    account_type: "",
    phone: "",
    login_password: "",
    payment_password: "",
    real_name_person: "",
    status: "active" as 'active' | 'inactive',
  })

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    const requiredFields = [
      { field: 'wechat_id', name: '微信号' },
      { field: 'wechat_name', name: '微信昵称' },
      { field: 'account_type', name: '账号类型' },
      { field: 'phone', name: '手机号' },
      { field: 'login_password', name: '登录密码' },
      { field: 'payment_password', name: '支付密码' },
      { field: 'real_name_person', name: '实名人' },
    ]

    for (const { field, name } of requiredFields) {
      if (!formData[field as keyof typeof formData] || (typeof formData[field as keyof typeof formData] === 'string' && !formData[field as keyof typeof formData].trim())) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: `请输入${name}`,
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      const payload: NewWechatAccount = {
        priority: parseInt(formData.priority),
        wechat_id: formData.wechat_id.trim(),
        wechat_name: formData.wechat_name.trim(),
        responsible_consultant: formData.responsible_consultant.trim() || undefined,
        team: formData.team.trim() || undefined,
        account_type: formData.account_type.trim(),
        phone: formData.phone.trim(),
        login_password: formData.login_password.trim(),
        payment_password: formData.payment_password.trim(),
        real_name_person: formData.real_name_person.trim(),
        status: formData.status,
      }

      await WechatAccountsService.createWechatAccount(payload)

      toast({
        title: "创建成功",
        description: "微信号已创建",
      })

      router.push("/dashboard/wechat-accounts")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建微信号",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增微信号"
        description="填写微信号信息以创建新的账号记录"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wechat_id">
                      微信号 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wechat_id"
                      placeholder="请输入微信号"
                      value={formData.wechat_id}
                      onChange={(e) => handleInputChange("wechat_id", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wechat_name">
                      微信昵称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wechat_name"
                      placeholder="请输入微信昵称"
                      value={formData.wechat_name}
                      onChange={(e) => handleInputChange("wechat_name", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_type">
                    账号类型 <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="account_type"
                    value={formData.account_type}
                    onChange={(e) => handleInputChange("account_type", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    required
                  >
                    <option value="">请选择</option>
                    <option value="个人号">个人号</option>
                    <option value="企业号">企业号</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      手机号 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      placeholder="请输入手机号"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="real_name_person">
                      实名人 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="real_name_person"
                      placeholder="请输入实名人"
                      value={formData.real_name_person}
                      onChange={(e) => handleInputChange("real_name_person", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 分组信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">分组信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">优先级</Label>
                    <Input
                      id="priority"
                      type="number"
                      placeholder="数字越大优先级越高"
                      value={formData.priority}
                      onChange={(e) => handleInputChange("priority", e.target.value)}
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="team">团队</Label>
                    <Input
                      id="team"
                      placeholder="请输入团队名称"
                      value={formData.team}
                      onChange={(e) => handleInputChange("team", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsible_consultant">负责顾问</Label>
                  <Input
                    id="responsible_consultant"
                    placeholder="请输入负责顾问"
                    value={formData.responsible_consultant}
                    onChange={(e) => handleInputChange("responsible_consultant", e.target.value)}
                  />
                </div>
              </div>

              {/* 密码信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">密码信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="login_password">
                      登录密码 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="login_password"
                      type="password"
                      placeholder="请输入登录密码"
                      value={formData.login_password}
                      onChange={(e) => handleInputChange("login_password", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_password">
                      支付密码 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="payment_password"
                      type="password"
                      placeholder="请输入支付密码"
                      value={formData.payment_password}
                      onChange={(e) => handleInputChange("payment_password", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 状态 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">状态</h3>

                <div className="space-y-2">
                  <Label htmlFor="status">状态</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleInputChange("status", e.target.value as 'active' | 'inactive')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/wechat-accounts">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    取消
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    "提交"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
