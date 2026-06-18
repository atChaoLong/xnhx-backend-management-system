"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Loader2, Upload } from "lucide-react"
import { TrialLessonsService, NewTrialLesson } from "@/lib/services/trialLessons"
import { LeadsService, type Lead } from "@/lib/services/leads"
import { StudentsService } from "@/lib/services/students"
import { type ClassInTeacherOption, TeachersService } from "@/lib/services/teachers"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import {
  PAYMENT_PROOF_ACCEPT,
  isPaymentProofImageFile,
  uploadPaymentProof,
  validatePaymentProofFile,
} from "@/lib/services/upload"
import { toChinaTimeISO } from "@/lib/utils/timezone"
import Link from "next/link"

function firstText(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function getLeadChannel(lead: any) {
  return firstText(lead.channel_platform, lead.xhs_source, lead.add_method_code)
}

function getLeadFirstSubject(lead: Lead) {
  if (Array.isArray(lead.subject_codes)) {
    return firstText(...lead.subject_codes)
  }

  return firstText(lead.subject_codes)
}

function getLeadStudentAlias(lead: Lead) {
  return firstText(lead.customer_social_id, lead.report_number)
}

function getLeadSourceContact(lead: Lead) {
  return firstText(lead.parent_wechat, lead.customer_social_id)
}

function getClassInContactFromLead(lead: Lead) {
  const contact = getLeadSourceContact(lead)
  if (!contact) return ""

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailPattern.test(contact)) return contact

  const phoneLikePattern = /^\+?[\d\s\-()]{6,20}$/
  const digits = contact.replace(/\D/g, "")

  if (phoneLikePattern.test(contact) && digits.length >= 6 && digits.length <= 20) {
    return contact
  }

  return ""
}

