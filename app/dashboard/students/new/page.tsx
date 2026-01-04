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
  const [isRegisteringClassIn, setIsRegisteringClassIn] = useState(false)
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
    student_name: "",
    student_number: "",
    grade_code: "",
    region: "",
    school: "",
    parent_phone: "",
    status: "active",
    // ClassIn 相关字段
    classin_password: "",
    register_to_classin: false,
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
    if (!formData.student_name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入学生姓名",
      })
      return
    }

    // 如果要注册到 ClassIn，验证必填字段
    if (formData.register_to_classin) {
      if (!formData.parent_phone?.trim()) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: "注册到 ClassIn 需要填写家长电话",
        })
        return
      }
      if (!formData.classin_password?.trim()) {
        toast({
          variant: "destructive",
          title: "验证失败",
          description: "注册到 ClassIn 需要设置密码",
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      const payload: NewStudent = {
        student_name: formData.student_name.trim(),
        student_number: formData.student_number.trim() || undefined,
        grade_code: formData.grade_code || undefined,
        region: formData.region || undefined,
        school: formData.school.trim() || undefined,
        parent_phone: formData.parent_phone.trim() || undefined,
        status: formData.status || "active",
      }

      const student = await StudentsService.createStudent(payload)
      setCreatedStudentId(student.id)

      toast({
        title: "创建成功",
        description: "学生已创建",
      })

      // 如果需要注册到 ClassIn
      if (formData.register_to_classin) {
        await handleRegisterToClassIn(student.id)
      } else {
        router.push("/dashboard/students")
      }
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

  // 注册到 ClassIn
  const handleRegisterToClassIn = async (studentId: string) => {
    setIsRegisteringClassIn(true)

    try {
      const token = localStorage.getItem('supabase.auth.token')
      
      const response = await fetch('/api/students/register-classin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId,
          telephone: formData.parent_phone,
          nickname: formData.student_name,
          password: formData.classin_password,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '注册到 ClassIn 失败' }))
        throw new Error(error.error || '注册到 ClassIn 失败')
      }

      const result = await response.json()

      toast({
        title: "ClassIn 注册成功",
        description: `学生已注册到 ClassIn 系统，UID: ${result.data.uid}`,
      })

      router.push("/dashboard/students")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ClassIn 注册失败",
        description: error.message || "无法注册到 ClassIn",
      })
      // 即使注册失败，也跳转到列表页（因为学生已创建）
      router.push("/dashboard/students")
    } finally {
      setIsRegisteringClassIn(false)
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

                {/* ClassIn 集成 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">ClassIn 集成</h3>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="register_to_classin"
                      checked={formData.register_to_classin}
                      onChange={(e) => handleInputChange("register_to_classin", e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="register_to_classin" className="cursor-pointer">
                      同时注册到 ClassIn 系统
                    </Label>
                  </div>

                  {formData.register_to_classin && (
                    <div className="space-y-4 pl-6 border-l-2 border-muted">
                      <p className="text-sm text-muted-foreground">
                        注册到 ClassIn 需要以下信息：
                      </p>

                      <div className="space-y-2">
                        <Label htmlFor="classin_password">
                          ClassIn 密码 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="classin_password"
                          type="password"
                          placeholder="请输入 ClassIn 登录密码"
                          value={formData.classin_password}
                          onChange={(e) => handleInputChange("classin_password", e.target.value)}
                          required={formData.register_to_classin}
                        />
                        <p className="text-xs text-muted-foreground">
                          密码将用于学生在 ClassIn 系统的登录
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Link href="/dashboard/students">
                    <Button type="button" variant="outline" disabled={isSubmitting || isRegisteringClassIn}>
                      取消
                    </Button>
                  </Link>
                  <Button type="submit" disabled={isSubmitting || isRegisteringClassIn}>
                    {isRegisteringClassIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        注册到 ClassIn 中...
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
