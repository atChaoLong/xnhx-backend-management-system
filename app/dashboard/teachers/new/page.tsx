"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload } from "lucide-react"
import { TeachersService, NewTeacher } from "@/lib/services/teachers"
import {
  TEACHER_PHOTO_ACCEPT,
  uploadTeacherPhoto,
  validateTeacherPhotoFile,
} from "@/lib/services/upload"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewTeacherPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 字典数据
  const { items: textbookVersions, loading: textbookVersionsLoading } = useDictionary('textbook_version')
  const { items: provinces, loading: provincesLoading } = useDictionary('province')

  // 多选字段
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<string[]>([])
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [selectedTextbooks, setSelectedTextbooks] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])

  // 文件上传
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])

  const [formData, setFormData] = useState({
    // 基本信息
    name: "",
    teacher_level: "B",
    status: "active",
    gender: "",
    wechat: "",
    classin_phone: "",
    location: "",

    // 教学信息
    used_classin: "",
    has_certificate: "",

    // 学历背景
    education: "",
    university: "",

    // 教学能力
    teaching_years: "",
    teaching_style: "",
    success_cases: "",

    // 其他
    notes: "",
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 处理学科多选
  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((s) => s !== subject)
      } else {
        return [...prev, subject]
      }
    })
  }

  // 处理年级段多选（至多2个）
  const handleGradeLevelToggle = (level: string) => {
    setSelectedGradeLevels((prev) => {
      if (prev.includes(level)) {
        return prev.filter((l) => l !== level)
      } else if (prev.length < 2) {
        return [...prev, level]
      } else {
        toast({
          variant: "destructive",
          title: "最多选择2个年级段",
        })
        return prev
      }
    })
  }

  // 处理时间段多选
  const handleTimeToggle = (time: string) => {
    setSelectedTimes((prev) => {
      if (prev.includes(time)) {
        return prev.filter((t) => t !== time)
      } else {
        return [...prev, time]
      }
    })
  }

  // 处理教材版本多选
  const handleTextbookToggle = (textbook: string) => {
    setSelectedTextbooks((prev) => {
      if (prev.includes(textbook)) {
        return prev.filter((t) => t !== textbook)
      } else {
        return [...prev, textbook]
      }
    })
  }

  // 处理地域多选
  const handleRegionToggle = (region: string) => {
    setSelectedRegions((prev) => {
      if (prev.includes(region)) {
        return prev.filter((r) => r !== region)
      } else {
        return [...prev, region]
      }
    })
  }

  // 处理学生水平多选
  const handleLevelToggle = (level: string) => {
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        return prev.filter((l) => l !== level)
      } else {
        return [...prev, level]
      }
    })
  }

  // 处理照片上传
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const validationError = validateTeacherPhotoFile(file)

      if (validationError) {
        e.target.value = ""
        setPhotoFile(null)
        setPhotoPreview(null)
        toast({
          variant: "destructive",
          title: "文件不可用",
          description: validationError,
        })
        return
      }

      setPhotoFile(file)
      const previewUrl = URL.createObjectURL(file)
      setPhotoPreview(previewUrl)
    }
  }

  // 处理截图上传
  const handleReviewFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const validationError = files
        .map(file => validateTeacherPhotoFile(file))
        .find((message): message is string => Boolean(message))

      if (validationError) {
        e.target.value = ""
        toast({
          variant: "destructive",
          title: "文件不可用",
          description: validationError,
        })
        return
      }

      setReviewFiles(prev => [...prev, ...files])

      files.forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setReviewPreviews(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入姓名",
      })
      return
    }

    if (!formData.gender) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择性别",
      })
      return
    }

    if (!formData.wechat.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入微信号",
      })
      return
    }

    if (!formData.classin_phone.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入Classin手机号",
      })
      return
    }

    if (!formData.location.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入所在地",
      })
      return
    }

    if (selectedSubjects.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个学科",
      })
      return
    }

    if (selectedGradeLevels.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个年级段",
      })
      return
    }

    if (!formData.used_classin) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择是否用过Classin",
      })
      return
    }

    if (!formData.has_certificate) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择是否有教资证",
      })
      return
    }

    if (!formData.education) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择学历",
      })
      return
    }

    if (!formData.university.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入毕业院校",
      })
      return
    }

    if (selectedTimes.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个可排课时间",
      })
      return
    }

    if (selectedTextbooks.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个教材版本",
      })
      return
    }

    if (selectedRegions.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个带过学生地域",
      })
      return
    }

    if (selectedLevels.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "至少选择一个擅长的学生水平",
      })
      return
    }

    if (!photoFile) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请上传老师形象照",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const photoUrl = await uploadTeacherPhoto(photoFile)
      const reviewScreenshotUrls = reviewFiles.length > 0
        ? await Promise.all(reviewFiles.map(file => uploadTeacherPhoto(file)))
        : []

      const payload: NewTeacher = {
        name: formData.name.trim(),
        teacher_level: formData.teacher_level,
        status: formData.status || "active",
        gender: formData.gender,
        wechat: formData.wechat.trim(),
        classin_phone: formData.classin_phone.trim(),
        location: formData.location.trim(),
        subjects: selectedSubjects,
        grade_levels: selectedGradeLevels,
        used_classin: formData.used_classin === 'true',
        has_certificate: formData.has_certificate === 'true',
        education: formData.education,
        university: formData.university,
        teaching_years: formData.teaching_years ? parseInt(formData.teaching_years) : undefined,
        teaching_style: formData.teaching_style || undefined,
        success_cases: formData.success_cases || undefined,
        available_times: selectedTimes,
        textbook_versions: selectedTextbooks,
        student_regions: selectedRegions,
        student_levels: selectedLevels,
        photo_url: photoUrl,
        review_screenshots: reviewScreenshotUrls,
        notes: formData.notes || undefined,
      }

      await TeachersService.createTeacher(payload)

      toast({
        title: "创建成功",
        description: "老师已创建",
      })

      router.push("/dashboard/teachers")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建老师",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增老师"
        description="填写老师信息（核心字段）"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      姓名 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="请输入姓名"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">
                      性别 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => handleInputChange("gender", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wechat">
                      微信号 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wechat"
                      placeholder="请输入微信号"
                      value={formData.wechat}
                      onChange={(e) => handleInputChange("wechat", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classin_phone">
                      Classin手机号 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="classin_phone"
                      placeholder="请输入Classin注册手机号"
                      value={formData.classin_phone}
                      onChange={(e) => handleInputChange("classin_phone", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">
                    所在地 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="location"
                    placeholder="例如：北京、上海、广东"
                    value={formData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher_level">老师等级</Label>
                    <select
                      id="teacher_level"
                      value={formData.teacher_level}
                      onChange={(e) => handleInputChange("teacher_level", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="B">B</option>
                      <option value="A">A</option>
                      <option value="S2">S2</option>
                      <option value="S1.5">S1.5</option>
                      <option value="S1">S1</option>
                      <option value="S0">S0</option>
                      <option value="VIP">VIP</option>
                      <option value="SVIP">SVIP</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">老师状态</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="active">正常</option>
                      <option value="full">满课</option>
                      <option value="paused">暂停排课</option>
                      <option value="disabled">停用</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 教学信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">教学信息</h3>

                <div className="space-y-2">
                  <Label>
                    教授学科 (多选) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {['数学', '语文', '英语', '物理', '化学', '道法', '地理', '历史', '生物', '科学', '社会'].map((subject) => (
                      <div key={subject} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`subject-${subject}`}
                          checked={selectedSubjects.includes(subject)}
                          onChange={() => handleSubjectToggle(subject)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`subject-${subject}`} className="text-sm cursor-pointer flex-1">
                          {subject}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedSubjects.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个学科</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    教授年级段 (多选，至多2个) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                    {['小学', '初中', '高中'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`grade-${level}`}
                          checked={selectedGradeLevels.includes(level)}
                          onChange={() => handleGradeLevelToggle(level)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`grade-${level}`} className="text-sm cursor-pointer flex-1">
                          {level}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedGradeLevels.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个年级段</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="used_classin">
                      是否用过Classin <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="used_classin"
                      value={formData.used_classin}
                      onChange={(e) => handleInputChange("used_classin", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择</option>
                      <option value="true">用过</option>
                      <option value="false">没用过</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="has_certificate">
                      是否有教资证 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="has_certificate"
                      value={formData.has_certificate}
                      onChange={(e) => handleInputChange("has_certificate", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择</option>
                      <option value="true">有</option>
                      <option value="false">暂时没有</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 学历背景 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">学历背景</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="education">
                      学历 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="education"
                      value={formData.education}
                      onChange={(e) => handleInputChange("education", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择</option>
                      <option value="本科">本科</option>
                      <option value="硕士">硕士</option>
                      <option value="博士">博士</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="university">
                      毕业院校 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="university"
                      placeholder="请输入毕业院校"
                      value={formData.university}
                      onChange={(e) => handleInputChange("university", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 教学能力 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">教学能力</h3>

                <div className="space-y-2">
                  <Label>
                    可排课时间 (多选) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                    {['周一上午', '周一下午', '周一晚上', '周二上午', '周二下午', '周二晚上',
                      '周三上午', '周三下午', '周三晚上', '周四上午', '周四下午', '周四晚上',
                      '周五上午', '周五下午', '周五晚上', '周六上午', '周六下午', '周六晚上',
                      '周日上午', '周日下午', '周日晚上'].map((time) => (
                      <div key={time} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`time-${time}`}
                          checked={selectedTimes.includes(time)}
                          onChange={() => handleTimeToggle(time)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`time-${time}`} className="text-sm cursor-pointer flex-1">
                          {time}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedTimes.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个时间段</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    熟悉的教材版本 (多选) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {textbookVersions.length > 0 ? textbookVersions.map((tb) => (
                      <div key={tb.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`textbook-${tb.id}`}
                          checked={selectedTextbooks.includes(tb.label)}
                          onChange={() => handleTextbookToggle(tb.label)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`textbook-${tb.id}`} className="text-sm cursor-pointer flex-1">
                          {tb.label}
                        </label>
                      </div>
                    )) : (
                      <>
                        {['人教版', '苏教版', '北师大版', '沪教版'].map((tb) => (
                          <div key={tb} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`textbook-${tb}`}
                              checked={selectedTextbooks.includes(tb)}
                              onChange={() => handleTextbookToggle(tb)}
                              className="h-4 w-4"
                            />
                            <label htmlFor={`textbook-${tb}`} className="text-sm cursor-pointer flex-1">
                              {tb}
                            </label>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  {selectedTextbooks.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个教材版本</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    带过学生地域 (多选) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {provinces.map((province) => (
                      <div key={province.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`province-${province.id}`}
                          checked={selectedRegions.includes(province.label)}
                          onChange={() => handleRegionToggle(province.label)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`province-${province.id}`} className="text-sm cursor-pointer flex-1">
                          {province.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedRegions.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个地域</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    擅长的学生水平 (多选) <span className="text-destructive">*</span>
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {['基础差，开窍', '中等，查缺补漏', '培优拔高', '懂考点，毕业班', '带不了毕业班'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`level-${level}`}
                          checked={selectedLevels.includes(level)}
                          onChange={() => handleLevelToggle(level)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`level-${level}`} className="text-sm cursor-pointer flex-1">
                          {level}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedLevels.length === 0 && (
                    <p className="text-xs text-destructive">至少选择一个水平</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teaching_years">教学年限（年） <span className="text-destructive">*</span></Label>
                  <Input
                    id="teaching_years"
                    type="number"
                    placeholder="请输入教学年限"
                    value={formData.teaching_years}
                    onChange={(e) => handleInputChange("teaching_years", e.target.value)}
                    min="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teaching_style">教学特点 <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="teaching_style"
                    placeholder="请描述教学特点"
                    value={formData.teaching_style}
                    onChange={(e) => handleInputChange("teaching_style", e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="success_cases">优秀学员提分案例 <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="success_cases"
                    placeholder="请描述优秀学员提分案例"
                    value={formData.success_cases}
                    onChange={(e) => handleInputChange("success_cases", e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              </div>

              {/* 附件 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">附件</h3>

                <div className="space-y-2">
                  <Label>老师形象照 <span className="text-destructive">*</span></Label>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <Input
                        id="photo"
                        type="file"
                        accept={TEACHER_PHOTO_ACCEPT}
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('photo')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {photoPreview ? '重新选择' : '上传照片'}
                      </Button>
                    </div>
                    {photoPreview && (
                      <div className="relative w-32 h-32">
                        <img
                          src={photoPreview}
                          alt="Teacher photo"
                          className="rounded border border-slate-200 object-cover w-full h-full"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>提分/好评截图</Label>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <Input
                        id="reviews"
                        type="file"
                        accept={TEACHER_PHOTO_ACCEPT}
                        multiple
                        onChange={handleReviewFilesChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('reviews')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        上传截图
                      </Button>
                    </div>
                    {reviewPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {reviewPreviews.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Review ${idx + 1}`}
                            className="w-24 h-24 object-cover rounded border border-slate-200"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 其他 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">其他</h3>

                <div className="space-y-2">
                  <Label htmlFor="notes">备注</Label>
                  <Textarea
                    id="notes"
                    placeholder="请输入备注信息"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/teachers">
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
