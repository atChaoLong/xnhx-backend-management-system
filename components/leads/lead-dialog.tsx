"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/app-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Lead } from "@/lib/types"

interface LeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId?: string | null
}

// 模拟字典数据
const MOCK_OPTIONS = {
  grades: ["小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
           "初中一年级", "初中二年级", "初中三年级", "高中一年级", "高中二年级", "高中三年级"],
  subjects: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"],
  addMethods: ["主动添加", "被动添加", "转介绍"],
  regions: ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "其他"],
  sources: ["小红书", "抖音", "快手", "微信", "知乎", "B站"],
}

export function LeadDialog({ open, onOpenChange, leadId }: LeadDialogProps) {
  const { leads, addLead, updateLead } = useApp()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  // 表单状态
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

  // 加载编辑数据
  useEffect(() => {
    if (leadId) {
      const lead = leads.find((l) => l.id === leadId)
      if (lead) {
        setFormData({
          orderSerial: lead.orderSerial || "",
          entryDate: lead.entryDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          sourceAccount: lead.sourceAccount || "",
          addMethodCode: lead.addMethodCode || "",
          operatorName: lead.operatorName || "",
          grade: lead.grade || "",
          regionIp: lead.regionIp || "",
          parentWechat: lead.parentWechat || "",
          grabWechat: lead.grabWechat || "",
          feedbackStatus: lead.feedbackStatus,
          notes: lead.notes || "",
        })
        setSelectedSubjects(lead.subjects || [])
      }
    } else {
      // 重置表单
      setFormData({
        orderSerial: "",
        entryDate: new Date().toISOString().split("T")[0],
        sourceAccount: "",
        addMethodCode: "",
        operatorName: "",
        grade: "",
        regionIp: "",
        parentWechat: "",
        grabWechat: "",
        feedbackStatus: "pending",
        notes: "",
      })
      setSelectedSubjects([])
    }
  }, [leadId, leads])

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
    setIsLoading(true)

    try {
      const payload = {
        ...formData,
        subjects: selectedSubjects,
      }

      if (leadId) {
        updateLead(leadId, payload)
      } else {
        addLead(payload)
      }

      onOpenChange(false)
    } catch (error) {
      console.error("保存失败:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const isEditing = !!leadId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑线索" : "新增线索"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "修改线索信息" : "录入新的销售线索"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg">
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
              className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="请输入备注信息"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "更新" : "创建"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
