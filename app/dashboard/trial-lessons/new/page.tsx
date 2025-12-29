"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { TrialLessonsService, NewTrialLesson } from "@/lib/services/trialLessons"
import { LeadsService } from "@/lib/services/leads"
import { getDictionaryItems } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewTrialLessonPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 字典数据
  const [regions, setRegions] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [trialDurations, setTrialDurations] = useState<any[]>([])

  // 老师列表
  const [teachers, setTeachers] = useState<any[]>([])

  // 线索列表
  const [leads, setLeads] = useState<any[]>([])

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

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

    // 业务信息
    notes: "",
    assigned_consultant: "",
    course_status: "",
    student_type: "",

    // 教务信息
    matched_teacher: "",
    confirmed_teacher: "",
  })

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 加载字典数据
  useEffect(() => {
    const loadData = async () => {
      const [regionData, gradeData, subjectData, trialDurationData, classinTeachersData, leadsData] = await Promise.all([
        getDictionaryItems('province'),
        getDictionaryItems('grade'),
        getDictionaryItems('subject'),
        getDictionaryItems('class_duration'),
        fetch('/api/teachers/classin').then(res => res.json()).then(data => data.success ? data.data : []),
        LeadsService.getLeads(),
      ])
      setRegions(regionData)
      setGrades(gradeData)
      setSubjects(subjectData)
      setTrialDurations(trialDurationData)
      setTeachers(classinTeachersData)
      setLeads(leadsData)
    }
    loadData()
  }, [])

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
      const payload: NewTrialLesson = {
        child_name: formData.child_name.trim(),
        status: formData.status,
        lead_id: formData.lead_id || undefined,
        region: formData.region.trim(),
        grade: formData.grade.trim(),
        trial_subject: formData.trial_subject.trim(),
        trial_time: formData.trial_time,
        trial_duration: parseFloat(formData.trial_duration),
        phone: formData.phone.trim(),
        channel: formData.channel.trim(),
        trial_amount: formData.trial_amount ? parseFloat(formData.trial_amount) : undefined,
        payment_proof: formData.payment_proof, // 文件上传后需要获取实际URL
        notes: formData.notes.trim() || undefined,
        assigned_consultant: formData.assigned_consultant.trim() || undefined,
        course_status: formData.course_status || undefined,
        student_type: formData.student_type || undefined,
        matched_teacher: formData.matched_teacher.trim() || undefined,
        confirmed_teacher: formData.confirmed_teacher || undefined, // 从老师列表选择，不需要trim
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
                      试听科目 <span className="text-destructive">*</span>
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
                          // 暂时使用文件名作为占位符，实际需要上传后获取URL
                          handleInputChange("payment_proof", file.name)
                        }
                      }}
                      required
                    />
                    {uploadedFile && (
                      <p className="text-xs text-muted-foreground">
                        已选择: {uploadedFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 状态 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">状态</h3>

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
                    <select
                      id="course_status"
                      value={formData.course_status}
                      onChange={(e) => handleInputChange("course_status", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择状态</option>
                      <option value="待排课">待排课</option>
                      <option value="已排课">已排课</option>
                      <option value="进行中">进行中</option>
                      <option value="已完成">已完成</option>
                      <option value="已取消">已取消</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student_type">学生类型</Label>
                    <select
                      id="student_type"
                      value={formData.student_type}
                      onChange={(e) => handleInputChange("student_type", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">请选择类型</option>
                      <option value="新生">新生</option>
                      <option value="老生">老生</option>
                      <option value="转介绍">转介绍</option>
                    </select>
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
                  <select
                    id="confirmed_teacher"
                    value={formData.confirmed_teacher}
                    onChange={(e) => handleInputChange("confirmed_teacher", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">请选择确认老师（需已绑定ClassIn）</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.teacher_name}>
                        {teacher.teacher_name} {teacher.teacher_subject ? `(${teacher.teacher_subject})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    仅显示已绑定 ClassIn 的教师
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/trial-lessons">
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
