"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ClassInClassroom {
  class_id: number
  name: string
  course_id?: number
  course_name?: string
  class_status?: number
  class_type?: number
  start_time?: number
  end_time?: number
  stu_num?: number
  audit_num?: number
  teacher?: any
  sync_time?: string
}

export default function ClassInIntegrationPage() {
  const [classrooms, setClassrooms] = useState<ClassInClassroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // 加载课堂数据
  const fetchClassrooms = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/classin/classrooms')

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const result = await response.json()
      setClassrooms(result.data || [])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 课堂数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClassrooms()
  }, [])

  // 格式化时间戳
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }

  // 获取课堂状态文本
  const getClassStatusText = (status?: number) => {
    const statusMap: Record<number, string> = {
      0: '未开始',
      1: '进行中',
      2: '已结束',
    }
    return statusMap[status || 0] || '未知'
  }

  // 获取课堂状态样式
  const getClassStatusStyle = (status?: number) => {
    const styleMap: Record<number, string> = {
      0: 'bg-gray-100 text-gray-800',
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
    }
    return styleMap[status || 0] || 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 课堂" description="查看 ClassIn 平台的课堂数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 课堂"
        description="查看 ClassIn 平台的课堂数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">课堂列表</h3>
                <p className="text-sm text-muted-foreground">共 {classrooms.length} 个课堂</p>
              </div>
              <Button
                variant="outline"
                onClick={fetchClassrooms}
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
                    <TableHead>课堂ID</TableHead>
                    <TableHead>课堂名称</TableHead>
                    <TableHead>所属班级</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>学生数</TableHead>
                    <TableHead>听课数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最后同步</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classrooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    classrooms.map((classroom) => (
                      <TableRow key={classroom.class_id}>
                        <TableCell className="font-medium">{classroom.class_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 text-muted-foreground" />
                            {classroom.name || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{classroom.course_name || "-"}</TableCell>
                        <TableCell>{formatTimestamp(classroom.start_time)}</TableCell>
                        <TableCell>{formatTimestamp(classroom.end_time)}</TableCell>
                        <TableCell>{classroom.stu_num || 0}</TableCell>
                        <TableCell>{classroom.audit_num || 0}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getClassStatusStyle(classroom.class_status)}`}>
                            {getClassStatusText(classroom.class_status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {classroom.sync_time ? new Date(classroom.sync_time).toLocaleString('zh-CN') : '-'}
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
