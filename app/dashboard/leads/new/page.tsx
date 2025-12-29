"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2 } from "lucide-react"
import { LeadsService, NewLead } from "@/lib/services/leads"
import { DictionaryService } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewLeadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    subjects: Array<{ code: string; label: string }>
    addMethods: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
    sources: Array<{ code: string; label: string }>
    salesStaff: Array<{ code: string; label: string }>
  }>({
    grades: [],
    subjects: [],
    addMethods: [],
    regions: [],
    sources: [],
    salesStaff: [],
  })

  const [formData, setFormData] = useState({
    report_number: "",
    entry_date: new Date().toISOString().split("T")[0],
    xhs_source: "",
    add_method_code: "",
    operator_id: "",
    grade_code: "",
    add_status: "",
    region_ip: "",
    parent_wechat: "",
    grab_wechat: "",
    chat_screenshots: "",
  })

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getAllDictionaries()

        setDictOptions({
          grades: dicts.grade || [],
          subjects: dicts.subject || [],
          addMethods: dicts.add_method || [],
          regions: dicts.province || [],
          sources: dicts.xhs_source || [],
          salesStaff: dicts.sales_staff || [],
        })
      } catch (error) {
        console.error("加载字典失败:", error)
      } finally {
        setIsLoadingDict(false)
      }
    }

    loadDictionaries()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleSubject = (subjectCode: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectCode) ? prev.filter((s) => s !== subjectCode) : [...prev, subjectCode]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.report_number || !formData.entry_date || !formData.xhs_source ||
        !formData.add_method_code || !formData.operator_id) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写所有必填字段",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload: NewLead = {
        report_number: formData.report_number,
        entry_date: formData.entry_date,
        xhs_source: formData.xhs_source,
        add_method_code: formData.add_method_code,
        operator_id: formData.operator_id,
        grade_code: formData.grade_code || undefined,
        add_status: formData.add_status || undefined,
        subject_codes: selectedSubjects.length > 0 ? selectedSubjects : undefined,
        region_ip: formData.region_ip || undefined,
        parent_wechat: formData.parent_wechat || undefined,
        grab_wechat: formData.grab_wechat || undefined,
        chat_screenshots: formData.chat_screenshots || undefined,
      }

      await LeadsService.createLead(payload)

      toast({
        title: "创建成功",
        description: "线索已创建",
      })

      router.push("/dashboard/leads")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建线索",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增线索"
        description="填写线索信息以创建新的销售线索"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-6">
            {isLoadingDict ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">基本信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="report_number">
                        报单序号 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="report_number"
                        value={formData.report_number}
                        onChange={(e) => handleInputChange("report_number", e.target.value)}
                        placeholder="请输入报单序号"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entry_date">
                        录单日期 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="entry_date"
                        type="date"
                        value={formData.entry_date}
                        onChange={(e) => handleInputChange("entry_date", e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="xhs_source">
                        小红书账号来源 <span className="text-destructive">*</span>
                      </Label>
                      <Select value={formData.xhs_source} onValueChange={(value) => handleInputChange("xhs_source", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择小红书账号来源" />
                        </SelectTrigger>
                        <SelectContent>
                          {dictOptions.sources.map((source) => (
                            <SelectItem key={source.code} value={source.code}>
                              {source.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="add_method_code">
                        添加方式 <span className="text-destructive">*</span>
                      </Label>
                      <Select value={formData.add_method_code} onValueChange={(value) => handleInputChange("add_method_code", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择添加方式" />
                        </SelectTrigger>
                        <SelectContent>
                          {dictOptions.addMethods.map((method) => (
                            <SelectItem key={method.code} value={method.code}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="operator_id">
                        运营人员 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="operator_id"
                        value={formData.operator_id}
                        onChange={(e) => handleInputChange("operator_id", e.target.value)}
                        placeholder="请输入运营人员"
                        required
                      />
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
                          {dictOptions.grades.map((grade) => (
                            <SelectItem key={grade.code} value={grade.code}>
                              {grade.label}
                            </SelectItem>
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
                          {dictOptions.regions.map((region) => (
                            <SelectItem key={region.code} value={region.code}>
                              {region.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>咨询学科（多选）</Label>
                    <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
                      {dictOptions.subjects.map((subject) => (
                        <div key={subject.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`subject-${subject.code}`}
                            checked={selectedSubjects.includes(subject.code)}
                            onCheckedChange={() => toggleSubject(subject.code)}
                          />
                          <Label
                            htmlFor={`subject-${subject.code}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {subject.label}
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
                      <Select value={formData.grab_wechat} onValueChange={(value) => handleInputChange("grab_wechat", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择销售人员" />
                        </SelectTrigger>
                        <SelectContent>
                          {dictOptions.salesStaff.map((staff) => (
                            <SelectItem key={staff.code} value={staff.code}>
                              {staff.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 反馈信息 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">反馈信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add_status">反馈是否添加</Label>
                      <Select value={formData.add_status} onValueChange={(value) => handleInputChange("add_status", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择添加状态" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="已添加">已添加</SelectItem>
                          <SelectItem value="未添加">未添加</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chat_screenshots">聊天截图</Label>
                      <Input
                        id="chat_screenshots"
                        value={formData.chat_screenshots}
                        onChange={(e) => handleInputChange("chat_screenshots", e.target.value)}
                        placeholder="请输入聊天截图URL"
                      />
                    </div>
                  </div>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
