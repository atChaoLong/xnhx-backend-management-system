"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { StudentsService, Student } from "@/lib/services/students"
import { DictionaryService } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function EditStudentPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [student, setStudent] = useState<Student | null>(null)

  const studentId = params.id as string

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
  }>({
    grades: [],
    regions: [],
  })

  const [formData, setFormData] = useState({
    student_name: "",
    student_number: "",
    grade_code: "",
    region: "",
    school: "",
    parent_phone: "",
    head_teacher_id: "",
    status: "active",
  })

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getAllDictionaries()

        setDictOptions({
          grades: dicts.grade || [],
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

  // 加载学生数据
  useEffect(() => {
    const fetchStudent = async () => {
      try {
        setIsLoading(true)
        const data = await StudentsService.getStudentById(studentId)
        setStudent(data)

        // 设置表单数据
        setFormData({
          student_name: data.student_name || "",
          student_number: data.student_number || "",
          grade_code: data.grade_code || "",
          region: data.region || "",
          school: data.school || "",
          parent_phone: data.parent_phone || "",
          head_teacher_id: data.head_teacher_id || "",
          status: data.status || "active",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载学生数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStudent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.student_name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入学生姓名",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        id: studentId,
        student_name: formData.student_name.trim(),
        student_number: formData.student_number.trim() || undefined,
        grade_code: formData.grade_code || undefined,
        region: formData.region || undefined,
        school: formData.school.trim() || undefined,
        parent_phone: formData.parent_phone.trim() || undefined,
        head_teacher_id: formData.head_teacher_id || undefined,
        status: formData.status || "active",
      }

      await StudentsService.updateStudent(payload)

      toast({
        title: "保存成功",
        description: "学生信息已更新",
      })

      router.push("/dashboard/students")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error.message || "无法更新学生",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || isLoadingDict) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑学生" description="修改学生信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex flex-col h-full">
        <Header title="编辑学生" description="修改学生信息" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">学生不存在</h2>
            <p className="text-muted-foreground mb-4">未找到该学生信息</p>
            <Link href="/dashboard/students">
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
        title="编辑学生"
        description="修改学生信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>

                <div className="space-y-2">
                  <Label htmlFor="student_name">
                    学生姓名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="student_name"
                    placeholder="请输入学生姓名"
                    value={formData.student_name}
                    onChange={(e) => handleInputChange("student_name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student_number">学号</Label>
                  <Input
                    id="student_number"
                    placeholder="请输入学号"
                    value={formData.student_number}
                    onChange={(e) => handleInputChange("student_number", e.target.value)}
                  />
                </div>

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
                    <Label htmlFor="region">地域</Label>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school">学校</Label>
                  <Input
                    id="school"
                    placeholder="请输入学校名称"
                    value={formData.school}
                    onChange={(e) => handleInputChange("school", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent_phone">家长电话</Label>
                  <Input
                    id="parent_phone"
                    placeholder="请输入家长电话"
                    value={formData.parent_phone}
                    onChange={(e) => handleInputChange("parent_phone", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">状态</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">正常</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/dashboard/students">
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
