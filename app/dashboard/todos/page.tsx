"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, Clock, AlertCircle, Plus, Loader2, Trash2 } from "lucide-react"
import { TodosService, Todo, TodoStats } from "@/lib/services/todos"
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

const emptyStats: TodoStats = {
  total: 0,
  pending: 0,
  completed: 0,
  cancelled: 0,
  due_today: 0,
  overdue: 0,
  urgent_pending: 0,
  urgent_overdue: 0,
  escalation_watch: 0,
  escalation_urgent: 0,
  escalation_critical: 0,
  escalated_total: 0,
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<TodoStats>(emptyStats)
  const [isLoading, setIsLoading] = useState(false)
  const [isCompleting, setIsCompleting] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null)
  const [filters, setFilters] = useState<{
    status: TodoStatus | "all"
    priority: TodoPriority | "all"
  }>({
    status: "all",
    priority: "all",
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { toast } = useToast()
  const { user, todos: todoPermissions } = usePermission()

  const canCreateTodo = todoPermissions.create()

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

      const { data, count, stats } = await TodosService.getTodos(from, to, filterParams)
      setTodos(data)
      setTotalCount(count)
      setStats(stats || emptyStats)
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

  useEffect(() => {
    fetchTodos(1, pageSize)
  }, [filters])

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

  const openDeleteDialog = (todo: Todo) => {
    setTodoToDelete(todo)
  }

  // 删除待办
  const handleDeleteTodo = async () => {
    const targetTodo = todoToDelete
    if (!targetTodo) return

    try {
      setIsDeleting(targetTodo.id)
      await TodosService.deleteTodo(targetTodo.id)
      toast({
        title: "删除成功",
        description: "待办已删除",
      })
      setTodoToDelete(null)
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

  const canCompleteTodo = (todo: Todo) => {
    return todoPermissions.edit() && todo.status === "pending" && todo.assigned_to === user?.id
  }

  const canDeleteTodo = (_todo: Todo) => {
    return todoPermissions.delete()
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

  const getSlaBadge = (todo: Todo) => {
    if (todo.sla_status === "overdue") {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
          逾期{todo.days_overdue ? `${todo.days_overdue}天` : ""}
        </Badge>
      )
    }

    if (todo.sla_status === "due_today") {
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">今日到期</Badge>
    }

    if (todo.sla_status === "no_due_date" && todo.status === "pending") {
      return <Badge variant="outline">无截止时间</Badge>
    }

    return null
  }

  const getEscalationBadge = (todo: Todo) => {
    if (todo.escalation_level === "critical") {
      return (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200" title={todo.escalation_reason || undefined}>
          严重升级
        </Badge>
      )
    }

    if (todo.escalation_level === "urgent") {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-200" title={todo.escalation_reason || undefined}>
          需升级
        </Badge>
      )
    }

    if (todo.escalation_level === "watch") {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200" title={todo.escalation_reason || undefined}>
          需关注
        </Badge>
      )
    }

    return null
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待完成</p>
                  <p className="text-3xl font-bold mt-2">{stats.pending}</p>
                </div>
                <Clock className="h-12 w-12 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日到期</p>
                  <p className="text-3xl font-bold mt-2">{stats.due_today}</p>
                </div>
                <Clock className="h-12 w-12 text-amber-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已逾期</p>
                  <p className="text-3xl font-bold mt-2">{stats.overdue}</p>
                </div>
                <AlertCircle className="h-12 w-12 text-red-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">紧急待办</p>
                  <p className="text-3xl font-bold mt-2">{stats.urgent_pending}</p>
                </div>
                <AlertCircle className="h-12 w-12 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">升级提醒</p>
                  <p className="text-3xl font-bold mt-2">{stats.escalated_total}</p>
                  <p className="text-xs text-muted-foreground mt-1">严重 {stats.escalation_critical}</p>
                </div>
                <AlertCircle className="h-12 w-12 text-rose-600 opacity-20" />
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
                {canCreateTodo && (
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
                        {getSlaBadge(todo)}
                        {getEscalationBadge(todo)}
                      </div>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {todo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {todo.due_date && (
                          <span className={todo.is_overdue ? "font-medium text-red-600" : ""}>
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
                      {canCompleteTodo(todo) && (
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
                      {canDeleteTodo(todo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(todo)}
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

      <Dialog
        open={Boolean(todoToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setTodoToDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除待办</DialogTitle>
            <DialogDescription>
              删除后无法恢复，请确认是否删除“{todoToDelete?.title || "该待办"}”。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTodoToDelete(null)}
              disabled={Boolean(isDeleting)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTodo}
              disabled={Boolean(isDeleting)}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
