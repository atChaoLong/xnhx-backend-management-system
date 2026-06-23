"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
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
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { LeadsService, Lead } from "@/lib/services/leads"
import { DictionaryService } from "@/lib/services/dictionary"
import { UserProfilesService, UserProfile } from "@/lib/services/userProfiles"
import { CHAT_SCREENSHOT_ACCEPT, uploadChatScreenshot, validateChatScreenshotFile } from "@/lib/services/upload"
import { useToast } from "@/hooks/use-toast"
import { summarizeError } from "@/lib/safe-error"

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [isLoadingSales, setIsLoadingSales] = useState(true)
  const [isLoadingOperators, setIsLoadingOperators] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [chatScreenshotFiles, setChatScreenshotFiles] = useState<File[]>([])
  const [chatScreenshotPreviews, setChatScreenshotPreviews] = useState<string[]>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const leadId = params.id as string

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    subjects: Array<{ code: string; label: string }>
    addMethods: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
    sources: Array<{ code: string; label: string }>
  }>({
    grades: [],
    subjects: [],
    addMethods: [],
    regions: [],
    sources: [],
  })

  // 运营人员数据
  const [operators, setOperators] = useState<UserProfile[]>([])

  // 销售人员数据
  const [sales, setSales] = useState<UserProfile[]>([])

  const [formData, setFormData] = useState({
    report_number: "",
    entry_date: new Date().toISOString().split("T")[0],
    xhs_source: "",
    channel_platform: "",
    customer_social_id: "",
    add_method_code: "",
    operator_id: "",
    grade_code: "",
    add_status: "",
    region_ip: "",
    parent_wechat: "",
    grab_wechat: "",
    grab_user_id: "",
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
        })
      } catch (error) {
        console.error("加载字典失败:", summarizeError(error))
      } finally {
        setIsLoadingDict(false)
      }
    }

    loadDictionaries()
  }, [])

  // 加载运营人员数据
  useEffect(() => {
    const loadOperators = async () => {
      try {
        setIsLoadingOperators(true)
        const profiles = await UserProfilesService.getAllOperators()
        setOperators(profiles)
      } catch (error) {
        console.error("加载运营人员失败:", summarizeError(error))
      } finally {
        setIsLoadingOperators(false)
      }
    }

    loadOperators()
  }, [])

  // 加载销售人员数据
  useEffect(() => {
    const loadSales = async () => {
      try {
        setIsLoadingSales(true)
        const profiles = await UserProfilesService.getUsers('sales')
        setSales(profiles)
      } catch (error) {
        console.error("加载销售人员失败:", summarizeError(error))
      } finally {
        setIsLoadingSales(false)
      }
    }

    loadSales()
  }, [])

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
          channel_platform: data.channel_platform || "",
          customer_social_id: data.customer_social_id || "",
          add_method_code: data.add_method_code || "",
          operator_id: data.operator_id || "",
          grade_code: data.grade_code || "",
          add_status: data.add_status || "",
          region_ip: data.region_ip || "",
          parent_wechat: data.parent_wechat || "",
          grab_wechat: data.grab_wechat || "",
          grab_user_id: data.grab_user_id || "",
        })
        setSelectedSubjects(data.subject_codes || [])
        // Handle multiple screenshots from comma-separated string
        setChatScreenshotPreviews(data.chat_screenshots ? data.chat_screenshots.split(',').filter(url => url.trim()) : [])
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

  const toggleSubject = (subjectCode: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectCode) ? prev.filter((s) => s !== subjectCode) : [...prev, subjectCode]
    )
  }

  const handleChatScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      const validationError = files
        .map((file) => validateChatScreenshotFile(file))
        .find((message): message is string => Boolean(message))

      if (validationError) {
        e.target.value = ''
        toast({
          variant: "destructive",
          title: "文件不可用",
          description: validationError,
        })
        return
      }

      setChatScreenshotFiles(prev => [...prev, ...files])

      // 上传所有文件到 Supabase Storage
      try {
        setIsUploadingFile(true)
        const uploadPromises = files.map(file => uploadChatScreenshot(file))
        const urls = await Promise.all(uploadPromises)

        setChatScreenshotPreviews(prev => [...prev, ...urls])
        toast({
          title: "上传成功",
          description: `已上传 ${files.length} 张聊天截图`,
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "上传失败",
          description: error.message || "无法上传聊天截图",
        })
      } finally {
        setIsUploadingFile(false)
        // 清除文件选择
        e.target.value = ''
      }
    }
  }

  const handleRemoveScreenshot = (index: number) => {
    setChatScreenshotPreviews(prev => prev.filter((_, i) => i !== index))
    setChatScreenshotFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload = {
        id: leadId,
        entry_date: formData.entry_date,
        xhs_source: formData.xhs_source,
        channel_platform: formData.channel_platform,
        customer_social_id: formData.customer_social_id,
        add_method_code: formData.add_method_code,
        operator_id: formData.operator_id,
        grade_code: formData.grade_code || undefined,
        add_status: formData.add_status || undefined,
        region_ip: formData.region_ip,
        parent_wechat: formData.parent_wechat,
        grab_wechat: formData.grab_wechat,
        grab_user_id: formData.grab_user_id,
        chat_screenshots: chatScreenshotPreviews.length > 0 ? chatScreenshotPreviews.join(',') : undefined,
        subject_codes: selectedSubjects,
      }

      const updatedLead = await LeadsService.updateLead(payload)
      toast({
        title: updatedLead.duplicate_mark ? "保存成功，检测到重复线索" : "保存成功",
        description: updatedLead.duplicate_mark
          ? `线索信息已更新；疑似与 ${updatedLead.collision_operator || '已有线索'} 重复`
          : "线索信息已更新",
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

  if (isLoading || isLoadingDict || isLoadingSales || isLoadingOperators) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑线索" description="修改线索信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑线索" description="修改线索信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">线索不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该线索信息</p>
            <Link href="/dashboard/leads">
              <Button>返回列表</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="编辑线索"
        description="修改线索信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-6">
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
                      readOnly
                      className="bg-muted"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entry_date">录单日期 *</Label>
                    <Input
                      id="entry_date"
                      type="date"
                      value={formData.entry_date}
                      onChange={(e) => handleInputChange("entry_date", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="xhs_source">小红书账号来源</Label>
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
                    <Label htmlFor="channel_platform">渠道平台</Label>
                    <Select value={formData.channel_platform} onValueChange={(value) => handleInputChange("channel_platform", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择渠道平台" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="抖音">抖音</SelectItem>
                        <SelectItem value="小红书">小红书</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer_social_id">客户社媒账号 ID</Label>
                    <Input
                      id="customer_social_id"
                      value={formData.customer_social_id}
                      onChange={(e) => handleInputChange("customer_social_id", e.target.value)}
                      placeholder="请输入客户在该平台的账号 ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add_method_code">添加方式</Label>
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
                    <Label htmlFor="operator_id">运营人员</Label>
                    <Select value={formData.operator_id} onValueChange={(value) => handleInputChange("operator_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择运营人员" />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((operator) => (
                          <SelectItem key={operator.id} value={operator.id}>
                            {operator.name || operator.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add_status">反馈是否添加</Label>
                    <Select
                      value={formData.add_status}
                      onValueChange={(value) => handleInputChange("add_status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择添加状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="added">已添加</SelectItem>
                        <SelectItem value="not_added">未添加</SelectItem>
                        <SelectItem value="pending_feedback">等待反馈</SelectItem>
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
                    <Label htmlFor="grab_wechat">抢单微信</Label>
                    <Select
                      value={formData.grab_user_id}
                      onValueChange={(value) => {
                        const selected = sales.find(s => s.id === value)
                        setFormData(prev => ({
                          ...prev,
                          grab_user_id: value,
                          grab_wechat: selected ? (selected.name || selected.email) : "",
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择销售顾问" />
                      </SelectTrigger>
                      <SelectContent>
                        {sales.map((salesPerson) => (
                          <SelectItem key={salesPerson.id} value={salesPerson.id}>
                            {salesPerson.name || salesPerson.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 聊天截图 */}
              <div className="space-y-2">
                <Label htmlFor="chat_screenshots">聊天截图（支持多张）</Label>
                <Input
                  id="chat_screenshots"
                  type="file"
                  accept={CHAT_SCREENSHOT_ACCEPT}
                  multiple
                  onChange={handleChatScreenshotChange}
                  disabled={isUploadingFile}
                />
                {isUploadingFile && (
                  <p className="text-xs text-muted-foreground flex items-center">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    上传中...
                  </p>
                )}
                {chatScreenshotPreviews.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">已上传 {chatScreenshotPreviews.length} 张截图</p>
                    <div className="grid grid-cols-3 gap-2">
                      {chatScreenshotPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`聊天截图预览 ${index + 1}`}
                            className="w-full h-auto border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveScreenshot(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isSubmitting}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
