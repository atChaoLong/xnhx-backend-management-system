"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Users, GraduationCap, User, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { FormalOrdersService } from "@/lib/services/formalOrders"
import { StudentsService } from "@/lib/services/students"
import { TeachersService } from "@/lib/services/teachers"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function CreateClassFromOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 订单选择
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [orders, setOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  // 字典数据
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')

  // 班级信息
  const [className, setClassName] = useState("")
  const [classDescription, setClassDescription] = useState("")

  // 人员选择
  const [headTeacherId, setHeadTeacherId] = useState("")
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set())
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())

  // 可选列表
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([])
  const [availableStudents, setAvailableStudents] = useState<any[]>([])

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [orderData, teacherData, studentData] = await Promise.all([
          FormalOrdersService.getAllFormalOrders(),
          TeachersService.getAllTeachers(),
          StudentsService.getAllStudents(),
        ])
        // 只显示进行中的订单
        setOrders(orderData.filter((order: any) => order.status === 'active'))
        setAvailableTeachers(teacherData)
        setAvailableStudents(studentData)
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

  // 选择订单时自动填充信息
  const handleOrderChange = async (orderId: string) => {
    setSelectedOrderId(orderId)

    if (!orderId) {
      setSelectedOrder(null)
      setClassName("")
      setClassDescription("")
      setSelectedTeacherIds(new Set())
      setSelectedStudentIds(new Set())
      return
    }

    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) return

      setSelectedOrder(order)

      // 获取学生信息
      const student = await StudentsService.getStudentById(order.student_id)

      // 自动生成班级名称: 学生名-老师名-学科课
      const teacherName = order.teacher_names?.[0] || "未分配"
      const subject = order.subjects?.[0] || ""
      const autoClassName = `${student.student_name}-${teacherName}${subject}课`

      setClassName(autoClassName)
      setClassDescription(`基于订单 ${order.order_number} 创建的${subject}课程班级`)

      // 自动选择学生
      setSelectedStudentIds(new Set([order.student_id]))

      // 自动选择老师（如果老师已在系统中）
      if (order.teacher_names && order.teacher_names.length > 0) {
        const matchedTeacherIds = availableTeachers
          .filter(t => order.teacher_names.includes(t.teacher_name))
          .map(t => t.id)
        setSelectedTeacherIds(new Set(matchedTeacherIds))
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载订单信息",
      })
    }
  }

  // 全选/取消全选老师
  const handleSelectAllTeachers = () => {
    if (selectedTeacherIds.size === availableTeachers.length) {
      setSelectedTeacherIds(new Set())
    } else {
      setSelectedTeacherIds(new Set(availableTeachers.map(t => t.id)))
    }
  }

  // 切换老师选择
  const handleToggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(teacherId)) {
        newSet.delete(teacherId)
      } else {
        newSet.add(teacherId)
      }
      return newSet
    })
  }

  // 全选/取消全选学生
  const handleSelectAllStudents = () => {
    if (selectedStudentIds.size === availableStudents.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(availableStudents.map(s => s.id)))
    }
  }

  // 切换学生选择
  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(studentId)) {
        newSet.delete(studentId)
      } else {
        newSet.add(studentId)
      }
      return newSet
    })
  }

  // 提交创建班级
  const handleSubmit = async () => {
    // 验证必填字段
    if (!selectedOrderId) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择正式订单",
      })
      return
    }

    if (!className.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入班级名称",
      })
      return
    }

    if (!headTeacherId) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请选择班主任",
      })
      return
    }

    if (selectedTeacherIds.size === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请至少选择一位任课老师",
      })
      return
    }

    if (selectedStudentIds.size === 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请至少选择一位学生",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: 调用创建班级API
      const payload = {
        name: className.trim(),
        description: classDescription.trim(),
        head_teacher_id: headTeacherId,
        teacher_ids: Array.from(selectedTeacherIds),
        student_ids: Array.from(selectedStudentIds),
        formal_order_id: selectedOrderId,
        status: 'pending', // 等待确认
      }

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))

      toast({
        title: "创建成功",
        description: `班级 "${className}" 已创建，等待确认`,
      })

      // 跳转到班级列表
      router.push("/dashboard/classin/classes")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建班级",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="从订单创建班级" description="基于正式订单自动填充班级信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="从订单创建班级" description="基于正式订单自动填充班级信息" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* 订单选择 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                1. 选择正式订单
              </h3>
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
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      ✓ 订单信息已自动填充，请确认并补充其他信息
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-blue-600">学生：</span>{selectedOrder.student_name}</div>
                      <div><span className="text-blue-600">课时：</span>{selectedOrder.total_sessions}节</div>
                      <div><span className="text-blue-600">科目：</span>{selectedOrder.subjects?.join(', ')}</div>
                      <div><span className="text-blue-600">老师：</span>{selectedOrder.teacher_names?.join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 班级基本信息 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">2. 班级基本信息</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="className">
                      班级名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="className"
                      placeholder="格式: 学生名-老师名-学科课"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      已自动生成，您可以修改
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classDescription">班级描述</Label>
                    <Input
                      id="classDescription"
                      placeholder="请输入班级描述"
                      value={classDescription}
                      onChange={(e) => setClassDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 选择班主任 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-purple-600" />
                3. 选择班主任
                <span className="text-destructive">*</span>
              </h3>
              <div className="space-y-2">
                <Label htmlFor="headTeacher">班主任</Label>
                <select
                  id="headTeacher"
                  value={headTeacherId}
                  onChange={(e) => setHeadTeacherId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">请选择班主任</option>
                  {availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.teacher_name} - {teacher.subjects?.join(', ') || '未指定科目'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  班主任负责班级管理和学生沟通
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 选择任课老师 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                  4. 选择任课老师
                  <span className="text-destructive">*</span>
                </h3>
                <Button variant="outline" size="sm" onClick={handleSelectAllTeachers}>
                  {selectedTeacherIds.size === availableTeachers.length ? '取消全选' : '全选'}
                </Button>
              </div>

              {availableTeachers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>暂无老师数据</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {availableTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Checkbox
                        checked={selectedTeacherIds.has(teacher.id)}
                        onCheckedChange={() => handleToggleTeacher(teacher.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{teacher.teacher_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {teacher.subjects?.join(', ') || '未指定科目'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-3">
                已选择 {selectedTeacherIds.size} 位老师
              </p>
            </CardContent>
          </Card>

          {/* 选择学生 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  5. 选择学生
                  <span className="text-destructive">*</span>
                </h3>
                <Button variant="outline" size="sm" onClick={handleSelectAllStudents}>
                  {selectedStudentIds.size === availableStudents.length ? '取消全选' : '全选'}
                </Button>
              </div>

              {availableStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>暂无学生数据</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {availableStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Checkbox
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{student.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {student.grade_code} - {student.school || '未填写学校'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-3">
                已选择 {selectedStudentIds.size} 位学生
              </p>
            </CardContent>
          </Card>

          {/* 提交区 */}
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <h4 className="font-semibold text-yellow-900">班级状态：等待确认</h4>
                  <p className="text-sm text-yellow-700">创建后需要班主任和学生确认后才能正式开课</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>班级名称: {className || '未设置'}</p>
                  <p>班主任: {headTeacherId ? availableTeachers.find(t => t.id === headTeacherId)?.teacher_name : '未选择'}</p>
                  <p>任课老师: {selectedTeacherIds.size} 位</p>
                  <p>学生: {selectedStudentIds.size} 位</p>
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
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        创建班级
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
