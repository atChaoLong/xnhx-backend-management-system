"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ArrowLeft, Edit, Phone, Mail, User, GraduationCap, Calendar, MapPin, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, BookOpen, Award, Star, Video, Play } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { TeachersService, Teacher } from "@/lib/services/teachers"
import { api } from "@/lib/fetch"
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
  logical_expression_score: number | null
  dress_appearance_score: number | null
  material_preparation_score: number | null
  initial_evaluation: string | null
  teacher_characteristics: string | null
  mandarin_level: string | null
  research_ability: string | null
  service_awareness: string | null
  affinity: string | null
  video_recording_url: string | null
  trial_video_url: string | null
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
      const response = await api.get(`/api/teacher-candidates?name=${encodeURIComponent(teacherData.name)}`)
      if (response.ok) {
        const result = await response.json()
        setInterviews(result.data || [])
      } else {
        // API 返回错误，但不阻塞页面加载
        console.warn('获取面试记录失败', response.status)
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

  // 获取评分颜色
  const getRatingColor = (score: number | null | undefined) => {
    if (score == null) return 'bg-gray-50 text-gray-700 border-gray-200'
    if (score >= 4.5) return 'bg-green-50 text-green-700 border-green-200' // 优秀
    if (score >= 3.5) return 'bg-blue-50 text-blue-700 border-blue-200' // 良好
    if (score >= 2.5) return 'bg-yellow-50 text-yellow-700 border-yellow-200' // 待改进
    return 'bg-red-50 text-red-700 border-red-200' // 不合格
  }

  // 获取评分等级文本
  const getRatingLevel = (score: number | null | undefined) => {
    if (score == null) return '未评分'
    if (score >= 4.5) return '优秀'
    if (score >= 3.5) return '良好'
    if (score >= 2.5) return '待改进'
    return '不合格'
  }

  // 渲染评分卡片
  const renderScoreCard = (label: string, score: number | null | undefined, icon: React.ReactNode) => {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
        getRatingColor(score)
      )}>
        <div className="flex items-center gap-1 mb-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {score != null ? (
          <>
            <div className="text-3xl font-bold">{score.toFixed(1)}</div>
            <div className="text-xs mt-1 opacity-75">{getRatingLevel(score)}</div>
          </>
        ) : (
          <div className="text-lg text-muted-foreground">-</div>
        )}
      </div>
    )
  }

  // 获取最新面试记录
  const latestInterview = interviews.length > 0 ? interviews[0] : null

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
                  <p className="text-base font-semibold">{teacher.name || '-'}</p>
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

          {/* 面试评审 - 突出显示 */}
          {latestInterview && (
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-primary" />
                  面试评审
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    面试时间: {latestInterview.interview_date ? format(new Date(latestInterview.interview_date), 'yyyy-MM-dd') : '-'}
                    {latestInterview.interview_time && ` ${latestInterview.interview_time}`}
                  </span>
                  <div className="ml-auto">
                    {latestInterview.interview_result ? getStatusBadge(latestInterview.interview_result) : getStatusBadge(latestInterview.interview_status)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 分项评分卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {renderScoreCard('综合评分', latestInterview.overall_rating, <Star className="h-4 w-4" />)}
                  {renderScoreCard('沟通表达', latestInterview.communication_score, <MessageSquare className="h-4 w-4" />)}
                  {renderScoreCard('教学能力', latestInterview.teaching_score, <BookOpen className="h-4 w-4" />)}
                  {renderScoreCard('专业素养', latestInterview.professional_score, <GraduationCap className="h-4 w-4" />)}
                  {renderScoreCard('逻辑思维', latestInterview.logical_expression_score, <Award className="h-4 w-4" />)}
                  {renderScoreCard('仪容仪表', latestInterview.dress_appearance_score, <User className="h-4 w-4" />)}
                </div>

                {/* 素质评价 */}
                {(latestInterview.initial_evaluation ||
                  latestInterview.teacher_characteristics ||
                  latestInterview.mandarin_level ||
                  latestInterview.research_ability ||
                  latestInterview.service_awareness ||
                  latestInterview.affinity) && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground">素质评价</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {latestInterview.initial_evaluation && (
                        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground min-w-[60px]">初次评价:</span>
                          <span className="text-sm flex-1">{latestInterview.initial_evaluation}</span>
                        </div>
                      )}
                      {latestInterview.teacher_characteristics && (
                        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground min-w-[60px]">教师特质:</span>
                          <span className="text-sm flex-1">{latestInterview.teacher_characteristics}</span>
                        </div>
                      )}
                      {latestInterview.mandarin_level && (
                        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground min-w-[60px]">普通话:</span>
                          <span className="text-sm flex-1">{latestInterview.mandarin_level}</span>
                        </div>
                      )}
                      {latestInterview.research_ability && (
                        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground min-w-[60px]">教研能力:</span>
                          <span className="text-sm flex-1">{latestInterview.research_ability}</span>
                        </div>
                      )}
                      {latestInterview.service_awareness && (
                        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground min-w-[60px]">服务意识:</span>
                          <span className="text-sm flex-1">{latestInterview.service_awareness}</span>
                        </div>
                      )}
                      {latestInterview.affinity && (
                        <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground min-w-[60px]">亲和力:</span>
                          <span className="text-sm flex-1">{latestInterview.affinity}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 备注 */}
                {latestInterview.notes && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">面试备注</h4>
                    <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded">{latestInterview.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 面试视频 - 突出显示 */}
          {latestInterview && (latestInterview.video_recording_url || latestInterview.trial_video_url) && (
            <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  <span className="text-lg">面试视频</span>
                  <span className="ml-2 text-sm font-normal text-muted-foreground">点击观看面试录像</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {latestInterview.video_recording_url && (
                    <a
                      href={latestInterview.video_recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center gap-3 p-6 rounded-lg border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all hover:shadow-lg hover:border-primary/60"
                    >
                      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground group-hover:scale-110 transition-transform">
                        <Play className="h-6 w-6 ml-1" style={{ fill: 'currentColor' }} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg group-hover:text-primary transition-colors">
                          面试录像
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          完整面试过程记录
                        </div>
                      </div>
                    </a>
                  )}
                  {latestInterview.trial_video_url && (
                    <a
                      href={latestInterview.trial_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center gap-3 p-6 rounded-lg border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all hover:shadow-lg hover:border-primary/60"
                    >
                      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground group-hover:scale-110 transition-transform">
                        <Play className="h-6 w-6 ml-1" style={{ fill: 'currentColor' }} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg group-hover:text-primary transition-colors">
                          试讲视频
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          实际授课能力展示
                        </div>
                      </div>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* 面试记录 - 详细列表 */}
          {interviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  全部面试记录 ({interviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>面试日期</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>综合评分</TableHead>
                        <TableHead>沟通</TableHead>
                        <TableHead>教学</TableHead>
                        <TableHead>专业</TableHead>
                        <TableHead>视频</TableHead>
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
                          <TableCell>
                            <span className={cn(
                              "font-semibold",
                              interview.overall_rating && interview.overall_rating >= 4.5 ? "text-green-600" :
                              interview.overall_rating && interview.overall_rating >= 3.5 ? "text-blue-600" :
                              interview.overall_rating && interview.overall_rating >= 2.5 ? "text-yellow-600" : ""
                            )}>
                              {interview.overall_rating ? interview.overall_rating.toFixed(1) : '-'}
                            </span>
                          </TableCell>
                          <TableCell>{interview.communication_score ? interview.communication_score.toFixed(1) : '-'}</TableCell>
                          <TableCell>{interview.teaching_score ? interview.teaching_score.toFixed(1) : '-'}</TableCell>
                          <TableCell>{interview.professional_score ? interview.professional_score.toFixed(1) : '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {interview.video_recording_url && (
                                <a
                                  href={interview.video_recording_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  title="观看面试录像"
                                >
                                  <Video className="h-3 w-3" />
                                  面试
                                </a>
                              )}
                              {interview.trial_video_url && (
                                <a
                                  href={interview.trial_video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  title="观看试讲视频"
                                >
                                  <Play className="h-3 w-3" style={{ fill: 'currentColor' }} />
                                  试讲
                                </a>
                              )}
                              {!interview.video_recording_url && !interview.trial_video_url && (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md truncate" title={interview.notes || ''}>
                            {interview.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
