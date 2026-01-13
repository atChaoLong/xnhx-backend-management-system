"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ArrowLeft, Edit, Phone, Mail, User, GraduationCap, Calendar, MapPin, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TeachersService, Teacher } from "@/lib/services/teachers"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface InterviewRecord {
  id: string
  name: string
  interview_date: string | null
  interview_time: string | null
  interview_status: string
  interview_result: string | null
  overall_rating: number | null
  communication_score: number | null
  teaching_score: number | null
  professional_score: number | null
  notes: string | null
  created_at: string
}

export default function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { toast } = useToast()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [interviews, setInterviews] = useState<InterviewRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    params.then(({ id }) => {
      setTeacherId(id)
      fetchTeacherData(id)
    })
  }, [params])

  const fetchTeacherData = async (id: string) => {
    try {
      setIsLoading(true)

      // 获取老师基本信息
      const teacherData = await TeachersService.getTeacherById(id)
      setTeacher(teacherData)

      // 获取面试记录（通过姓名关联）
      const response = await fetch(`/api/teacher-candidates?name=${encodeURIComponent(teacherData.teacher_name)}`)
      if (response.ok) {
        const result = await response.json()
        setInterviews(result.data || [])
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载老师信息",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          通过
        </span>
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          未通过
        </span>
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          待面试
        </span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {status}
        </span>
    }
  }

  const getRatingStars = (rating: number | null) => {
    if (!rating) return '-'
    return '⭐'.repeat(rating)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师详情" description="查看老师详细信息和面试记录" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师详情" description="查看老师详细信息和面试记录" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">未找到该老师信息</p>
            <Button onClick={() => router.back()}>返回</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="老师详情" description="查看老师详细信息和面试记录" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 头部操作栏 */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Button>
            <div className="flex gap-2">
              <Link href={`/dashboard/teachers/${teacher.id}/edit`}>
                <Button>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑信息
                </Button>
              </Link>
            </div>
          </div>

          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 姓名和性别 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">姓名</label>
                  <p className="text-base font-semibold">{teacher.teacher_name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">性别</label>
                  <p className="text-base">{teacher.gender === 'male' ? '男' : teacher.gender === 'female' ? '女' : '-'}</p>
                </div>

                {/* 联系方式 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">微信</label>
                  <p className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {teacher.wechat || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">ClassIn手机号</label>
                  <p className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {teacher.classin_phone || '-'}
                  </p>
                </div>

                {/* ClassIn信息 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">ClassIn UID</label>
                  <p className="text-base">{teacher.classin_uid ?? '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">是否用过ClassIn</label>
                  <p className="text-base">{teacher.used_classin ? '是' : '否'}</p>
                </div>

                {/* 所在地 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">所在地</label>
                  <p className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {teacher.location || '-'}
                  </p>
                </div>

                {/* 时间信息 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                  <p className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {teacher.created_at ? format(new Date(teacher.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">更新时间</label>
                  <p className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {teacher.updated_at ? format(new Date(teacher.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 教学信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                教学信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">学科</label>
                  <p className="text-base">
                    {Array.isArray(teacher.subjects) && teacher.subjects.length > 0
                      ? teacher.subjects.join(', ')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">年级段</label>
                  <p className="text-base">
                    {Array.isArray(teacher.grade_levels) && teacher.grade_levels.length > 0
                      ? teacher.grade_levels.join(', ')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">教龄</label>
                  <p className="text-base">{teacher.teaching_years ? `${teacher.teaching_years}年` : '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">学历</label>
                  <p className="text-base">{teacher.education || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">毕业院校</label>
                  <p className="text-base">{teacher.university || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">教师资格证</label>
                  <p className="text-base">{teacher.has_certificate ? '有' : '无'}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">教学风格</label>
                  <p className="text-base">{teacher.teaching_style || '-'}</p>
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-sm font-medium text-muted-foreground">成功案例</label>
                  <p className="text-base whitespace-pre-wrap">{teacher.success_cases || '-'}</p>
                </div>
              </div>

              {/* 可授课时间 */}
              {(teacher.available_times && teacher.available_times.length > 0) && (
                <div className="mt-6">
                  <label className="text-sm font-medium text-muted-foreground">可授课时间</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teacher.available_times.map((time, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 其他信息 */}
          {(teacher.textbook_versions && teacher.textbook_versions.length > 0) ||
           (teacher.student_regions && teacher.student_regions.length > 0) ||
           (teacher.student_levels && teacher.student_levels.length > 0) ||
           teacher.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>其他信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teacher.textbook_versions && teacher.textbook_versions.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">教材版本</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {teacher.textbook_versions.map((version, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 border border-gray-200"
                          >
                            {version}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {teacher.student_regions && teacher.student_regions.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">学生地区</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {teacher.student_regions.map((region, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 border border-gray-200"
                          >
                            {region}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {teacher.student_levels && teacher.student_levels.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">学生水平</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {teacher.student_levels.map((level, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 border border-gray-200"
                          >
                            {level}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {teacher.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">备注</label>
                      <p className="mt-2 text-base whitespace-pre-wrap">{teacher.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* 面试记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                面试记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无面试记录
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>面试日期</TableHead>
                        <TableHead>面试时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>综合评分</TableHead>
                        <TableHead>备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interviews.map((interview) => (
                        <TableRow key={interview.id}>
                          <TableCell>
                            {interview.interview_date
                              ? format(new Date(interview.interview_date), 'yyyy-MM-dd')
                              : '-'}
                          </TableCell>
                          <TableCell>{interview.interview_time || '-'}</TableCell>
                          <TableCell>{getStatusBadge(interview.interview_status)}</TableCell>
                          <TableCell>
                            {interview.interview_result
                              ? getStatusBadge(interview.interview_result)
                              : '-'}
                          </TableCell>
                          <TableCell>{getRatingStars(interview.overall_rating)}</TableCell>
                          <TableCell className="max-w-md truncate" title={interview.notes || ''}>
                            {interview.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
