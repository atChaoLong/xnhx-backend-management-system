"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
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
import { LeadsService, Lead } from "@/lib/services/leads"
import { useToast } from "@/hooks/use-toast"

// 模拟字典数据
const MOCK_OPTIONS = {
  grades: ["小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
           "初中一年级", "初中二年级", "初中三年级", "高中一年级", "高中二年级", "高中三年级"],
  subjects: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"],
  addMethods: ["主动添加", "被动添加", "转介绍"],
  regions: ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "其他"],
  sources: ["小红书", "抖音", "快手", "微信", "知乎", "B站"],
}

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  const leadId = params.id as string

  const [formData, setFormData] = useState({
    report_number: "",
    entry_date: new Date().toISOString().split("T")[0],
    xhs_source: "",
    add_method_code: "",
    operator_id: "",
    grade_code: "",
    region_ip: "",
    parent_wechat: "",
    grab_wechat: "",
    add_status: "pending" as const,
    remark: "",
  })

  // 加载线索数据
  useEffect(() => {
    const fetchLead = async () => {
      try {
        setIsLoading(true)
        const data = await LeadsService.getLeadById(leadId)
        setLead(data)

        // 设置表单数据（使用新的字段名）
        setFormData({
          report_number: data.report_number || "",
          entry_date: data.entry_date?.split("T")[0] || new Date().toISOString().split("T")[0],
          xhs_source: data.xhs_source || "",
          add_method_code: data.add_method_code || "",
          operator_id: data.operator_id || "",
          grade_code: data.grade_code || "",
          region_ip: data.region_ip || "",
          parent_wechat: data.parent_wechat || "",
          grab_wechat: data.grab_wechat || "",
          add_status: (data.add_status as any) || "pending",
          remark: data.remark || "",
        })
        setSelectedSubjects(data.subject_codes || [])
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载线索数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchLead()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

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
        id: leadId,
        report_number: formData.report_number,
        entry_date: formData.entry_date,
        xhs_source: formData.xhs_source,
        add_method_code: formData.add_method_code,
        operator_id: formData.operator_id,
        grade_code: formData.grade_code,
        region_ip: formData.region_ip,
        parent_wechat: formData.parent_wechat,
        grab_wechat: formData.grab_wechat,
        subject_codes: selectedSubjects,
        add_status: formData.add_status,
        remark: formData.remark,
      }

      await LeadsService.updateLead(payload)
      toast({
        title: "保存成功",
        description: "线索信息已更新",
      })
      router.push("/dashboard/leads")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新线索",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">线索不存在</h2>
          <p className="text-muted-foreground mb-4">未找到该线索信息</p>
          <Link href="/dashboard/leads">
            <Button>返回列表</Button>
          </Link>
        </div>
      </div>
    )
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
            <h1 className="text-2xl font-bold tracking-tight">编辑线索</h1>
            <p className="text-muted-foreground">修改线索信息</p>
          </div>
        </div>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>线索信息</CardTitle>
            <CardDescription>修改线索的基本资料和联系信息</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="report_number">报单序号 *</Label>
                    <Input
                      id="report_number"
                      value={formData.report_number}
                      onChange={(e) => handleInputChange("report_number", e.target.value)}
                      placeholder="请输入报单序号"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entry_date">录入日期 *</Label>
                    <Input
                      id="entry_date"
                      type="date"
                      value={formData.entry_date}
                      onChange={(e) => handleInputChange("entry_date", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="xhs_source">来源账号</Label>
                    <Select value={formData.xhs_source} onValueChange={(value) => handleInputChange("xhs_source", value)}>
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
                    <Label htmlFor="add_method_code">添加方式</Label>
                    <Select value={formData.add_method_code} onValueChange={(value) => handleInputChange("add_method_code", value)}>
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
                    <Label htmlFor="operator_id">运营人员</Label>
                    <Input
                      id="operator_id"
                      value={formData.operator_id}
                      onChange={(e) => handleInputChange("operator_id", e.target.value)}
                      placeholder="请输入运营人员"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add_status">反馈状态</Label>
                    <Select
                      value={formData.add_status}
                      onValueChange={(value: any) => handleInputChange("add_status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择反馈状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">待处理</SelectItem>
                        <SelectItem value="added">已添加</SelectItem>
                        <SelectItem value="not_added">未添加</SelectItem>
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
                    <Label htmlFor="grade_code">年级</Label>
                    <Select value={formData.grade_code} onValueChange={(value) => handleInputChange("grade_code", value)}>
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
                    <Label htmlFor="region_ip">地域</Label>
                    <Select value={formData.region_ip} onValueChange={(value) => handleInputChange("region_ip", value)}>
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
                    <Label htmlFor="parent_wechat">家长微信号</Label>
                    <Input
                      id="parent_wechat"
                      value={formData.parent_wechat}
                      onChange={(e) => handleInputChange("parent_wechat", e.target.value)}
                      placeholder="请输入家长微信号"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grab_wechat">抢单微信号</Label>
                    <Input
                      id="grab_wechat"
                      value={formData.grab_wechat}
                      onChange={(e) => handleInputChange("grab_wechat", e.target.value)}
                      placeholder="请输入抢单微信号"
                    />
                  </div>
                </div>
              </div>

              {/* 备注 */}
              <div className="space-y-2">
                <Label htmlFor="remark">备注</Label>
                <textarea
                  id="remark"
                  className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  value={formData.remark}
                  onChange={(e) => handleInputChange("remark", e.target.value)}
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
                  保存更改
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
