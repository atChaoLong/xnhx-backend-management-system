"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, XCircle, UserPlus, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ClassInTestPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [cookie, setCookie] = useState("")
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")

  // 添加老师表单
  const [teacherForm, setTeacherForm] = useState({
    name: "",
    mobile: "",
    email: "",
    subject: "",
    autoRegister: 1,
  })

  // 添加学生表单
  const [studentForm, setStudentForm] = useState({
    name: "",
    mobile: "",
    email: "",
    stuno: "",
    autoRegister: 1,
  })

  // 测试连接
  const handleTestConnection = async () => {
    if (!cookie.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入 Cookie",
      })
      return
    }

    setIsLoading(true)
    setConnectionStatus("idle")

    try {
      // 测试登录
      const loginResponse = await fetch("/api/classin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie }),
      })

      if (!loginResponse.ok) {
        throw new Error("登录失败")
      }

      const loginData = await loginResponse.json()
      if (!loginData.success) {
        throw new Error(loginData.error || "登录失败")
      }

      setConnectionStatus("success")
      toast({
        title: "连接成功",
        description: "已成功连接到 ClassIn API",
      })
    } catch (error: any) {
      setConnectionStatus("error")
      toast({
        variant: "destructive",
        title: "连接失败",
        description: error.message || "无法连接到 ClassIn API",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 添加老师
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cookie.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请先配置 Cookie 并测试连接",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/classin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "添加老师失败")
      }

      if (!data.success) {
        throw new Error(data.error || "添加老师失败")
      }

      toast({
        title: "添加成功",
        description: `老师 "${teacherForm.name}" 已成功添加`,
      })

      // 重置表单
      setTeacherForm({
        name: "",
        mobile: "",
        email: "",
        subject: "",
        autoRegister: 1,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "添加失败",
        description: error.message || "无法添加老师",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 添加学生
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cookie.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请先配置 Cookie 并测试连接",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/classin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "添加学生失败")
      }

      if (!data.success) {
        throw new Error(data.error || "添加学生失败")
      }

      toast({
        title: "添加成功",
        description: `学生 "${studentForm.name}" 已成功添加`,
      })

      // 重置表单
      setStudentForm({
        name: "",
        mobile: "",
        email: "",
        stuno: "",
        autoRegister: 1,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "添加失败",
        description: error.message || "无法添加学生",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn API 测试"
        description="测试添加老师和学生的功能"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Cookie 配置 */}
          <Card>
            <CardHeader>
              <CardTitle>API 连接配置</CardTitle>
              <CardDescription>
                配置 ClassIn Cookie 以测试 API 功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cookie">ClassIn Cookie</Label>
                <Textarea
                  id="cookie"
                  placeholder="粘贴从浏览器开发者工具中获取的 Cookie..."
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      测试中...
                    </>
                  ) : (
                    "测试连接"
                  )}
                </Button>
              </div>

              {/* 连接状态 */}
              {connectionStatus !== "idle" && (
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  {connectionStatus === "success" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        连接成功
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-900">
                        连接失败，请检查 Cookie 是否正确
                      </span>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 添加老师和学生 */}
          <Tabs defaultValue="teacher" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="teacher">
                <UserPlus className="mr-2 h-4 w-4" />
                添加老师
              </TabsTrigger>
              <TabsTrigger value="student">
                <Users className="mr-2 h-4 w-4" />
                添加学生
              </TabsTrigger>
            </TabsList>

            {/* 添加老师表单 */}
            <TabsContent value="teacher">
              <Card>
                <CardHeader>
                  <CardTitle>添加老师</CardTitle>
                  <CardDescription>
                    填写老师信息并添加到 ClassIn 系统
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddTeacher} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="teacher-name">
                          姓名 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="teacher-name"
                          placeholder="请输入老师姓名"
                          value={teacherForm.name}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="teacher-mobile">
                          手机号 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="teacher-mobile"
                          type="tel"
                          placeholder="请输入手机号"
                          value={teacherForm.mobile}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, mobile: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="teacher-email">邮箱</Label>
                        <Input
                          id="teacher-email"
                          type="email"
                          placeholder="请输入邮箱"
                          value={teacherForm.email}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, email: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="teacher-subject">科目</Label>
                        <Input
                          id="teacher-subject"
                          placeholder="例如：数学、语文、英语"
                          value={teacherForm.subject}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, subject: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            添加中...
                          </>
                        ) : (
                          "添加老师"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 添加学生表单 */}
            <TabsContent value="student">
              <Card>
                <CardHeader>
                  <CardTitle>添加学生</CardTitle>
                  <CardDescription>
                    填写学生信息并添加到 ClassIn 系统
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddStudent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="student-name">
                          姓名 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="student-name"
                          placeholder="请输入学生姓名"
                          value={studentForm.name}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="student-mobile">
                          手机号 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="student-mobile"
                          type="tel"
                          placeholder="请输入手机号"
                          value={studentForm.mobile}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, mobile: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="student-email">邮箱</Label>
                        <Input
                          id="student-email"
                          type="email"
                          placeholder="请输入邮箱"
                          value={studentForm.email}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, email: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="student-stuno">学号</Label>
                        <Input
                          id="student-stuno"
                          placeholder="请输入学号"
                          value={studentForm.stuno}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, stuno: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            添加中...
                          </>
                        ) : (
                          "添加学生"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">测试流程</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>配置 ClassIn Cookie</li>
                  <li>点击"测试连接"验证 API 可用性</li>
                  <li>在"添加老师"或"添加学生"标签页填写信息</li>
                  <li>点击"添加"按钮提交数据</li>
                  <li>查看操作结果</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">可用接口</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>GET /api/classin/teachers - 获取老师列表</li>
                  <li>POST /api/classin/teachers - 添加老师</li>
                  <li>GET /api/classin/students - 获取学生列表</li>
                  <li>POST /api/classin/students - 添加学生</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">注意事项</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cookie 有效期约为 2 小时</li>
                  <li>手机号为必填项</li>
                  <li>添加前请先测试连接</li>
                  <li>所有操作都会实时调用 ClassIn API</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
