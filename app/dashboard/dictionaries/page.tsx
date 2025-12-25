"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { DictionaryService, DictionaryItem } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"

// 字典分类标签
const CATEGORY_LABELS: Record<string, string> = {
  subject: "学科",
  grade: "年级",
  province: "省份",
  textbook_version: "教材版本",
  order_type: "订单类型",
  payment_channel: "付款渠道",
  consultant: "顾问",
  class_duration: "课时长",
  fixed_mode: "固定模式",
  class_frequency: "频次",
  teacher_feature: "老师特点",
  scheduling_mode: "排课模式",
  advisor: "顾问",
  free_time: "空闲时间",
  add_method: "添加方式",
  xhs_source: "小红书来源",
  teacher_type: "老师类型",
  student_type: "学生类型",
  teacher_level: "老师等级",
  mandarin_level: "普通话等级",
  visit_type: "访问类型",
  payment_type: "付款类型",
  recruiter: "招聘人",
}

export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<Record<string, DictionaryItem[]>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dictToDelete, setDictToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载字典列表
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoading(true)
        const data = await DictionaryService.getAllDictionaries()
        setDictionaries(data)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载字典数据",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadDictionaries()
  }, [])

  // 删除字典项
  const handleDeleteClick = (id: string) => {
    setDictToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!dictToDelete) return

    try {
      setIsDeleting(dictToDelete)
      await DictionaryService.deleteDictionary(dictToDelete)

      setDictionaries((prev) => {
        const newDicts = { ...prev }
        Object.keys(newDicts).forEach(category => {
          newDicts[category] = newDicts[category].filter(item => item.id !== dictToDelete)
        })
        return newDicts
      })

      toast({
        title: "删除成功",
        description: "字典项已删除",
      })
      setDeleteDialogOpen(false)
      setDictToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "无法删除字典项",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setDictToDelete(null)
  }

  // 获取当前显示的字典项
  const currentItems = selectedCategory === "all"
    ? Object.values(dictionaries).flat()
    : (dictionaries[selectedCategory] || [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="字典管理"
          description="管理系统中的字典数据和选项"
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="字典管理"
        description="管理系统中的字典数据和选项"
      />

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            {/* 分类导航和操作 */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-2">
                <div className="flex gap-2 overflow-x-auto pb-2 flex-1">
                  <Button
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("all")}
                    className="flex-shrink-0"
                  >
                    全部
                  </Button>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={selectedCategory === key ? "default" : "outline"}
                      onClick={() => setSelectedCategory(key)}
                      className="flex-shrink-0"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button onClick={() => window.location.href = "/dashboard/dictionaries/new"} className="flex-shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  新增字典
                </Button>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="mb-6 flex gap-4 text-sm text-muted-foreground">
              <span>分类数: {Object.keys(CATEGORY_LABELS).length}</span>
              <span>当前显示: {currentItems.length} 条</span>
            </div>

            {/* 字典表格 */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>分类</TableHead>
                    <TableHead>代码</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>{item.sort_order}</TableCell>
                        <TableCell>
                          {item.is_active ? (
                            <Badge className="bg-green-500">启用</Badge>
                          ) : (
                            <Badge variant="secondary">禁用</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.location.href = `/dashboard/dictionaries/${item.id}/edit`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(item.id)}
                              disabled={isDeleting === item.id}
                            >
                              {isDeleting === item.id ? (
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

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>确认删除</DialogTitle>
            </div>
            <DialogDescription>
              确定要删除这条字典项吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeleting !== null}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting !== null}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
