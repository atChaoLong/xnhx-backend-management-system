"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { TrialLessonsService, TrialLesson } from "@/lib/services/trialLessons"
import { DictionaryService } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import { uploadFile } from "@/lib/supabase-client"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function EditTrialLessonPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [lesson, setLesson] = useState<TrialLesson | null>(null)

  const lessonId = params.id as string

  // 文件上传
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    subjects: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
  }>({
    grades: [],
    subjects: [],
    regions: [],
  })

  // 教师数据
  const [teachers, setTeachers] = useState<Array<{
    id: string
    teacher_name: string
    teacher_subject?: string
    teacher_phone?: string
    classin_uid: number
  }>>([])

  const [formData, setFormData] = useState({
    // 基本信息
    child_name: "",
    status: "pending" as 'pending' | 'confirmed' | 'completed' | 'cancelled',
    lead_id: "",

    // 课程信息
    region: "",
    grade: "",
    trial_subject: "",
    trial_time: "",
    trial_duration: "",

    // 联系信息
    phone: "",
    channel: "",

    // 财务信息
    trial_amount: "",
    payment_proof: "",

    // 优先级
    urgency_level: "" as 'low' | 'medium' | 'high' | 'urgent' | '',

    // 业务信息
    notes: "",
    assigned_consultant: "",
    course_status: "",
    student_type: "",

    // 教务信息
    matched_teacher: "",
    confirmed_teacher: "",
  })

  // 加载试听课程数据
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setIsLoading(true)
        const data = await TrialLessonsService.getTrialLessonById(lessonId)
        setLesson(data)

        // 设置表单数据
        setFormData({
          child_name: data.child_name || "",
          status: data.status || "pending",
          lead_id: data.lead_id || "",
          region: data.region || "",
          grade: data.grade || "",
          trial_subject: data.trial_subject || "",
          trial_time: data.trial_time ? new Date(data.trial_time).toISOString().slice(0, 16) : "",
          trial_duration: data.trial_duration?.toString() || "",
          phone: data.phone || "",
          channel: data.channel || "",
          trial_amount: data.trial_amount?.toString() || "",
          payment_proof: data.payment_proof || "",
          urgency_level: data.urgency_level || "",
          notes: data.notes || "",
          assigned_consultant: data.assigned_consultant || "",
          course_status: data.course_status || "",
          student_type: data.student_type || "",
          matched_teacher: data.matched_teacher || "",
          confirmed_teacher: data.confirmed_teacher || "",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载试听课程数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchLesson()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getAllDictionaries()

        setDictOptions({
          grades: dicts.grade || [],
          subjects: dicts.subject || [],
          regions: dicts.province || [],
        })
      } catch (error) {
        console.error("加载字典失败:", error)
      } finally {
        setIsLoadingDict(false)
      }
    }

    loadDictionaries()
  }, [])

  // 加载教师数据
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setIsLoadingTeachers(true)
        const response = await fetch('/api/teachers/classin')
        const result = await response.json()

        if (result.success) {
          setTeachers(result.data)
        } else {
          console.error("加载教师失败:", result.error)
        }
      } catch (error) {
        console.error("加载教师失败:", error)
      } finally {
        setIsLoadingTeachers(false)
      }
    }

    loadTeachers()
  }, [])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    const requiredFields = [
      { field: 'child_name', name: '孩子称呼' },
      { field: 'region', name: '地域' },
      { field: 'grade', name: '年级' },
      { field: 'trial_subject', name: '试听科目' },
      { field: 'trial_time', name: '试听时间' },
      { field: 'trial_duration', name: '试听时长' },
      { field: 'phone', name: '手机号' },
      { field: 'channel', name: '渠道' },
      { field: 'payment_proof', name: '付款凭证' },
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
      // 如果上传了新文件，先上传
      let paymentProofUrl = formData.payment_proof
      if (uploadedFile) {
        try {
          setIsUploading(true)
          paymentProofUrl = await uploadFile(uploadedFile, 'payment-proofs')
          toast({
            title: "上传成功",
            description: "付款凭证已上传",
          })
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "上传失败",
            description: error.message || "无法上传付款凭证",
          })
          return
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        id: lessonId,
        child_name: formData.child_name.trim(),
        status: formData.status,
        lead_id: formData.lead_id.trim() || undefined,
        region: formData.region.trim(),
        grade: formData.grade.trim(),
        trial_subject: formData.trial_subject.trim(),
        trial_time: formData.trial_time,
        trial_duration: parseFloat(formData.trial_duration),
        phone: formData.phone.trim(),
        channel: formData.channel.trim(),
        trial_amount: formData.trial_amount ? parseFloat(formData.trial_amount) : undefined,
        payment_proof: paymentProofUrl.trim(),
        urgency_level: formData.urgency_level || undefined,
        notes: formData.notes.trim() || undefined,
        assigned_consultant: formData.assigned_consultant.trim() || undefined,
        course_status: formData.course_status.trim() || undefined,
        student_type: formData.student_type.trim() || undefined,
        matched_teacher: formData.matched_teacher.trim() || undefined,
        confirmed_teacher: formData.confirmed_teacher.trim() || undefined,
      }

      await TrialLessonsService.updateTrialLesson(payload)

      toast({
        title: "保存成功",
        description: "试听课程信息已更新",
      })

      router.push("/dashboard/trial-lessons")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新试听课程",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || isLoadingDict || isLoadingTeachers) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑试听课程" description="修改试听课程信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑试听课程" description="修改试听课程信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">试听课程不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该试听课程信息</p>
            <Link href="/dashboard/trial-lessons">
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
        title="编辑试听课程"
        description="修改试听课程信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="child_name">
                      孩子称呼 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="child_name"
                      placeholder="请输入孩子称呼"
                      value={formData.child_name}
                      onChange={(e) => handleInputChange("child_name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lead_id">关联线索ID</Label>
                    <Input
                      id="lead_id"
                      placeholder="请输入线索ID（可选）"
                      value={formData.lead_id}
                      onChange={(e) => handleInputChange("lead_id", e.target.value)}
                    />
                  </div>
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
                    <Label htmlFor="channel">
                      渠道 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="channel"
                      placeholder="请输入渠道"
                      value={formData.channel}
                      onChange={(e) => handleInputChange("channel", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 课程信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">课程信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="region">
                      地域 <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.region} onValueChange={(value) => handleInputChange("region", value)}>
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
                    <Label htmlFor="grade">
                      年级 <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.grade} onValueChange={(value) => handleInputChange("grade", value)}>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trial_subject">
                      试听科目 <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.trial_subject} onValueChange={(value) => handleInputChange("trial_subject", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择试听科目" />
                      </SelectTrigger>
                      <SelectContent>
                        {dictOptions.subjects.map((subject) => (
                          <SelectItem key={subject.code} value={subject.code}>
                            {subject.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trial_duration">
                      试听时长(小时) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="trial_duration"
                      type="number"
                      step="0.5"
                      placeholder="例如: 1.0"
                      value={formData.trial_duration}
                      onChange={(e) => handleInputChange("trial_duration", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trial_time">
                    试听时间 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="trial_time"
                    type="datetime-local"
                    value={formData.trial_time}
                    onChange={(e) => handleInputChange("trial_time", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* 财务信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">财务信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trial_amount">试听金额</Label>
                    <Input
                      id="trial_amount"
                      type="number"
                      step="0.01"
                      placeholder="请输入试听金额"
                      value={formData.trial_amount}
                      onChange={(e) => handleInputChange("trial_amount", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_proof">
                      付款凭证 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="payment_proof"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadedFile(file)
                          // 创建本地预览URL
                          const url = URL.createObjectURL(file)
                          setPreviewUrl(url)
                          handleInputChange("payment_proof", url)
                        }
                      }}
                    />
                    {(previewUrl || formData.payment_proof) && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">
                          {uploadedFile ? '新图片预览：' : '当前付款凭证：'}
                        </p>
                        <img
                          src={previewUrl || formData.payment_proof}
                          alt="付款凭证预览"
                          className="max-w-xs h-auto border rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        {uploadedFile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            新文件: {uploadedFile.name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 优先级和状态 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">优先级和状态</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="urgency_level">紧急程度</Label>
                    <select
                      id="urgency_level"
                      value={formData.urgency_level}
                      onChange={(e) => handleInputChange("urgency_level", e.target.value as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择</option>
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="urgent">紧急</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">状态</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="pending">待确认</option>
                      <option value="confirmed">已确认</option>
                      <option value="completed">已完成</option>
                      <option value="cancelled">已取消</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 业务信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">业务信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assigned_consultant">对应顾问</Label>
                    <Input
                      id="assigned_consultant"
                      placeholder="请输入对应顾问"
                      value={formData.assigned_consultant}
                      onChange={(e) => handleInputChange("assigned_consultant", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="course_status">课程状态</Label>
                    <Input
                      id="course_status"
                      placeholder="请输入课程状态"
                      value={formData.course_status}
                      onChange={(e) => handleInputChange("course_status", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student_type">学生类型</Label>
                    <Input
                      id="student_type"
                      placeholder="请输入学生类型"
                      value={formData.student_type}
                      onChange={(e) => handleInputChange("student_type", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="matched_teacher">匹配老师</Label>
                    <Input
                      id="matched_teacher"
                      placeholder="请输入匹配老师"
                      value={formData.matched_teacher}
                      onChange={(e) => handleInputChange("matched_teacher", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">备注</Label>
                  <textarea
                    id="notes"
                    placeholder="请输入备注"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 教务信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">教务信息</h3>

                <div className="space-y-2">
                  <Label htmlFor="confirmed_teacher">确认老师（教务）</Label>
                  <Select
                    value={formData.confirmed_teacher}
                    onValueChange={(value) => handleInputChange("confirmed_teacher", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择确认老师（需已绑定ClassIn）" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.teacher_name}>
                          <div className="flex flex-col">
                            <span>{teacher.teacher_name}</span>
                            {teacher.teacher_subject && (
                              <span className="text-xs text-muted-foreground">
                                {teacher.teacher_subject}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    仅显示已绑定 ClassIn 的教师
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/trial-lessons">
                  <Button type="button" variant="outline" disabled={isSubmitting || isUploading}>
                    取消
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    "更新"
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
