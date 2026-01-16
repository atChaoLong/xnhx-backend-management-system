"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { TeachersService, Teacher } from "@/lib/services/teachers"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function EditTeacherPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [teacher, setTeacher] = useState<Teacher | null>(null)

  const teacherId = params.id as string

  const [formData, setFormData] = useState({
    // 基本信息
    teacher_name: "",
    gender: "",
    wechat: "",
    classin_phone: "",
    location: "",

    // 教学信息
    subjects: "",
    grade_levels: "",
    used_classin: false,
    has_certificate: false,

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

  // 加载老师数据
  useEffect(() => {
    const fetchTeacher = async () => {
      try {
        setIsLoading(true)
        const data = await TeachersService.getTeacherById(teacherId)
        setTeacher(data)

        // 设置表单数据
        setFormData({
          teacher_name: data.teacher_name || "",
          gender: data.gender || "",
          wechat: data.wechat || "",
          classin_phone: data.classin_phone || "",
          location: data.location || "",
          subjects: data.subjects?.join(", ") || "",
          grade_levels: data.grade_levels?.join(", ") || "",
          used_classin: data.used_classin || false,
          has_certificate: data.has_certificate || false,
          education: data.education || "",
          university: data.university || "",
          teaching_years: data.teaching_years?.toString() || "",
          teaching_style: data.teaching_style || "",
          success_cases: data.success_cases || "",
          notes: data.notes || "",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载老师数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchTeacher()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    const requiredFields = [
      { field: 'teacher_name', name: '姓名' },
      { field: 'gender', name: '性别' },
      { field: 'wechat', name: '微信号' },
      { field: 'classin_phone', name: 'Classin手机号' },
      { field: 'location', name: '所在地' },
      { field: 'subjects', name: '学科' },
      { field: 'grade_levels', name: '年级段' },
      { field: 'education', name: '学历' },
      { field: 'university', name: '毕业院校' },
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
      const payload = {
        id: teacherId,
        name: formData.teacher_name.trim(),
        gender: formData.gender,
        wechat: formData.wechat.trim(),
        classin_phone: formData.classin_phone.trim(),
        location: formData.location.trim(),
        subjects: formData.subjects.split(',').map(s => s.trim()).filter(s => s),
        grade_levels: formData.grade_levels.split(',').map(s => s.trim()).filter(s => s),
        used_classin: formData.used_classin,
        has_certificate: formData.has_certificate,
        education: formData.education,
        university: formData.university,
        teaching_years: formData.teaching_years ? parseInt(formData.teaching_years) : null,
        teaching_style: formData.teaching_style || null,
        success_cases: formData.success_cases || null,
        notes: formData.notes || null,
      }

      await TeachersService.updateTeacher(payload)

      toast({
        title: "保存成功",
        description: "老师信息已更新",
      })

      router.push("/dashboard/teachers")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新老师",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑老师" description="修改老师信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑老师" description="修改老师信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">老师不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该老师信息</p>
            <Link href="/dashboard/teachers">
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
        title="编辑老师"
        description="修改老师信息（核心字段）"
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
                    <Label htmlFor="teacher_name">
                      姓名 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="teacher_name"
                      placeholder="请输入姓名"
                      value={formData.teacher_name}
                      onChange={(e) => handleInputChange("teacher_name", e.target.value)}
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
              </div>

              {/* 教学信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">教学信息</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subjects">
                      学科（逗号分隔） <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="subjects"
                      placeholder="例如：数学,英语,物理"
                      value={formData.subjects}
                      onChange={(e) => handleInputChange("subjects", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grade_levels">
                      年级段（逗号分隔） <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="grade_levels"
                      placeholder="例如：小学,初中,高中"
                      value={formData.grade_levels}
                      onChange={(e) => handleInputChange("grade_levels", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="used_classin"
                      checked={formData.used_classin}
                      onCheckedChange={(checked) => handleInputChange("used_classin", checked as boolean)}
                    />
                    <Label htmlFor="used_classin" className="cursor-pointer">
                      用过Classin
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_certificate"
                      checked={formData.has_certificate}
                      onCheckedChange={(checked) => handleInputChange("has_certificate", checked as boolean)}
                    />
                    <Label htmlFor="has_certificate" className="cursor-pointer">
                      有教资证
                    </Label>
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
                      <option value="高中">高中</option>
                      <option value="大专">大专</option>
                      <option value="本科">本科</option>
                      <option value="硕士">硕士</option>
                      <option value="博士">博士</option>
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
                  <Label htmlFor="teaching_years">教学年限（年）</Label>
                  <Input
                    id="teaching_years"
                    type="number"
                    placeholder="请输入教学年限"
                    value={formData.teaching_years}
                    onChange={(e) => handleInputChange("teaching_years", e.target.value)}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teaching_style">教学特点</Label>
                  <Textarea
                    id="teaching_style"
                    placeholder="请描述教学特点"
                    value={formData.teaching_style}
                    onChange={(e) => handleInputChange("teaching_style", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="success_cases">优秀学员提分案例</Label>
                  <Textarea
                    id="success_cases"
                    placeholder="请描述优秀学员提分案例"
                    value={formData.success_cases}
                    onChange={(e) => handleInputChange("success_cases", e.target.value)}
                    rows={3}
                  />
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
