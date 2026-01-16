"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { TrialLessonsService, NewTrialLesson } from "@/lib/services/trialLessons"
import { LeadsService } from "@/lib/services/leads"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import { uploadPaymentProof } from "@/lib/services/upload"
import Link from "next/link"

export default function NewTrialLessonPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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
  const [leads, setLeads] = useState<any[]>([])

  const [formData, setFormData] = useState({
    // 基本信息
    student_name: "",
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

    // 业务信息
    notes: "",
    course_status: "",
    student_type: "",
    matched_teacher: "",
  })

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 加载线索数据
  useEffect(() => {
    const loadLeads = async () => {
      const leadsResult = await LeadsService.getLeads()
      setLeads(leadsResult.data || [])
    }
    loadLeads()
  }, [])

  // 从 URL 参数加载线索信息并自动填充
  useEffect(() => {
    const leadIdFromUrl = searchParams.get('lead_id')
    if (!leadIdFromUrl) return

    const loadLeadInfo = async () => {
      try {
        const lead = await LeadsService.getLeadById(leadIdFromUrl)

        // 自动填充表单
        setFormData((prev) => ({
          ...prev,
          lead_id: lead.id,
          student_name: lead.parent_wechat || "", // 使用家长微信作为学生称呼
          phone: lead.parent_wechat || "",
          region: lead.region_ip || "",
          grade: lead.grade_code || "",
          trial_subject: lead.subject_codes?.[0] || "", // 取第一个学科
        }))

        toast({
          title: "线索信息已加载",
          description: `已自动填充线索信息`,
        })
      } catch (error: any) {
        console.error('加载线索信息失败:', error)
        toast({
          variant: "destructive",
          title: "加载线索失败",
          description: error.message || "无法加载线索信息",
        })
      }
    }

    loadLeadInfo()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
        region: formData.region.trim(),
        grade: formData.grade.trim(),
        trial_subject: formData.trial_subject.trim(),
        trial_time: formData.trial_time,
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

      await TrialLessonsService.createTrialLesson(payload)

      toast({
        title: "创建成功",
        description: "试听课程已创建",
      })

      router.push("/dashboard/trial-lessons")
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

                  <div className="space-y-2">
                    <Label htmlFor="lead_id">关联线索</Label>
                    <select
                      id="lead_id"
                      value={formData.lead_id}
                      onChange={(e) => handleInputChange("lead_id", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择关联线索</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.report_number} - {lead.parent_wechat || '无微信'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                      required
                    />
                    {previewUrl && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">预览：</p>
                        <img
                          src={previewUrl}
                          alt="付款凭证预览"
                          className="max-w-xs h-auto border rounded"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          已选择: {uploadedFile?.name}
                        </p>
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
                  <Label htmlFor="matched_teacher">匹配老师</Label>
                  <Input
                    id="matched_teacher"
                    placeholder="请输入匹配老师"
                    value={formData.matched_teacher}
                    onChange={(e) => handleInputChange("matched_teacher", e.target.value)}
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
