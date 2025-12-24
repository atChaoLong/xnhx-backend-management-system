"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

// 模拟字典数据
const MOCK_OPTIONS = {
  grades: ["小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
           "初中一年级", "初中二年级", "初中三年级", "高中一年级", "高中二年级", "高中三年级"],
  subjects: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"],
  addMethods: ["主动添加", "被动添加", "转介绍"],
  regions: ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "其他"],
  sources: ["小红书", "抖音", "快手", "微信", "知乎", "B站"],
}

export default function NewLeadPage() {
  const router = useRouter()
  const { addLead } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  const [formData, setFormData] = useState({
    orderSerial: "",
    entryDate: new Date().toISOString().split("T")[0],
    sourceAccount: "",
    addMethodCode: "",
    operatorName: "",
    grade: "",
    regionIp: "",
    parentWechat: "",
    grabWechat: "",
    feedbackStatus: "pending" as const,
    notes: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload = {
        ...formData,
        subjects: selectedSubjects,
      }

      addLead(payload)
      router.push("/dashboard/leads")
    } catch (error) {
      console.error("保存失败:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航栏 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4 p-6">
          <Link href="/dashboard/leads">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">新增线索</h1>
            <p className="text-muted-foreground">填写线索信息以创建新的销售线索</p>
          </div>
        </div>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>线索信息</CardTitle>
            <CardDescription>请填写线索的基本资料和联系信息</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orderSerial">报单序号 *</Label>
                    <Input
                      id="orderSerial"
                      value={formData.orderSerial}
                      onChange={(e) => handleInputChange("orderSerial", e.target.value)}
                      placeholder="请输入报单序号"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entryDate">录入日期 *</Label>
                    <Input
                      id="entryDate"
                      type="date"
                      value={formData.entryDate}
                      onChange={(e) => handleInputChange("entryDate", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sourceAccount">来源账号</Label>
                    <Select value={formData.sourceAccount} onValueChange={(value) => handleInputChange("sourceAccount", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择来源账号" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_OPTIONS.sources.map((source) => (
                          <SelectItem key={source} value={source}>{source}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addMethodCode">添加方式</Label>
                    <Select value={formData.addMethodCode} onValueChange={(value) => handleInputChange("addMethodCode", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择添加方式" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_OPTIONS.addMethods.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operatorName">运营人员</Label>
                    <Input
                      id="operatorName"
                      value={formData.operatorName}
                      onChange={(e) => handleInputChange("operatorName", e.target.value)}
                      placeholder="请输入运营人员"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="feedbackStatus">反馈状态</Label>
                    <Select
                      value={formData.feedbackStatus}
                      onValueChange={(value: any) => handleInputChange("feedbackStatus", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择反馈状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">待处理</SelectItem>
                        <SelectItem value="contacted">已联系</SelectItem>
                        <SelectItem value="converted">已转化</SelectItem>
                        <SelectItem value="lost">已流失</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 学生信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">学生信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade">年级</Label>
                    <Select value={formData.grade} onValueChange={(value) => handleInputChange("grade", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择年级" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_OPTIONS.grades.map((grade) => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regionIp">地域</Label>
                    <Select value={formData.regionIp} onValueChange={(value) => handleInputChange("regionIp", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择地域" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_OPTIONS.regions.map((region) => (
                          <SelectItem key={region} value={region}>{region}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>咨询学科（多选）</Label>
                  <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
                    {MOCK_OPTIONS.subjects.map((subject) => (
                      <div key={subject} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subject-${subject}`}
                          checked={selectedSubjects.includes(subject)}
                          onCheckedChange={() => toggleSubject(subject)}
                        />
                        <Label
                          htmlFor={`subject-${subject}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {subject}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">联系信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentWechat">家长微信号</Label>
                    <Input
                      id="parentWechat"
                      value={formData.parentWechat}
                      onChange={(e) => handleInputChange("parentWechat", e.target.value)}
                      placeholder="请输入家长微信号"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grabWechat">抢单微信号</Label>
                    <Input
                      id="grabWechat"
                      value={formData.grabWechat}
                      onChange={(e) => handleInputChange("grabWechat", e.target.value)}
                      placeholder="请输入抢单微信号"
                    />
                  </div>
                </div>
              </div>

              {/* 备注 */}
              <div className="space-y-2">
                <Label htmlFor="notes">备注</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="请输入备注信息"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/leads">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    取消
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  创建线索
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
