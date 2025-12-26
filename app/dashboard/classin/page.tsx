"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ClassInIntegrationPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [cookie, setCookie] = useState("")
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [teacherCount, setTeacherCount] = useState<number>(0)
  const [studentCount, setStudentCount] = useState<number>(0)

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
    setStatus("idle")

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

      // 获取老师列表
      const teachersResponse = await fetch("/api/classin/teachers")
      if (!teachersResponse.ok) {
        throw new Error("获取老师列表失败")
      }

      const teachersData = await teachersResponse.json()
      setTeacherCount(teachersData.data?.total || 0)

      // 获取学生列表
      const studentsResponse = await fetch("/api/classin/students")
      if (!studentsResponse.ok) {
        throw new Error("获取学生列表失败")
      }

      const studentsData = await studentsResponse.json()
      setStudentCount(studentsData.data?.total || 0)

      setStatus("success")

      toast({
        title: "连接成功",
        description: `成功连接到 ClassIn API！老师: ${teachersData.data?.total || 0} 人, 学生: ${studentsData.data?.total || 0} 人`,
      })
    } catch (error: any) {
      setStatus("error")
      toast({
        variant: "destructive",
        title: "连接失败",
        description: error.message || "无法连接到 ClassIn API",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 集成"
        description="配置和测试 ClassIn API 连接"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 连接配置 */}
          <Card>
            <CardHeader>
              <CardTitle>API 连接配置</CardTitle>
              <CardDescription>
                从浏览器开发者工具中获取 Cookie 并输入进行连接测试
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
                <p className="text-xs text-muted-foreground">
                  在浏览器中登录 console.eeo.cn，打开开发者工具（F12），Application → Cookies → console.eeo.cn，复制所有 Cookie
                </p>
              </div>

              <Button
                onClick={handleTestConnection}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    测试连接中...
                  </>
                ) : (
                  "测试连接"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 连接状态 */}
          {status !== "idle" && (
            <Card>
              <CardHeader>
                <CardTitle>连接状态</CardTitle>
              </CardHeader>
              <CardContent>
                {status === "success" ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <div className="font-semibold text-green-900 dark:text-green-100">
                        连接成功
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        老师总数: {teacherCount} 人 | 学生总数: {studentCount} 人
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                      <div className="font-semibold text-red-900 dark:text-red-100">
                        连接失败
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300">
                        请检查 Cookie 是否正确，或者是否已过期
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">1. 获取 Cookie</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>在浏览器中打开 <code>console.eeo.cn</code> 并登录</li>
                  <li>按 F12 打开开发者工具</li>
                  <li>切换到 Application 标签</li>
                  <li>左侧菜单中选择 Cookies → https://console.eeo.cn</li>
                  <li>复制所有 Cookie（格式：name1=value1; name2=value2; ...）</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">2. 可用的 API</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>GET /api/classin/teachers - 获取老师列表</li>
                  <li>GET /api/classin/students - 获取学生列表</li>
                  <li>POST /api/classin/login - 使用 Cookie 登录</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">3. 注意事项</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cookie 有效期约为 2 小时，过期后需要重新获取</li>
                  <li>请勿泄露您的 Cookie 信息</li>
                  <li>建议在生产环境中使用后端代理 API 请求</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
