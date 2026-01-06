"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { StudentsService, NewStudent } from "@/lib/services/students"
import { DictionaryService } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function NewStudentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdStudentId, setCreatedStudentId] = useState<string>("")
  const [isLoadingDict, setIsLoadingDict] = useState(true)

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    grades: Array<{ code: string; label: string }>
    regions: Array<{ code: string; label: string }>
  }>({
    grades: [],
    regions: [],
  })

  const [formData, setFormData] = useState({
    student_code: "",
    student_name: "",
    grade_code: "",
    region: "",
    school: "",
    parent_phone: "",
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填字段
    if (!formData.student_code.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入学生编号（学号）",
      })
      return
    }
    if (!formData.student_name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入学生姓名",
      })
      return
    }

    // 始终注册到 ClassIn，需要家长电话
    if (!formData.parent_phone?.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写家长电话（用于 ClassIn 注册）",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload: NewStudent = {
        student_code: formData.student_code.trim(),
        student_name: formData.student_name.trim(),
        grade_code: formData.grade_code || undefined,
        region: formData.region || undefined,
        school: formData.school.trim() || undefined,
        parent_phone: formData.parent_phone.trim() || undefined,
      }

      const student = await StudentsService.createStudent(payload)
      setCreatedStudentId(student.id)

      toast({
        title: "创建成功",
        description: "学生已创建",
      })

      // 后端自动注册到 ClassIn，直接返回列表
      router.push("/dashboard/students")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建学生",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

 

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增学生"
        description="填写学生信息以创建新的学生记录"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            {isLoadingDict ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">基本信息</h3>

                  <div className="space-y-2">
                    <Label htmlFor="student_code">
                      学号 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="student_code"
                      placeholder="请输入学生编号（学号）"
                      value={formData.student_code}
                      onChange={(e) => handleInputChange("student_code", e.target.value)}
                      required
                    />
                  </div>

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
                        提交中...
                      </>
                    ) : (
                      "提交"
                    )}
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
