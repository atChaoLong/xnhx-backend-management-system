"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TeachersService, Teacher } from "@/lib/services/teachers"
import { useToast } from "@/hooks/use-toast"

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载老师列表
  const fetchTeachers = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await TeachersService.getTeachers()
      setTeachers(data)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载老师列表",
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  // 删除老师
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个老师吗？")) return

    try {
      setIsDeleting(id)
      await TeachersService.deleteTeacher(id)
      toast({
        title: "删除成功",
        description: "老师已删除",
      })
      fetchTeachers()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除老师",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师管理" description="管理已入库老师信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="老师管理"
        description="管理已入库老师信息"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">老师列表</h3>
                <p className="text-sm text-muted-foreground">共 {teachers.length} 位老师</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchTeachers} disabled={isLoading}>
                  刷新
                </Button>
                <Link href="/dashboard/teachers/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增老师
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>性别</TableHead>
                    <TableHead>所在地</TableHead>
                    <TableHead>学科</TableHead>
                    <TableHead>年级段</TableHead>
                    <TableHead>学历</TableHead>
                    <TableHead>毕业院校</TableHead>
                    <TableHead>教学年限</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无数据，点击"新增老师"开始添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium">{teacher.teacher_name || "-"}</TableCell>
                        <TableCell>{teacher.gender || "-"}</TableCell>
                        <TableCell>{teacher.location || "-"}</TableCell>
                        <TableCell>
                          {teacher.subjects && teacher.subjects.length > 0
                            ? teacher.subjects.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {teacher.grade_levels && teacher.grade_levels.length > 0
                            ? teacher.grade_levels.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>{teacher.education || "-"}</TableCell>
                        <TableCell>{teacher.university || "-"}</TableCell>
                        <TableCell>{teacher.teaching_years ? `${teacher.teaching_years}年` : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/teachers/${teacher.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(teacher.id)}
                              disabled={isDeleting === teacher.id}
                            >
                              {isDeleting === teacher.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
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
