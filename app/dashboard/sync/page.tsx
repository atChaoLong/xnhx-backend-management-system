"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Users, UserCheck, CheckCircle, XCircle, RefreshCw } from "lucide-react"
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
  const [teacherResult, setTeacherResult] = useState<SyncResult | null>(null)
  const [studentResult, setStudentResult] = useState<SyncResult | null>(null)

  // 同步老师
  const handleSyncTeachers = async () => {
    setIsSyncing(true)
    setTeacherResult(null)

    try {
      const response = await fetch("/api/sync/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
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
    setIsSyncing(true)
    setStudentResult(null)

    try {
      const response = await fetch("/api/sync/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
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
              <CardTitle>同步配置</CardTitle>
              <CardDescription>
                配置同步参数和数据来源
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label>数据来源</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
                    <span className="text-sm">ClassIn API (dynamic.eeo.cn)</span>
                  </div>
                </div>
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
                      <li>• 根据 classin_phone 判断是否已存在</li>
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
                      <li>• 学号 → student_number</li>
                      <li>• 学生姓名 → student_name</li>
                      <li>• 年级 → grade_code</li>
                      <li>• 地域 → region</li>
                      <li>• 学校 → school</li>
                      <li>• 手机号 → mobile 和 parent_phone</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">同步策略</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 根据 student_number 判断是否已存在</li>
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
                <h4 className="font-semibold mb-2">同步流程</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>从 ClassIn API 获取数据</li>
                  <li>检查本地数据库是否已存在</li>
                  <li>存在则更新，不存在则插入</li>
                  <li>显示同步结果和错误信息</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">注意事项</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>同步数据会覆盖本地已存在的记录</li>
                  <li>建议首次同步前备份本地数据</li>
                  <li> ClassIn API 可能有请求限制，建议分批同步</li>
                  <li>如遇到大量失败，请检查网络连接和 API 配置</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">字段映射说明</h4>
                <div className="space-y-2 text-muted-foreground">
                  <div>
                    <span className="font-medium">老师数据:</span> classin_phone → mobile（自动复制）
                  </div>
                  <div>
                    <span className="font-medium">学生数据:</span> mobile → parent_phone（如果 parent_phone 为空）
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
