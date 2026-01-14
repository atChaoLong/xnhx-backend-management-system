"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertCircle, Plus, Loader2, Trash2 } from "lucide-react"
import { TodosService, Todo } from "@/lib/services/todos"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/lib/hooks/usePagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePermission } from "@/lib/hooks/usePermission"
import { CreateTodoDialog } from "@/components/dashboard/todos/CreateTodoDialog"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

type TodoStatus = "pending" | "completed" | "cancelled"
type TodoPriority = "low" | "medium" | "high" | "urgent"

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isCompleting, setIsCompleting] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [filters, setFilters] = useState<{
    status: TodoStatus | "all"
    priority: TodoPriority | "all"
  }>({
    status: "all",
    priority: "all",
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { toast } = useToast()
  const { todos: todosPerm, user } = usePermission()

  // 分页逻辑
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
    onPageChange: (page, size) => fetchTodos(page, size),
  })

  // 获取待办列表
  const fetchTodos = async (page: number = 1, size: number = pageSize) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * size
      const to = from + size - 1

      const filterParams: any = {}
      if (filters.status !== "all") {
        filterParams.status = filters.status
      }
      if (filters.priority !== "all") {
        filterParams.priority = filters.priority
      }

      const { data, count } = await TodosService.getTodos(from, to, filterParams)
      setTodos(data)
      setTotalCount(count)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载待办列表",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 筛选条件变化时，重新获取数据
  useEffect(() => {
    fetchTodos(1, pageSize)
  }, [filters])

  useEffect(() => {
    fetchTodos()
  }, [])

  // 标记完成
  const handleCompleteTodo = async (todo: Todo) => {
    if (todo.status === "completed") return

    try {
      setIsCompleting(todo.id)
      await TodosService.completeTodo(todo.id)
      toast({
        title: "标记成功",
        description: "待办已标记为完成",
      })
      fetchTodos(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "标记失败",
        description: error.message || "无法标记完成",
      })
    } finally {
      setIsCompleting(null)
    }
  }

  // 删除待办
  const handleDeleteTodo = async (todo: Todo) => {
    if (!confirm(`确定要删除待办"${todo.title}"吗？`)) return

    try {
      setIsDeleting(todo.id)
      await TodosService.deleteTodo(todo.id)
      toast({
        title: "删除成功",
        description: "待办已删除",
      })
      fetchTodos(currentPage, pageSize)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除待办",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  // 获取优先级样式
  const getPriorityBadge = (priority: TodoPriority) => {
    const styles = {
      urgent: "bg-red-100 text-red-800 hover:bg-red-200",
      high: "bg-orange-100 text-orange-800 hover:bg-orange-200",
      medium: "bg-blue-100 text-blue-800 hover:bg-blue-200",
      low: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    }
    const labels = {
      urgent: "紧急",
      high: "高",
      medium: "中",
      low: "低",
    }
    return (
      <Badge className={styles[priority]}>
        {labels[priority]}
      </Badge>
    )
  }

  // 获取状态图标
  const getStatusIcon = (status: TodoStatus) => {
    if (status === "completed") {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    }
    if (status === "cancelled") {
      return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
    return <Clock className="h-5 w-5 text-blue-600" />
  }

  // 计算统计数据
  const stats = {
    total: todos.filter(t => t.status === "pending").length,
    completed: todos.filter(t => t.status === "completed").length,
    urgent: todos.filter(t => t.status === "pending" && t.priority === "urgent").length,
    todayOverdue: todos.filter(t => {
      if (t.status !== "pending" || !t.due_date) return false
      const dueDate = new Date(t.due_date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return dueDate <= today
    }).length,
  }

  if (isLoading && todos.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="待办事项" description="查看和管理待办任务" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="待办事项"
        description="查看和管理待办任务"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待完成</p>
                  <p className="text-3xl font-bold mt-2">{stats.total}</p>
                </div>
                <Clock className="h-12 w-12 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已完成</p>
                  <p className="text-3xl font-bold mt-2">{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-12 w-12 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">紧急</p>
                  <p className="text-3xl font-bold mt-2">{stats.urgent}</p>
                </div>
                <AlertCircle className="h-12 w-12 text-red-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日到期</p>
                  <p className="text-3xl font-bold mt-2">{stats.todayOverdue}</p>
                </div>
                <Clock className="h-12 w-12 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 主内容区 */}
        <Card>
          <CardContent className="p-6">
            {/* 工具栏 */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-4">
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value as TodoStatus | "all" })}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待完成</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.priority}
                  onValueChange={(value) => setFilters({ ...filters, priority: value as TodoPriority | "all" })}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部优先级</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fetchTodos(currentPage, pageSize)} disabled={isLoading}>
                  刷新
                </Button>
                {(todosPerm.create() || user?.role === 'operator' || user?.role === 'admin') && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    创建待办
                  </Button>
                )}
              </div>
            </div>

            {/* 待办列表 */}
            <div className="space-y-3">
              {todos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {filters.status === "all" && filters.priority === "all"
                    ? "暂无待办事项"
                    : "没有符合条件的待办"}
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                      todo.status === "completed" ? "opacity-60" : ""
                    }`}
                  >
                    {/* 状态图标 */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(todo.status)}
                    </div>

                    {/* 待办内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium truncate ${todo.status === "completed" ? "line-through" : ""}`}>
                          {todo.title}
                        </h3>
                        {getPriorityBadge(todo.priority)}
                      </div>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {todo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {todo.due_date && (
                          <span>
                            到期：{format(new Date(todo.due_date), "MM月dd日 HH:mm", { locale: zhCN })}
                          </span>
                        )}
                        <span>
                          创建：{format(new Date(todo.created_at), "MM月dd日", { locale: zhCN })}
                        </span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      {todo.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCompleteTodo(todo)}
                          disabled={isCompleting === todo.id}
                        >
                          {isCompleting === todo.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              完成
                            </>
                          )}
                        </Button>
                      )}
                      {(user?.role === 'admin' || todo.created_by === user?.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTodo(todo)}
                          disabled={isDeleting === todo.id}
                        >
                          {isDeleting === todo.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="mt-6">
                {/* 这里可以添加分页组件 */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    显示 {Math.min((currentPage - 1) * pageSize + 1, totalCount)} -{" "}
                    {Math.min(currentPage * pageSize, totalCount)} 条，共 {totalCount} 条
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPreviousPage()}
                      disabled={!canGoPrevious}
                    >
                      上一页
                    </Button>
                    <span className="flex items-center">
                      第 {currentPage} / {totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToNextPage()}
                      disabled={!canGoNext}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 创建待办对话框 */}
      <CreateTodoDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false)
          fetchTodos(currentPage, pageSize)
        }}
      />
    </div>
  )
}
