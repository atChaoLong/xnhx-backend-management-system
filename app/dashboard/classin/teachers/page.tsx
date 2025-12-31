"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ClassInTeacher {
  uid: number
  name: string
  mobile?: string
  email?: string
  gender?: string
  school_uid?: number
  status?: string
  subject?: string
  is_del?: boolean
}

export default function ClassInTeachersPage() {
  const [teachers, setTeachers] = useState<ClassInTeacher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()

  // 加载老师数据
  const fetchTeachers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/classin/teachers')

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const { data } = await response.json()
      setTeachers(data || [])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 老师数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 同步老师数据
  const handleSync = async () => {
    try {
      setIsSyncing(true)
      const response = await fetch('/api/classin/sync/teachers', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('同步失败')
      }

      const { data } = await response.json()
      toast({
        title: "同步成功",
        description: `已同步 ${data?.count || 0} 条老师数据`,
      })
      fetchTeachers()
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

  useEffect(() => {
    fetchTeachers()
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 老师" description="管理 ClassIn 平台的老师数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 老师"
        description="管理 ClassIn 平台的老师数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">老师列表</h3>
                <p className="text-sm text-muted-foreground">共 {teachers.length} 名老师</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={fetchTeachers}
                  disabled={isLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  同步数据
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>性别</TableHead>
                    <TableHead>学科</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"同步数据"从 ClassIn 同步老师信息
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher.uid}>
                        <TableCell className="font-medium">{teacher.uid}</TableCell>
                        <TableCell>{teacher.name || "-"}</TableCell>
                        <TableCell>{teacher.mobile || "-"}</TableCell>
                        <TableCell>{teacher.email || "-"}</TableCell>
                        <TableCell>{teacher.gender || "-"}</TableCell>
                        <TableCell>{teacher.subject || "-"}</TableCell>
                        <TableCell>
                          {teacher.is_del ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              已删除
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {teacher.status || '正常'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
