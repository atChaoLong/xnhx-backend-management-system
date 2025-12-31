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
  st_id?: number
  name: string
  mobile?: string
  email?: string
  emp_no?: string
  position?: string
  account_status?: number
  is_del?: number
  sync_time?: string
}

export default function ClassInTeachersPage() {
  const [teachers, setTeachers] = useState<ClassInTeacher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // 加载老师数据
  const fetchTeachers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/classin/teachers')

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const result = await response.json()
      setTeachers(result.data || [])
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

  useEffect(() => {
    fetchTeachers()
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 老师" description="查看 ClassIn 平台的老师数据" />
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
        description="查看 ClassIn 平台的老师数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">老师列表</h3>
                <p className="text-sm text-muted-foreground">共 {teachers.length} 名老师</p>
              </div>
              <Button
                variant="outline"
                onClick={fetchTeachers}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>工号</TableHead>
                    <TableHead>手机号</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>职位</TableHead>
                    <TableHead>账号状态</TableHead>
                    <TableHead>最后同步</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher.uid}>
                        <TableCell className="font-medium">{teacher.uid}</TableCell>
                        <TableCell>{teacher.name || "-"}</TableCell>
                        <TableCell>{teacher.emp_no || "-"}</TableCell>
                        <TableCell>{teacher.mobile || "-"}</TableCell>
                        <TableCell>{teacher.email || "-"}</TableCell>
                        <TableCell>{teacher.position || "-"}</TableCell>
                        <TableCell>
                          {teacher.is_del === 1 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              已删除
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              正常
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {teacher.sync_time ? new Date(teacher.sync_time).toLocaleString('zh-CN') : '-'}
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
