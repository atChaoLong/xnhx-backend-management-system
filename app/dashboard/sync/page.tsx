"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Users, UserCheck, CheckCircle, XCircle, RefreshCw, Save, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SyncResult {
  total: number
  success: number
  updated: number
  failed: number
  errors: Array<{ name: string; error: string }>
}

export default function SyncPage() {
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)
  const [limit, setLimit] = useState(100)
  const [cookie, setCookie] = useState("")
  const [teacherResult, setTeacherResult] = useState<SyncResult | null>(null)
  const [studentResult, setStudentResult] = useState<SyncResult | null>(null)

  // 从 localStorage 加载保存的 Cookie
  useEffect(() => {
    const savedCookie = localStorage.getItem('classin_cookie')
    if (savedCookie) {
      setCookie(savedCookie)
    }
  }, [])

  // 保存 Cookie 到 localStorage
  const handleSaveCookie = () => {
    localStorage.setItem('classin_cookie', cookie)
    toast({
      title: "保存成功",
      description: "Cookie 已保存到浏览器本地存储",
    })
  }

  // 清除 Cookie
  const handleClearCookie = () => {
    localStorage.removeItem('classin_cookie')
    setCookie("")
    toast({
      title: "已清除",
      description: "Cookie 已从浏览器本地存储中删除",
    })
  }

  // 同步老师
  const handleSyncTeachers = async () => {
    if (!cookie.trim()) {
      toast({
        variant: "destructive",
        title: "请先配置 Cookie",
        description: "请先在下方配置并保存 ClassIn Cookie",
      })
      return
    }

    setIsSyncing(true)
    setTeacherResult(null)

    try {
      const response = await fetch("/api/sync/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, cookie }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "同步老师失败")
      }

      setTeacherResult(data.data)

      toast({
        title: "同步完成",
        description: `成功: ${data.data.success}, 更新: ${data.data.updated}, 失败: ${data.data.failed}`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "同步失败",
        description: error.message || "无法同步老师数据",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // 同步学生
  const handleSyncStudents = async () => {
    if (!cookie.trim()) {
      toast({
        variant: "destructive",
        title: "请先配置 Cookie",
        description: "请先在下方配置并保存 ClassIn Cookie",
      })
      return
    }

    setIsSyncing(true)
    setStudentResult(null)

    try {
      const response = await fetch("/api/sync/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, cookie }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "同步学生失败")
      }

      setStudentResult(data.data)

      toast({
        title: "同步完成",
        description: `成功: ${data.data.success}, 更新: ${data.data.updated}, 失败: ${data.data.failed}`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "同步失败",
        description: error.message || "无法同步学生数据",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="数据同步"
        description="从 ClassIn 同步老师和学生数据到本地数据库"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 配置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>ClassIn 配置</CardTitle>
              <CardDescription>
                配置 ClassIn Cookie 以同步数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cookie 配置 */}
              <div className="space-y-2">
                <Label htmlFor="cookie">ClassIn Cookie</Label>
                <Textarea
                  id="cookie"
                  placeholder="粘贴从浏览器开发者工具中获取的 Cookie..."
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                  disabled={isSyncing}
                />
                <p className="text-xs text-muted-foreground">
                  从浏览器开发者工具 → Application → Cookies 中复制 dynamic.eeo.cn 的 Cookie
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveCookie}
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    保存 Cookie
                  </Button>
                  <Button
                    onClick={handleClearCookie}
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    清除
                  </Button>
                </div>
              </div>

              {/* 同步数量配置 */}
              <div className="space-y-2">
                <Label htmlFor="limit">同步数量限制</Label>
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  max="1000"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                  disabled={isSyncing}
                />
                <p className="text-xs text-muted-foreground">
                  每次同步的最大记录数（1-1000）
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 同步功能标签页 */}
          <Tabs defaultValue="teachers" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="teachers">
                <UserCheck className="mr-2 h-4 w-4" />
                同步老师
              </TabsTrigger>
              <TabsTrigger value="students">
                <Users className="mr-2 h-4 w-4" />
                同步学生
              </TabsTrigger>
            </TabsList>

            {/* 同步老师 */}
            <TabsContent value="teachers">
              <Card>
                <CardHeader>
                  <CardTitle>同步老师数据</CardTitle>
                  <CardDescription>
                    从 ClassIn 获取老师列表并同步到 teacher_profiles 表
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">数据映射说明</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• uid → classin_uid (唯一标识符)</li>
                      <li>• ClassIn 手机号 → classin_phone 和 mobile</li>
                      <li>• 老师姓名 → teacher_name</li>
                      <li>• 微信号 → wechat</li>
                      <li>• 地域 → location</li>
                      <li>• 学科 → subjects (数组)</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">同步策略</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 根据 ClassIn uid 判断是否已存在</li>
                      <li>• 已存在：更新记录</li>
                      <li>• 不存在：插入新记录</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleSyncTeachers}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        同步中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        开始同步老师数据
                      </>
                    )}
                  </Button>

                  {/* 同步结果 */}
                  {teacherResult && (
                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium">同步结果</h4>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{teacherResult.total}</div>
                          <div className="text-xs text-muted-foreground">总数</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{teacherResult.success}</div>
                          <div className="text-xs text-muted-foreground">新增</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{teacherResult.updated}</div>
                          <div className="text-xs text-muted-foreground">更新</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{teacherResult.failed}</div>
                          <div className="text-xs text-muted-foreground">失败</div>
                        </div>
                      </div>

                      {teacherResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-destructive">
                            错误详情 ({teacherResult.errors.length})
                          </h5>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {teacherResult.errors.map((error, index) => (
                              <div
                                key={index}
                                className="text-xs flex items-start gap-2 p-2 rounded bg-destructive/10"
                              >
                                <XCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="font-medium">{error.name}:</span>
                                  <span className="text-muted-foreground">{error.error}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {teacherResult.failed === 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-900">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium">同步成功完成！</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 同步学生 */}
            <TabsContent value="students">
              <Card>
                <CardHeader>
                  <CardTitle>同步学生数据</CardTitle>
                  <CardDescription>
                    从 ClassIn 获取学生列表并同步到 students 表
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">数据映射说明</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• uid → classin_uid (唯一标识符)</li>
                      <li>• studentName → student_name</li>
                      <li>• stuno → student_number</li>
                      <li>• mobile → mobile 和 parent_phone</li>
                      <li>• serveState → status (2=在籍/active)</li>
                      <li>• schoolUid, joinType, studId → 额外字段</li>
                      <li>• labelInfo, progressInfo → classin_extra (JSON)</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">同步策略</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 根据 ClassIn uid 判断是否已存在</li>
                      <li>• 已存在：更新记录</li>
                      <li>• 不存在：插入新记录</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleSyncStudents}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        同步中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        开始同步学生数据
                      </>
                    )}
                  </Button>

                  {/* 同步结果 */}
                  {studentResult && (
                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium">同步结果</h4>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{studentResult.total}</div>
                          <div className="text-xs text-muted-foreground">总数</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{studentResult.success}</div>
                          <div className="text-xs text-muted-foreground">新增</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{studentResult.updated}</div>
                          <div className="text-xs text-muted-foreground">更新</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{studentResult.failed}</div>
                          <div className="text-xs text-muted-foreground">失败</div>
                        </div>
                      </div>

                      {studentResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-destructive">
                            错误详情 ({studentResult.errors.length})
                          </h5>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {studentResult.errors.map((error, index) => (
                              <div
                                key={index}
                                className="text-xs flex items-start gap-2 p-2 rounded bg-destructive/10"
                              >
                                <XCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="font-medium">{error.name}:</span>
                                  <span className="text-muted-foreground">{error.error}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {studentResult.failed === 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-900">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium">同步成功完成！</span>
                        </div>
                      )}
                    </div>
                  )}
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
                <h4 className="font-semibold mb-2">获取 ClassIn Cookie</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>登录 ClassIn Web 端 (dynamic.eeo.cn)</li>
                  <li>打开浏览器开发者工具（F12）</li>
                  <li>进入 Application → Cookies</li>
                  <li>复制 dynamic.eeo.cn 的所有 Cookie</li>
                  <li>粘贴到上方 Cookie 输入框并保存</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">同步流程</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>配置并保存 ClassIn Cookie</li>
                  <li>从 ClassIn API 获取数据</li>
                  <li>检查本地数据库是否已存在</li>
                  <li>存在则更新，不存在则插入</li>
                  <li>显示同步结果和错误信息</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">注意事项</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cookie 保存在浏览器本地存储中，不会上传到服务器</li>
                  <li>同步数据会覆盖本地已存在的记录</li>
                  <li>建议首次同步前备份本地数据</li>
                  <li>Cookie 有效期约 2 小时，过期后需重新配置</li>
                  <li>ClassIn API 可能有请求限制，建议分批同步</li>
                  <li>uid 是 ClassIn 系统的唯一标识，用于准确去重</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
