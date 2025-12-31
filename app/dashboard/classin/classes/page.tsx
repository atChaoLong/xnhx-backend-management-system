"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ClassInClass {
  class_id: number
  name: string
  course_id?: number
  unit_id?: number
  teacher_uid?: number
  teacher_name?: string
  student_count?: number
  status?: string
}

export default function ClassInClassesPage() {
  const [classes, setClasses] = useState<ClassInClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()

  // 加载班级数据
  const fetchClasses = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/classin/classes')

      if (!response.ok) {
        throw new Error('加载失败')
      }

      const { data } = await response.json()
      setClasses(data || [])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载 ClassIn 班级数据",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 同步班级数据
  const handleSync = async () => {
    try {
      setIsSyncing(true)
      const response = await fetch('/api/classin/sync/classes', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('同步失败')
      }

      const { data } = await response.json()
      toast({
        title: "同步成功",
        description: `已同步 ${data?.count || 0} 条班级数据`,
      })
      fetchClasses()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "同步失败",
        description: error.message || "无法同步班级数据",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchClasses()
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="ClassIn 班级" description="管理 ClassIn 平台的班级数据" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn 班级"
        description="管理 ClassIn 平台的班级数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">班级列表</h3>
                <p className="text-sm text-muted-foreground">共 {classes.length} 个班级</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={fetchClasses}
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
                    <TableHead>班级ID</TableHead>
                    <TableHead>班级名称</TableHead>
                    <TableHead>课程ID</TableHead>
                    <TableHead>单元ID</TableHead>
                    <TableHead>授课老师</TableHead>
                    <TableHead>学生数</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"同步数据"从 ClassIn 同步班级信息
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((classInfo) => (
                      <TableRow key={classInfo.class_id}>
                        <TableCell className="font-medium">{classInfo.class_id}</TableCell>
                        <TableCell>{classInfo.name || "-"}</TableCell>
                        <TableCell>{classInfo.course_id || "-"}</TableCell>
                        <TableCell>{classInfo.unit_id || "-"}</TableCell>
                        <TableCell>{classInfo.teacher_name || "-"}</TableCell>
                        <TableCell>{classInfo.student_count || 0}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {classInfo.status || '正常'}
                          </span>
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
