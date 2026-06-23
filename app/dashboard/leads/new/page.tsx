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
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { LeadsService, NewLead } from "@/lib/services/leads"
import { DictionaryService } from "@/lib/services/dictionary"
import { UserProfilesService, UserProfile } from "@/lib/services/userProfiles"
import { CHAT_SCREENSHOT_ACCEPT, uploadChatScreenshot, validateChatScreenshotFile } from "@/lib/services/upload"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { summarizeError } from "@/lib/safe-error"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function NewLeadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user: currentUser } = useCurrentUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [isLoadingOperators, setIsLoadingOperators] = useState(true)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [chatScreenshotFiles, setChatScreenshotFiles] = useState<File[]>([])
  const [chatScreenshotPreviews, setChatScreenshotPreviews] = useState<string[]>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewImageIndex, setPreviewImageIndex] = useState(0)

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

  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    xhs_source: "",
    channel_platform: "",
    customer_social_id: "",
    add_method_code: "",
    operator_id: "",
    grade_code: "",
    region_ip: "",
    parent_wechat: "",
  })

  // 设置默认运营人员为当前用户
  useEffect(() => {
    if (currentUser && !formData.operator_id) {
      setFormData(prev => ({ ...prev, operator_id: currentUser.id }))
    }
  }, [currentUser])

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
        e.target.value = ''
      }
    }
  }

  const handleRemoveScreenshot = (index: number) => {
    setChatScreenshotPreviews(prev => prev.filter((_, i) => i !== index))
    setChatScreenshotFiles(prev => prev.filter((_, i) => i !== index))
  }

  const openImagePreview = (images: string[], index = 0) => {
    setPreviewImages(images)
    setPreviewImageIndex(index)
    setImagePreviewOpen(true)
  }

  const showPreviousPreviewImage = () => {
    setPreviewImageIndex(index => Math.max(index - 1, 0))
  }

  const showNextPreviewImage = () => {
    setPreviewImageIndex(index => Math.min(index + 1, previewImages.length - 1))
  }

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.entry_date || !formData.xhs_source ||
        !formData.channel_platform || !formData.customer_social_id ||
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
        entry_date: formData.entry_date,
        xhs_source: formData.xhs_source,
        channel_platform: formData.channel_platform,
        customer_social_id: formData.customer_social_id,
        add_method_code: formData.add_method_code,
        operator_id: formData.operator_id,
        grade_code: formData.grade_code || undefined,
        subject_codes: selectedSubjects.length > 0 ? selectedSubjects : undefined,
        region_ip: formData.region_ip || undefined,
        parent_wechat: formData.parent_wechat || undefined,
        chat_screenshots: chatScreenshotPreviews.length > 0 ? chatScreenshotPreviews.join(',') : undefined,
      }

      const createdLead = await LeadsService.createLead(payload)

      toast({
        title: createdLead.duplicate_mark ? "创建成功，检测到重复线索" : "创建成功",
        description: createdLead.duplicate_mark
          ? `线索已创建，编号：${createdLead.report_number}；疑似与 ${createdLead.collision_operator || '已有线索'} 重复`
          : `线索已创建，编号：${createdLead.report_number}`,
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
            {isLoadingDict || isLoadingOperators ? (
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
                      <Label htmlFor="channel_platform">
                        渠道平台 <span className="text-destructive">*</span>
                      </Label>
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
                      <Label htmlFor="customer_social_id">
                        客户社媒账号 ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="customer_social_id"
                        value={formData.customer_social_id}
                        onChange={(e) => handleInputChange("customer_social_id", e.target.value)}
                        placeholder="请输入客户在该平台的账号 ID"
                        required
                      />
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

                    <div className="space-y-2">
                      <Label htmlFor="parent_wechat">家长微信号</Label>
                      <Input
                        id="parent_wechat"
                        value={formData.parent_wechat}
                        onChange={(e) => handleInputChange("parent_wechat", e.target.value)}
                        placeholder="请输入家长微信号"
                      />
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
                              className="w-full h-auto border rounded cursor-zoom-in"
                              onClick={() => openImagePreview(chatScreenshotPreviews, index)}
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
                  <Button type="submit" disabled={isSubmitting || isUploadingFile}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    创建线索
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 图片预览对话框 */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>聊天截图</DialogTitle>
            <DialogDescription>
              {previewImages.length > 0 ? `${previewImageIndex + 1} / ${previewImages.length}` : "无图片"}
            </DialogDescription>
          </DialogHeader>
          {previewImages.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-[70vh] overflow-auto rounded border bg-muted/30">
                <img
                  src={previewImages[previewImageIndex]}
                  alt={`聊天截图 ${previewImageIndex + 1}`}
                  className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>
              {previewImages.length > 1 && (
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={showPreviousPreviewImage}
                    disabled={previewImageIndex === 0}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    上一张
                  </Button>
                  <Button
                    variant="outline"
                    onClick={showNextPreviewImage}
                    disabled={previewImageIndex >= previewImages.length - 1}
                  >
                    下一张
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
