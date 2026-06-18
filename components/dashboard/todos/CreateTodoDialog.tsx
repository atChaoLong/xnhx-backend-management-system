"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { TodosService } from "@/lib/services/todos"
import { useToast } from "@/hooks/use-toast"
import { UserProfilesService } from "@/lib/services/userProfiles"
import { getClientSafeErrorMessage } from "@/lib/safe-error"
import type { TodoPriority } from "@/lib/types/todo"

interface CreateTodoDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTodoDialog({ isOpen, onClose, onSuccess }: CreateTodoDialogProps) {
  const [formData, setFormData] = useState({
    assigned_to: "",
    title: "",
    description: "",
    priority: "medium" as TodoPriority,
    due_date: "",
  })
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const { toast } = useToast()

  // 加载用户列表
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true)
        const data = await UserProfilesService.getAllUserProfiles()
        // 只显示销售和班主任（因为他们是待办的主要接收者）
        const filteredUsers = data.filter(u =>
          u.role === 'sales' || u.role === 'head_teacher'
        )
        setUsers(filteredUsers)
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: getClientSafeErrorMessage(error, "无法加载可分配用户"),
        })
      } finally {
        setIsLoadingUsers(false)
      }
    }

    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.assigned_to || !formData.title) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写所有必填字段",
      })
      return
    }

    try {
      setIsLoading(true)

      await TodosService.createTodo({
        assigned_to: formData.assigned_to,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        due_date: formData.due_date || undefined,
      })

      toast({
        title: "创建成功",
        description: "待办已创建",
      })

      // 重置表单
      setFormData({
        assigned_to: "",
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
      })

      onSuccess()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: getClientSafeErrorMessage(error, "无法创建待办"),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建待办</DialogTitle>
          <DialogDescription>
            为团队成员创建待办事项。带 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 分配给 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assigned_to" className="text-right">
                分配给 *
              </Label>
              <div className="col-span-3">
                {isLoadingUsers ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载用户列表...
                  </div>
                ) : (
                  <Select
                    value={formData.assigned_to}
                    onValueChange={(value) => handleInputChange("assigned_to", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择用户" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.role === 'sales' ? '销售' : user.role === 'head_teacher' ? '班主任' : user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* 待办标题 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                标题 *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="col-span-3"
                placeholder="例如：跟进新线索"
                required
              />
            </div>

            {/* 描述 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                描述
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="col-span-3"
                placeholder="详细说明待办事项的内容..."
                rows={3}
              />
            </div>

            {/* 优先级 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="text-right">
                优先级
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange("priority", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 到期时间 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="due_date" className="text-right">
                到期时间
              </Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => handleInputChange("due_date", e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading || isLoadingUsers}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
