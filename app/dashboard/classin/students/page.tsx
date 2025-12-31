"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ClassInStudent {
  uid: number
  stud_id?: number
  name: string
  mobile?: string
  email?: string
  account_status?: number
  serve_state?: number
  is_del?: number
  stuno?: string
  sync_time?: string
}

export default function ClassInStudentsPage() {
  const [students, setStudents] = useState<ClassInStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // 加载学生数据
  const fetchStudents = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/classin/students')

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const result = await response.json()
      setStudents(result.data || [])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 学生数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 学生" description="查看 ClassIn 平台的学生数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 学生"
        description="查看 ClassIn 平台的学生数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">学生列表</h3>
                <p className="text-sm text-muted-foreground">共 {students.length} 名学生</p>
              </div>
              <Button
                variant="outline"
                onClick={fetchStudents}
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
                    <TableHead>手机号</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>学号</TableHead>
                    <TableHead>账号状态</TableHead>
                    <TableHead>最后同步</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.uid}>
                        <TableCell className="font-medium">{student.uid}</TableCell>
                        <TableCell>{student.name || "-"}</TableCell>
                        <TableCell>{student.mobile || "-"}</TableCell>
                        <TableCell>{student.email || "-"}</TableCell>
                        <TableCell>{student.stuno || "-"}</TableCell>
                        <TableCell>
                          {student.is_del === 1 ? (
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
                          {student.sync_time ? new Date(student.sync_time).toLocaleString('zh-CN') : '-'}
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
