"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPageSize, PaginationPrevious, PaginationInfo } from "@/components/ui/pagination"
import { Loader2, Edit, Trash2 } from "lucide-react"
import { ClassroomsService, Classroom, EditClassroomParams, DeleteClassroomParams } from "@/lib/services/classrooms"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { EditClassroomDialog } from "@/components/classroom/EditClassroomDialog"

export default function ClassroomPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const { toast } = useToast()

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

  const handleEditClassroom = (classroom: Classroom) => {
    setEditingClassroom(classroom)
    setIsEditDialogOpen(true)
  }

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false)
    setEditingClassroom(null)
  }

  const handleEditSuccess = () => {
    // 刷新列表
    fetchClassrooms(currentPage, pageSize)
  }

  const handleDeleteClassroom = async (classroom: Classroom) => {
    try {
      setIsDeleting(true)
      
      const params: DeleteClassroomParams = {
        courseId: classroom.course_id || 0,
        classId: classroom.class_id,
      }
      
      await ClassroomsService.deleteClassroom(params)
      
      toast({
        title: "删除成功",
        description: `课节 "${classroom.name}" 已成功删除`,
      })
      
      // 刷新列表
      fetchClassrooms(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "删除课节失败",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const {
    currentPage,
    pageSize,
    totalPages,
    canGoNext,
    canGoPrevious,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    getPageRange,
  } = usePagination({
    totalCount,
    pageSize: 20,
    onPageChange: (page, size) => fetchClassrooms(page, size),
  })

  const fetchClassrooms = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1
      const { data, count } = await ClassroomsService.getClassrooms(from, to)
      setClassrooms(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载课堂列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClassrooms(1, pageSize)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="课堂管理" description="展示 ClassIn 课堂列表" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="课堂管理" description="展示 ClassIn 课堂列表" />
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">课堂列表</h3>
                <PaginationInfo currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} />
              </div>
              <div>
                <Button variant="outline" onClick={() => fetchClassrooms(currentPage, pageSize)} disabled={isLoading}>刷新</Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>课堂ID</TableHead>
                    <TableHead>课堂名称</TableHead>
                    <TableHead>班级名称</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>活动ID</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classrooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无数据</TableCell>
                    </TableRow>
                  ) : (
                    classrooms.map((c) => (
                      <TableRow key={c.class_id}>
                        <TableCell className="font-medium">{c.class_id}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.course_name || "-"}</TableCell>
                        <TableCell>{c.start_time ? new Date(c.start_time * 1000).toLocaleString() : "-"}</TableCell>
                        <TableCell>{c.end_time ? new Date(c.end_time * 1000).toLocaleString() : "-"}</TableCell>
                        <TableCell>{c.activity_id ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClassroom(c)}
                              disabled={isEditing}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除课节 "{c.name}" 吗？此操作不可撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteClassroom(c)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {isDeleting ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        删除中...
                                      </>
                                    ) : (
                                      "确认删除"
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <PaginationInfo currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} />
              <div className="flex items-center gap-4">
                <PaginationPageSize pageSize={pageSize} onPageSizeChange={handlePageSizeChange} options={PAGE_SIZE_OPTIONS} />
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={goToPreviousPage} className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"} disabled={!canGoPrevious} />
                    </PaginationItem>
                    {getPageRange().map((page, index) => {
                      if (page === -1) {
                        return (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink onClick={() => goToPage(page)} isActive={page === currentPage} className="cursor-pointer" disabled={false}>
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    <PaginationItem>
                      <PaginationNext onClick={goToNextPage} className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"} disabled={!canGoNext} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
              <div className="w-auto"></div>
            </div>
          </CardContent>
        </Card>
        
        <EditClassroomDialog
          classroom={editingClassroom}
          isOpen={isEditDialogOpen}
          onClose={handleCloseEditDialog}
          onSuccess={handleEditSuccess}
        />
      </div>
    </div>
  )
}
