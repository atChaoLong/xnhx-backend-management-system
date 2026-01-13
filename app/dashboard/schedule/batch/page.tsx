"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2, Calendar, Clock, User, GraduationCap } from "lucide-react"
import { FormalOrdersService } from "@/lib/services/formalOrders"
import { StudentsService } from "@/lib/services/students"
import { TeachersService } from "@/lib/services/teachers"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ScheduleItem {
  id: string
  studentId: string
  studentName: string
  teacherId: string
  teacherName: string
  subject: string
  date: string
  startTime: string
  endTime: string
  classroom?: string
}

export default function BatchSchedulePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 订单数据
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [orders, setOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  // 字典数据
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')

  // 排课列表
  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>([])
  const [previewList, setPreviewList] = useState<ScheduleItem[]>([])

  // 全选
  const [selectAll, setSelectAll] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // UI状态
  const [showPreview, setShowPreview] = useState(false)

  // 加载订单数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const orderData = await FormalOrdersService.getAllFormalOrders()
        // 只显示进行中的订单
        setOrders(orderData.filter((order: any) => order.status === 'active'))
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载数据",
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // 选择订单时预览排课信息
  const handleOrderChange = async (orderId: string) => {
    setSelectedOrderId(orderId)
    setShowPreview(false)
    setPreviewList([])
    setScheduleList([])

    if (!orderId) {
      setSelectedOrder(null)
      return
    }

    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        throw new Error("订单不存在")
      }

      // 获取学生信息
      const student = await StudentsService.getStudentById(order.student_id)

      setSelectedOrder({ ...order, student_name: student.student_name })

      // 生成预览列表（不实际应用到scheduleList）
      const totalSessions = order.total_sessions || 1
      const sessionDuration = order.session_duration || 60
      const preview: ScheduleItem[] = []
      const now = new Date()

      for (let i = 0; i < totalSessions; i++) {
        const scheduleDate = new Date(now)
        scheduleDate.setDate(now.getDate() + 7 + (i * 7))

        const startTime = "14:00"
        const endTime = `${14 + Math.floor(sessionDuration / 60)}:${String(sessionDuration % 60).padStart(2, '0')}`

        preview.push({
          id: `preview-${orderId}-${i}`,
          studentId: order.student_id,
          studentName: student.student_name || "未知学生",
          teacherId: order.teacher_names?.[0] || "",
          teacherName: order.teacher_names?.[0] || "未分配",
          subject: order.subjects?.[0] || "",
          date: format(scheduleDate, 'yyyy-MM-dd'),
          startTime,
          endTime,
          classroom: "",
        })
      }

      setPreviewList(preview)
      setShowPreview(true)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载订单信息",
      })
    }
  }

  // 确认生成排课列表
  const confirmGenerateSchedule = () => {
    if (previewList.length === 0) {
      toast({
        variant: "destructive",
        title: "没有可生成的课程",
        description: "请先选择订单查看预览",
      })
      return
    }

    // 将预览列表转换为实际的排课列表（生成新的ID）
    const actualScheduleList = previewList.map((item, index) => ({
      ...item,
      id: `schedule-${Date.now()}-${index}`,
    }))

    setScheduleList(actualScheduleList)
    setShowPreview(false)

    toast({
      title: "生成成功",
      description: `已生成 ${actualScheduleList.length} 节课程的排课列表`,
    })
  }

  // 手动添加单节课程
  const addSingleSchedule = () => {
    const newSchedule: ScheduleItem = {
      id: `manual-${Date.now()}`,
      studentId: "",
      studentName: "",
      teacherId: "",
      teacherName: "",
      subject: "",
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: "14:00",
      endTime: "15:00",
      classroom: "",
    }
    setScheduleList([...scheduleList, newSchedule])
  }

  // 更新排课项
  const updateScheduleItem = (id: string, field: keyof ScheduleItem, value: string) => {
    setScheduleList(scheduleList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  // 删除排课项
  const removeScheduleItem = (id: string) => {
    setScheduleList(scheduleList.filter(item => item.id !== id))
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  // 批量删除选中的项
  const removeSelectedItems = () => {
    setScheduleList(scheduleList.filter(item => !selectedItems.has(item.id)))
    setSelectedItems(new Set())
    setSelectAll(false)
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(scheduleList.map(item => item.id)))
    }
    setSelectAll(!selectAll)
  }

  // 选择单个项
  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 批量提交排课
  const handleSubmit = async () => {
    if (!selectedOrderId) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请先选择订单",
      })
      return
    }

    if (scheduleList.length === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请先添加排课信息",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        orderId: selectedOrderId,
        items: scheduleList.map(item => ({
          studentName: item.studentName,
          teacherName: item.teacherName,
          subject: item.subject,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
        }))
      }
      const resp = await fetch("/api/schedule/batch/create-classin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "批量排课失败" }))
        throw new Error(err.error || "批量排课失败")
      }
      const result = await resp.json()

      toast({
        title: "排课成功",
        description: `已成功创建 ${result.success}/${result.total} 节课程`,
      })

      router.push("/dashboard/classroom")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "排课失败",
        description: error.message || "无法创建课程",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="批量排课" description="从正式订单批量创建课程" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="批量排课" description="从正式订单批量创建课程" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 订单选择区 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">1. 选择正式订单</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order">选择订单</Label>
                  <select
                    id="order"
                    value={selectedOrderId}
                    onChange={(e) => handleOrderChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">请选择正式订单</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} - {order.student_name} ({order.subjects?.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOrder && (
                  <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">订单信息</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">学生姓名：</span>
                        <span className="font-medium">{selectedOrder.student_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">总课时：</span>
                        <span className="font-medium">{selectedOrder.total_sessions} 节</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">课时时长：</span>
                        <span className="font-medium">{selectedOrder.session_duration} 分钟</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">科目：</span>
                        <span className="font-medium">{selectedOrder.subjects?.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">老师：</span>
                        <span className="font-medium">{selectedOrder.teacher_names?.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">排课模式：</span>
                        <span className="font-medium">{selectedOrder.fixed_mode}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">课程频次：</span>
                        <span className="font-medium">{selectedOrder.frequency}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">订单号：</span>
                        <span className="font-medium">{selectedOrder.order_number}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 预览区 */}
          {showPreview && previewList.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">2. 排课预览</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      将生成 {previewList.length} 节课程，默认每周一次，从下周开始
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPreview(false)
                        setPreviewList([])
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={confirmGenerateSchedule}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      确认生成
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">序号</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>时间段</TableHead>
                        <TableHead>学生</TableHead>
                        <TableHead>老师</TableHead>
                        <TableHead>科目</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewList.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.startTime} - {item.endTime}</TableCell>
                          <TableCell>{item.studentName}</TableCell>
                          <TableCell>{item.teacherName}</TableCell>
                          <TableCell>{item.subject}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg text-sm text-blue-800">
                  💡 提示：确认生成后，您可以编辑每节课的日期、时间、教室等信息
                </div>
              </CardContent>
            </Card>
          )}

          {/* 排课列表区 */}
          {scheduleList.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {showPreview ? "3. 排课列表" : "2. 排课列表"}
                  {scheduleList.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (共 {scheduleList.length} 节课)
                    </span>
                  )}
                </h3>
                <div className="flex gap-2">
                  {selectedItems.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeSelectedItems}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除选中 ({selectedItems.size})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSingleSchedule}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    手动添加
                  </Button>
                </div>
              </div>

              {scheduleList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无排课信息</p>
                  <p className="text-sm mt-2">请选择订单生成排课列表，或手动添加课程</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="w-16">序号</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>时间段</TableHead>
                        <TableHead>学生</TableHead>
                        <TableHead>老师</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead>教室</TableHead>
                        <TableHead className="w-24 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleList.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => handleSelectItem(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateScheduleItem(item.id, 'date', e.target.value)}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={item.startTime}
                                onChange={(e) => updateScheduleItem(item.id, 'startTime', e.target.value)}
                                className="h-9 w-24"
                              />
                              <span>-</span>
                              <Input
                                type="time"
                                value={item.endTime}
                                onChange={(e) => updateScheduleItem(item.id, 'endTime', e.target.value)}
                                className="h-9 w-24"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{item.studentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{item.teacherName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <select
                              value={item.subject}
                              onChange={(e) => updateScheduleItem(item.id, 'subject', e.target.value)}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              <option value="">请选择</option>
                              {subjects.map((subject) => (
                                <option key={subject.code} value={subject.label}>
                                  {subject.label}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="教室号"
                              value={item.classroom}
                              onChange={(e) => updateScheduleItem(item.id, 'classroom', e.target.value)}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeScheduleItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* 提交按钮区 */}
          {scheduleList.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <p>已选择 {selectedItems.size} 项，共 {scheduleList.length} 节课</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.back()}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || scheduleList.length === 0}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        <>
                          <Calendar className="mr-2 h-4 w-4" />
                          确认排课
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