export default function NewTrialLessonPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const leadIdFromUrl = searchParams.get('lead_id') || ""
  const studentIdFromUrl = searchParams.get('student_id') || ""
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true)

  // 字典数据
  const { items: regions, loading: regionsLoading } = useDictionary('province')
  const { items: grades, loading: gradesLoading } = useDictionary('grade')
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')
  const { items: trialDurations, loading: trialDurationsLoading } = useDictionary('class_duration')
  const { items: courseStatuses, loading: courseStatusesLoading } = useDictionary('trial_course_status')
  const { items: studentTypes, loading: studentTypesLoading } = useDictionary('student_type')

  // 图片预览
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")

  // 线索列表
  const [leads, setLeads] = useState<Lead[]>([])
  const [teachers, setTeachers] = useState<ClassInTeacherOption[]>([])
  const [selectedMatchedTeacherId, setSelectedMatchedTeacherId] = useState("")

  const [formData, setFormData] = useState({
    // 基本信息
    student_name: "",
    lead_id: "",
    student_id: "",

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

    // 业务信息
    notes: "",
    course_status: "",
    student_type: "",
    matched_teacher: "",
  })

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePaymentProofChange = (file: File | undefined, input?: HTMLInputElement) => {
    if (!file) return

    const validationError = validatePaymentProofFile(file)
    if (validationError) {
      toast({
        variant: "destructive",
        title: "文件不符合要求",
        description: validationError,
      })
      if (input) input.value = ""
      setUploadedFile(null)
      setPreviewUrl("")
      handleInputChange("payment_proof", "")
      return
    }

    setUploadedFile(file)
    if (isPaymentProofImageFile(file)) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      handleInputChange("payment_proof", url)
    } else {
      setPreviewUrl("")
      handleInputChange("payment_proof", file.name)
    }
  }

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setIsLoadingTeachers(true)
        const data = await TeachersService.getClassInTeachers()
        setTeachers(data || [])
      } catch (error) {
        toast({
          variant: "destructive",
          title: "加载老师失败",
          description: "无法加载 ClassIn 老师目录",
        })
      } finally {
        setIsLoadingTeachers(false)
      }
    }

    loadTeachers()
  }, [])

  // 从 URL 参数加载线索信息并自动填充
  useEffect(() => {
    if (!leadIdFromUrl) return

    const loadLeadInfo = async () => {
      try {
        const lead = await LeadsService.getLeadById(leadIdFromUrl)
        setLeads([lead])

        // 自动填充表单
        const classInContact = getClassInContactFromLead(lead)
        setFormData((prev) => ({
          ...prev,
          lead_id: lead.id,
          student_name: getLeadStudentAlias(lead),
          phone: classInContact,
          channel: getLeadChannel(lead),
          region: lead.region_ip || "",
          grade: lead.grade_code || "",
          trial_subject: getLeadFirstSubject(lead),
        }))

        toast({
          title: "线索信息已加载",
          description: classInContact
            ? "已自动填充线索单号、渠道和联系方式"
            : "已自动填充线索单号、渠道、年级和学科",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载线索失败",
          description: error.message || "无法加载线索信息",
        })
      }
    }

    loadLeadInfo()
  }, [leadIdFromUrl])

  // 从正式生详情创建新试听时，使用 student_id 作为来源。
  useEffect(() => {
    if (!studentIdFromUrl || leadIdFromUrl) return

    const loadStudentInfo = async () => {
      try {
        const student = await StudentsService.getStudentById(studentIdFromUrl)

        setFormData((prev) => ({
          ...prev,
          student_id: student.id,
          student_name: student.student_name || "",
          phone: student.parent_phone || "",
          channel: "正式生",
          region: student.region || "",
          grade: student.grade_code || "",
        }))

        toast({
          title: "正式生信息已加载",
          description: "已自动填充学生信息",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载正式生失败",
          description: error.message || "无法加载正式生信息",
        })
      }
    }

    loadStudentInfo()
  }, [studentIdFromUrl, leadIdFromUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const hasLeadSource = Boolean(leadIdFromUrl && formData.lead_id === leadIdFromUrl)
    const hasFormalStudentSource = Boolean(studentIdFromUrl && formData.student_id === studentIdFromUrl)

    if (!hasLeadSource && !hasFormalStudentSource) {
      toast({
        variant: "destructive",
        title: "无法创建试听",
        description: "试听课程必须从线索或正式生详情创建",
      })
      return
    }

    // 验证必填字段
    const requiredFields = [
      { field: 'student_name', name: '学生称呼' },
      { field: 'region', name: '地域' },
      { field: 'grade', name: '年级' },
      { field: 'trial_subject', name: '试听学科' },
      { field: 'trial_time', name: '试听时间' },
      { field: 'trial_duration', name: '试听时长' },
      { field: 'phone', name: '手机或邮箱' },
      { field: 'channel', name: '渠道' },
      { field: 'payment_proof', name: '付款凭证' },
    ]
    if (hasLeadSource) {
      requiredFields.unshift({ field: 'lead_id', name: '关联线索' })
    } else {
      requiredFields.unshift({ field: 'student_id', name: '来源正式生' })
    }

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
      // 先上传付款凭证文件
      let paymentProofUrl = formData.payment_proof
      if (uploadedFile) {
        try {
          setIsUploading(true)
          paymentProofUrl = await uploadPaymentProof(uploadedFile)
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

      const payload: NewTrialLesson = {
        child_name: formData.student_name.trim(),
        lead_id: formData.lead_id || undefined,
        student_id: formData.student_id || undefined,
        region: formData.region.trim(),
        grade: formData.grade.trim(),
        trial_subject: formData.trial_subject.trim(),
        trial_time: toChinaTimeISO(formData.trial_time), // 添加中国时区
        trial_duration: parseFloat(formData.trial_duration),
        phone: formData.phone.trim(),
        channel: formData.channel.trim(),
        trial_amount: formData.trial_amount ? parseFloat(formData.trial_amount) : undefined,
        payment_proof: paymentProofUrl,
        notes: formData.notes.trim() || undefined,
        course_status: formData.course_status || undefined,
        student_type: formData.student_type || undefined,
        matched_teacher: formData.matched_teacher || undefined,
      }

      const createdLesson = await TrialLessonsService.createTrialLesson(payload)

      if (createdLesson.classin_student_error) {
        toast({
          variant: "destructive",
          title: "试听已创建，ClassIn 学生账号创建失败",
          description: createdLesson.classin_student_error,
        })
      } else {
        toast({
          title: "创建成功",
          description: createdLesson.classin_student_uid || createdLesson.classin_student_bound
            ? "试听课程已创建，ClassIn 学生账号已绑定"
            : "试听课程已创建",
        })
      }

      router.push(studentIdFromUrl ? `/dashboard/students/${studentIdFromUrl}` : "/dashboard/trial-lessons")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建试听课程",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!leadIdFromUrl && !studentIdFromUrl) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="新增试听课程"
          description="试听课程必须从线索或正式生详情创建"
        />

        <div className="flex-1 overflow-auto p-6">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">缺少关联线索</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  请先在线索页面选择要转试听的线索，或从正式生详情中创建新试听。
                </p>
              </div>
              <div className="flex justify-end">
                <Link href="/dashboard/leads">
                  <Button type="button">返回线索页面</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const sourceLead = leads[0]
  const sourceLeadContact = sourceLead ? getLeadSourceContact(sourceLead) : ""
  const sourceLeadClassInContact = sourceLead ? getClassInContactFromLead(sourceLead) : ""

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增试听课程"
        description="填写试听课程信息以创建新的试听安排"
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
                    <Label htmlFor="student_name">
                      学生称呼 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="student_name"
                      placeholder="请输入学生称呼"
                      value={formData.student_name}
                      onChange={(e) => handleInputChange("student_name", e.target.value)}
                      required
                    />
                  </div>

                  {leadIdFromUrl ? (
                    <div className="space-y-2">
                      <Label htmlFor="lead_id">
                        关联线索 <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="lead_id"
                        value={formData.lead_id}
                        disabled
                        className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background"
                        required
                      >
                        <option value="">线索加载中...</option>
                        {leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.report_number} - {getLeadChannel(lead) || '无渠道'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="student_id">
                        来源正式生 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="student_id"
                        value={formData.student_name || "正式生信息加载中..."}
                        disabled
                        className="bg-muted"
                        required
                      />
                    </div>
                  )}
                </div>

                {sourceLead && (
                  <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">线索单号</p>
                      <p className="truncate font-medium">{sourceLead.report_number || "-"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">渠道</p>
                      <p className="truncate font-medium">{getLeadChannel(sourceLead) || "-"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">线索联系方式</p>
                      <p className="truncate font-medium">{sourceLeadContact || "-"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">客户社媒账号</p>
                      <p className="truncate font-medium">{sourceLead.customer_social_id || "-"}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      手机或邮箱 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      placeholder="请输入手机号或邮箱"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      required
                    />
                    {sourceLeadContact && !sourceLeadClassInContact && (
                      <p className="text-xs text-muted-foreground">
                        线索联系方式为 {sourceLeadContact}，请填写可用于 ClassIn 建号的手机号或邮箱。
                      </p>
                    )}
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
                    <select
                      id="region"
                      value={formData.region}
                      onChange={(e) => handleInputChange("region", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择地域</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.code}>
                          {region.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grade">
                      年级 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="grade"
                      value={formData.grade}
                      onChange={(e) => handleInputChange("grade", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择年级</option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.code}>
                          {grade.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trial_subject">
                      试听学科 <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="trial_subject"
                      value={formData.trial_subject}
                      onChange={(e) => handleInputChange("trial_subject", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择科目</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.code}>
                          {subject.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trial_duration">
                      试听时长(小时) <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="trial_duration"
                      value={formData.trial_duration}
                      onChange={(e) => handleInputChange("trial_duration", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      required
                    >
                      <option value="">请选择时长</option>
                      {trialDurations.map((duration) => (
                        <option key={duration.id} value={duration.code}>
                          {duration.label}
                        </option>
                      ))}
                    </select>
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
                    <Label>
                      付款凭证 <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className="relative inline-flex h-9 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadedFile ? "重新选择付款凭证" : "选择付款凭证"}
                        <input
                          id="payment_proof"
                          type="file"
                          accept={PAYMENT_PROOF_ACCEPT}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          onChange={(e) => handlePaymentProofChange(e.target.files?.[0], e.currentTarget)}
                          required
                        />
                      </label>
                      {uploadedFile && (
                        <span className="max-w-full truncate text-sm text-muted-foreground">
                          {uploadedFile.name}
                        </span>
                      )}
                    </div>
                    {(previewUrl || uploadedFile) && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">预览：</p>
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="付款凭证预览"
                            className="max-w-xs h-auto border rounded"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground break-all">
                            已选择: {uploadedFile?.name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 业务信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">业务信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="course_status">课程状态</Label>
                    <select
                      id="course_status"
                      value={formData.course_status}
                      onChange={(e) => handleInputChange("course_status", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择状态</option>
                      {courseStatuses.map((status) => (
                        <option key={status.id} value={status.code}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student_type">学生类型</Label>
                    <select
                      id="student_type"
                      value={formData.student_type}
                      onChange={(e) => handleInputChange("student_type", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择类型</option>
                      {studentTypes.map((type) => (
                        <option key={type.id} value={type.code}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <SearchableSelect
                    id="matched_teacher"
                    label="匹配老师"
                    placeholder="请输入老师姓名或科目搜索..."
                    value={selectedMatchedTeacherId}
                    onChange={(value) => {
                      setSelectedMatchedTeacherId(value)
                      const teacher = teachers.find(item => item.id === value)
                      handleInputChange("matched_teacher", teacher?.teacher_name || "")
                    }}
                    options={teachers.map((teacher) => ({
                      id: teacher.id,
                      name: [
                        teacher.teacher_name,
                        teacher.teacher_subject,
                        "已绑定ClassIn",
                      ].filter(Boolean).join(" - "),
                    }))}
                    loading={isLoadingTeachers}
                  />
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
