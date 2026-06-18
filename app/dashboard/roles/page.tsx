"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ShieldCheck, Users } from "lucide-react"

import { Header } from "@/components/dashboard/header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ACTIONS, RESOURCES, ROLES, type Action, type Resource, type Role, getPermissions } from "@/lib/permissions"
import { usePermission } from "@/lib/hooks/usePermission"

const ROLE_LABELS: Record<Role, string> = {
  admin: "超级管理员",
  operator: "运营人员",
  sales: "销售顾问",
  head_teacher: "班主任",
  teacher: "教师",
  academic_affairs: "教务",
  finance: "财务",
  teacher_recruiter: "招师",
  hr: "人事",
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "负责系统级管理、基础数据和用户权限查看。",
  operator: "负责线索录入、基础运营查看和待办创建。",
  sales: "负责线索跟进、试听转化和订单录入。",
  head_teacher: "负责正式生服务、排课、回访和课程跟进。",
  teacher: "负责个人相关课程、学生和教师资料维护。",
  academic_affairs: "负责试听匹配、课节、课程和教师教学流程。",
  finance: "负责订单、课时异动、财务打款和入库确认查看。",
  teacher_recruiter: "负责老师候选人约面、初试和录像上传。",
  hr: "负责人力相关查看、绩效核对和入库确认。",
}

const RESOURCE_LABELS: Record<Resource, string> = {
  leads: "线索",
  trialLessons: "试听",
  students: "学生",
  formalOrders: "正式订单",
  classSessions: "课节",
  courses: "课程",
  transactions: "课程异动",
  teacherCandidates: "老师面试",
  teachers: "老师库",
  dictionaries: "字典管理",
  users: "用户管理",
  todos: "待办事项",
  uploads: "通用上传",
}

const ACTION_LABELS: Record<Action, string> = {
  view: "查看",
  create: "创建",
  edit: "编辑",
  delete: "删除",
  feedback: "反馈",
  matchTeacher: "匹配老师",
  confirmTeacher: "确认老师",
  confirmTime: "确定时间",
  addLink: "上课链接",
  convert: "转化",
  schedule: "排课",
  manageHours: "课时管理",
  visit: "回访",
  verifyHours: "核对课时",
  payment: "打款",
  verifyPerformance: "核对业绩",
  interview: "约面",
  evaluate: "评价",
  confirmEntry: "入库确认",
  uploadVideo: "录像上传",
  reviewVideo: "录像复核",
  notes: "备注",
  assign: "分配",
}

const ROLES_IN_ORDER = Object.values(ROLES) as Role[]
const RESOURCES_IN_ORDER = Object.values(RESOURCES) as Resource[]
const ACTIONS_IN_ORDER = Object.values(ACTIONS) as Action[]

function formatActions(actions: Action[]) {
  return ACTIONS_IN_ORDER.filter((action) => actions.includes(action))
}

export default function RolesPage() {
  const { role, users, isLoading } = usePermission()
  const [selectedRole, setSelectedRole] = useState<Role>("admin")

  const canViewRoles = role === "admin" || (!isLoading && users.view())

  const roleStats = useMemo(() => {
    return ROLES_IN_ORDER.map((roleName) => {
      const resourcePermissions = RESOURCES_IN_ORDER.map((resource) => ({
        resource,
        actions: formatActions(getPermissions(roleName, resource)),
      }))
      const permissionCount = resourcePermissions.reduce((sum, item) => sum + item.actions.length, 0)
      const activeResourceCount = resourcePermissions.filter((item) => item.actions.length > 0).length

      return {
        role: roleName,
        resourcePermissions,
        permissionCount,
        activeResourceCount,
      }
    })
  }, [])

  const selectedRoleStats = roleStats.find((item) => item.role === selectedRole) ?? roleStats[0]
  const totalPermissions = roleStats.reduce((sum, item) => sum + item.permissionCount, 0)

  if (!isLoading && !canViewRoles) {
    return (
      <div className="flex h-full flex-col">
        <Header title="角色管理" description="查看系统角色和权限矩阵" />
        <div className="p-6">
          <Alert variant="destructive">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>无权访问</AlertTitle>
            <AlertDescription>当前账号没有用户或角色权限查看权限。</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="角色管理" description="查看系统角色和权限矩阵" />

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">系统角色</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{ROLES_IN_ORDER.length}</div>
              <p className="text-xs text-muted-foreground">覆盖业务、教务、财务、招师和管理角色</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">权限资源</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{RESOURCES_IN_ORDER.length}</div>
              <p className="text-xs text-muted-foreground">线索、学生、课节、老师和系统基础资源</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已配置动作</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalPermissions}</div>
              <p className="text-xs text-muted-foreground">来自当前代码权限矩阵的有效授权项</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>角色总览</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">切换角色查看资源范围和具体操作权限。</p>
              </div>
              <Badge variant="outline">{ROLE_LABELS[selectedRole]}</Badge>
            </div>
            <ScrollArea>
              <Tabs value={selectedRole} onValueChange={(value) => setSelectedRole(value as Role)}>
                <TabsList className="h-auto flex-wrap justify-start">
                  {ROLES_IN_ORDER.map((roleName) => (
                    <TabsTrigger key={roleName} value={roleName} className="text-xs">
                      {ROLE_LABELS[roleName]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-4 md:col-span-2">
                <div className="text-sm font-medium">{ROLE_LABELS[selectedRole]}</div>
                <p className="mt-1 text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[selectedRole]}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">可访问资源</div>
                  <div className="mt-1 text-xl font-semibold">{selectedRoleStats.activeResourceCount}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">权限动作</div>
                  <div className="mt-1 text-xl font-semibold">{selectedRoleStats.permissionCount}</div>
                </div>
              </div>
            </div>

            <ScrollArea className="w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40 min-w-40">资源</TableHead>
                    <TableHead className="min-w-96">授权动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRoleStats.resourcePermissions.map(({ resource, actions }) => (
                    <TableRow key={resource}>
                      <TableCell className="font-medium">{RESOURCE_LABELS[resource]}</TableCell>
                      <TableCell>
                        {actions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {actions.map((action) => (
                              <Badge key={action} variant="secondary">
                                {ACTION_LABELS[action]}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">无权限</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>权限矩阵</CardTitle>
            <p className="text-sm text-muted-foreground">横向查看每个角色在各资源上的授权覆盖情况。</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 w-36 min-w-36 bg-card">资源</TableHead>
                    {ROLES_IN_ORDER.map((roleName) => (
                      <TableHead key={roleName} className="min-w-40 text-center">
                        {ROLE_LABELS[roleName]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RESOURCES_IN_ORDER.map((resource) => (
                    <TableRow key={resource}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{RESOURCE_LABELS[resource]}</TableCell>
                      {ROLES_IN_ORDER.map((roleName) => {
                        const actions = formatActions(getPermissions(roleName, resource))
                        return (
                          <TableCell key={`${roleName}-${resource}`} className="align-top">
                            {actions.length > 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-center whitespace-normal px-2 py-1 text-xs"
                                onClick={() => setSelectedRole(roleName)}
                              >
                                {actions.length} 项
                              </Button>
                            ) : (
                              <div className="text-center text-xs text-muted-foreground">-</div>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
