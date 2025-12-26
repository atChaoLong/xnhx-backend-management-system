"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, XCircle, UserPlus, Users, BookOpen, FolderOpen, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ClassInSDKPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  // 老师注册表单
  const [teacherForm, setTeacherForm] = useState({
    telephone: "",
    nickname: "",
    password: "",
  })

  // 学生注册表单
  const [studentForm, setStudentForm] = useState({
    telephone: "",
    nickname: "",
    password: "",
  })

  // 课程创建表单
  const [courseForm, setCourseForm] = useState({
    courseName: "",
  })

  // 单元创建表单
  const [unitForm, setUnitForm] = useState({
    courseId: "",
    name: "",
  })

  // 课堂创建表单
  const [classroomForm, setClassroomForm] = useState({
    courseId: "",
    unitId: "",
    name: "",
    teacherUid: "",
    startTime: "",
    endTime: "",
  })

  // 完整流程表单
  const [completeForm, setCompleteForm] = useState({
    teacherTelephone: "",
    teacherNickname: "",
    teacherPassword: "",
    courseName: "",
    unitName: "第一章",
    classroomName: "",
    startTime: "",
    endTime: "",
  })

  // 注册老师
  const handleRegisterTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/classin-sdk/register/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherForm),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "注册老师失败")
      }

      toast({
        title: "注册成功",
        description: `老师 UID: ${data.data.teacherUid}`,
      })

      // 重置表单
      setTeacherForm({ telephone: "", nickname: "", password: "" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "注册失败",
        description: error.message || "无法注册老师",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 注册学生
  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/classin-sdk/register/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentForm),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "注册学生失败")
      }

      toast({
        title: "注册成功",
        description: `学生 UID: ${data.data.studentUid}`,
      })

      // 重置表单
      setStudentForm({ telephone: "", nickname: "", password: "" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "注册失败",
        description: error.message || "无法注册学生",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 创建课程
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/classin-sdk/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseForm),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "创建课程失败")
      }

      toast({
        title: "创建成功",
        description: `课程 ID: ${data.data.courseId}`,
      })

      // 重置表单
      setCourseForm({ courseName: "" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建课程",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 创建单元
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/classin-sdk/unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: parseInt(unitForm.courseId),
          name: unitForm.name,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "创建单元失败")
      }

      toast({
        title: "创建成功",
        description: `单元 ID: ${data.data.unitId}`,
      })

      // 重置表单
      setUnitForm({ courseId: "", name: "" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建单元",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 创建课堂
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/classin-sdk/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: parseInt(classroomForm.courseId),
          unitId: parseInt(classroomForm.unitId),
          name: classroomForm.name,
          teacherUid: parseInt(classroomForm.teacherUid),
          startTime: classroomForm.startTime,
          endTime: classroomForm.endTime,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "创建课堂失败")
      }

      toast({
        title: "创建成功",
        description: `课堂 ID: ${data.data.classId}, 活动 ID: ${data.data.activityId}`,
      })

      // 重置表单
      setClassroomForm({
        courseId: "",
        unitId: "",
        name: "",
        teacherUid: "",
        startTime: "",
        endTime: "",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建课堂",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 一键创建完整课程和课堂
  const handleCreateComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/classin-sdk/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher: {
            telephone: completeForm.teacherTelephone,
            nickname: completeForm.teacherNickname,
            password: completeForm.teacherPassword,
          },
          course: {
            courseName: completeForm.courseName,
          },
          unit: {
            name: completeForm.unitName,
          },
          classroom: {
            name: completeForm.classroomName,
            startTime: completeForm.startTime,
            endTime: completeForm.endTime,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "创建失败")
      }

      toast({
        title: "创建成功",
        description: `老师 UID: ${data.data.teacherUid}, 课程 ID: ${data.data.courseId}, 课堂 ID: ${data.data.classId}`,
      })

      // 重置表单
      setCompleteForm({
        teacherTelephone: "",
        teacherNickname: "",
        teacherPassword: "",
        courseName: "",
        unitName: "第一章",
        classroomName: "",
        startTime: "",
        endTime: "",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建课程和课堂",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ClassIn SDK 管理"
        description="使用官方 API 进行操作"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">配置要求</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>需要在 .env.local 中配置 CLASSIN_SID 和 CLASSIN_SECRET</li>
                  <li>从 ClassIn 管理后台获取：设置 → API设置</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">可用功能</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>注册老师和学生</li>
                  <li>创建课程、单元和课堂</li>
                  <li>一键创建完整课程和课堂（推荐）</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">与页面端接口的区别</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>SDK 使用官方 API，需要 SID 和 SECRET 认证</li>
                  <li>页面端使用 Cookie 模拟浏览器，仅适合测试</li>
                  <li>SDK 方式更加稳定和可靠，适合生产环境</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 功能标签页 */}
          <Tabs defaultValue="complete" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="complete">
                <Video className="mr-2 h-4 w-4" />
                一键创建
              </TabsTrigger>
              <TabsTrigger value="teacher">
                <UserPlus className="mr-2 h-4 w-4" />
                注册老师
              </TabsTrigger>
              <TabsTrigger value="student">
                <Users className="mr-2 h-4 w-4" />
                注册学生
              </TabsTrigger>
              <TabsTrigger value="course">
                <BookOpen className="mr-2 h-4 w-4" />
                创建课程
              </TabsTrigger>
              <TabsTrigger value="unit">
                <FolderOpen className="mr-2 h-4 w-4" />
                创建单元
              </TabsTrigger>
              <TabsTrigger value="classroom">
                <Video className="mr-2 h-4 w-4" />
                创建课堂
              </TabsTrigger>
            </TabsList>

            {/* 一键创建完整课程和课堂 */}
            <TabsContent value="complete">
              <Card>
                <CardHeader>
                  <CardTitle>一键创建课程和课堂</CardTitle>
                  <CardDescription>
                    自动完成：注册老师 → 创建课程 → 创建单元 → 创建课堂
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateComplete} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">老师信息</h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="teacher-telephone">
                              手机号 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="teacher-telephone"
                              type="tel"
                              placeholder="请输入手机号"
                              value={completeForm.teacherTelephone}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, teacherTelephone: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="teacher-nickname">
                              昵称 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="teacher-nickname"
                              placeholder="请输入昵称"
                              value={completeForm.teacherNickname}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, teacherNickname: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="teacher-password">
                              密码 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="teacher-password"
                              type="password"
                              placeholder="请输入密码"
                              value={completeForm.teacherPassword}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, teacherPassword: e.target.value })
                              }
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">课程信息</h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="course-name">
                              课程名称 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="course-name"
                              placeholder="例如：Python编程入门班"
                              value={completeForm.courseName}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, courseName: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="unit-name">单元名称</Label>
                            <Input
                              id="unit-name"
                              placeholder="例如：第一章"
                              value={completeForm.unitName}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, unitName: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">课堂信息</h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="classroom-name">
                              课堂名称 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="classroom-name"
                              placeholder="例如：第一节：Python环境搭建"
                              value={completeForm.classroomName}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, classroomName: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="start-time">
                              开始时间 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="start-time"
                              type="datetime-local"
                              value={completeForm.startTime}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, startTime: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="end-time">
                              结束时间 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="end-time"
                              type="datetime-local"
                              value={completeForm.endTime}
                              onChange={(e) =>
                                setCompleteForm({ ...completeForm, endTime: e.target.value })
                              }
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          "一键创建"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 注册老师 */}
            <TabsContent value="teacher">
              <Card>
                <CardHeader>
                  <CardTitle>注册老师</CardTitle>
                  <CardDescription>
                    注册新老师到 ClassIn 系统
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegisterTeacher} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="t-telephone">
                          手机号 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="t-telephone"
                          type="tel"
                          placeholder="请输入手机号"
                          value={teacherForm.telephone}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, telephone: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="t-nickname">
                          昵称 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="t-nickname"
                          placeholder="请输入昵称"
                          value={teacherForm.nickname}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, nickname: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="t-password">
                          密码 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="t-password"
                          type="password"
                          placeholder="请输入密码"
                          value={teacherForm.password}
                          onChange={(e) =>
                            setTeacherForm({ ...teacherForm, password: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            注册中...
                          </>
                        ) : (
                          "注册老师"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 注册学生 */}
            <TabsContent value="student">
              <Card>
                <CardHeader>
                  <CardTitle>注册学生</CardTitle>
                  <CardDescription>
                    注册新学生到 ClassIn 系统
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegisterStudent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="s-telephone">
                          手机号 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="s-telephone"
                          type="tel"
                          placeholder="请输入手机号"
                          value={studentForm.telephone}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, telephone: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="s-nickname">
                          昵称 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="s-nickname"
                          placeholder="请输入昵称"
                          value={studentForm.nickname}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, nickname: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="s-password">
                          密码 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="s-password"
                          type="password"
                          placeholder="请输入密码"
                          value={studentForm.password}
                          onChange={(e) =>
                            setStudentForm({ ...studentForm, password: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            注册中...
                          </>
                        ) : (
                          "注册学生"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 创建课程 */}
            <TabsContent value="course">
              <Card>
                <CardHeader>
                  <CardTitle>创建课程</CardTitle>
                  <CardDescription>
                    创建新课程到 ClassIn 系统
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateCourse} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="c-course-name">
                        课程名称 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="c-course-name"
                        placeholder="例如：Python编程入门班"
                        value={courseForm.courseName}
                        onChange={(e) =>
                          setCourseForm({ ...courseForm, courseName: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          "创建课程"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 创建单元 */}
            <TabsContent value="unit">
              <Card>
                <CardHeader>
                  <CardTitle>创建单元</CardTitle>
                  <CardDescription>
                    为课程创建单元（章节）
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateUnit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="u-course-id">
                          课程ID <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="u-course-id"
                          type="number"
                          placeholder="请输入课程ID"
                          value={unitForm.courseId}
                          onChange={(e) =>
                            setUnitForm({ ...unitForm, courseId: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="u-name">
                          单元名称 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="u-name"
                          placeholder="例如：第一章"
                          value={unitForm.name}
                          onChange={(e) =>
                            setUnitForm({ ...unitForm, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          "创建单元"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 创建课堂 */}
            <TabsContent value="classroom">
              <Card>
                <CardHeader>
                  <CardTitle>创建课堂</CardTitle>
                  <CardDescription>
                    为单元创建课堂活动
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateClassroom} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cls-course-id">
                          课程ID <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cls-course-id"
                          type="number"
                          placeholder="请输入课程ID"
                          value={classroomForm.courseId}
                          onChange={(e) =>
                            setClassroomForm({ ...classroomForm, courseId: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cls-unit-id">
                          单元ID <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cls-unit-id"
                          type="number"
                          placeholder="请输入单元ID"
                          value={classroomForm.unitId}
                          onChange={(e) =>
                            setClassroomForm({ ...classroomForm, unitId: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cls-name">
                          课堂名称 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cls-name"
                          placeholder="例如：第一节：Python环境搭建"
                          value={classroomForm.name}
                          onChange={(e) =>
                            setClassroomForm({ ...classroomForm, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cls-teacher-uid">
                          老师UID <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cls-teacher-uid"
                          type="number"
                          placeholder="请输入老师UID"
                          value={classroomForm.teacherUid}
                          onChange={(e) =>
                            setClassroomForm({ ...classroomForm, teacherUid: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cls-start-time">
                          开始时间 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cls-start-time"
                          type="datetime-local"
                          value={classroomForm.startTime}
                          onChange={(e) =>
                            setClassroomForm({ ...classroomForm, startTime: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cls-end-time">
                          结束时间 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cls-end-time"
                          type="datetime-local"
                          value={classroomForm.endTime}
                          onChange={(e) =>
                            setClassroomForm({ ...classroomForm, endTime: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          "创建课堂"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
