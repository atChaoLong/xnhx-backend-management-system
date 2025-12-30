# 前端权限控制使用指南

## 一、使用 usePermission Hook

### 基础用法

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'

export default function LeadsPage() {
  const { leads, user } = usePermission()

  return (
    <div>
      <h1>线索管理</h1>

      {/* 只有运营人员能看到创建按钮 */}
      {leads.create() && (
        <Button>创建线索</Button>
      )}

      {/* 所有角色都能查看 */}
      <Table>
        {leads.map(lead => (
          <TableRow key={lead.id}>
            <TableCell>{lead.name}</TableCell>
            <TableCell>
              {/* 只有销售能反馈 */}
              {leads.feedback() && (
                <Button onClick={() => feedbackLead(lead)}>反馈</Button>
              )}
              {/* 只有运营能编辑和删除 */}
              {leads.edit() && (
                <Button onClick={() => editLead(lead)}>编辑</Button>
              )}
              {leads.delete() && (
                <Button onClick={() => deleteLead(lead)}>删除</Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  )
}
```

### 检查任意一个权限

```typescript
const { checkAnyPermission } = usePermission()

// 如果有创建或编辑权限就显示
{checkAnyPermission([
  { resource: RESOURCES.leads, action: ACTIONS.create },
  { resource: RESOURCES.leads, action: ACTIONS.edit }
]) && (
  <Button>操作</Button>
)}
```

### 获取资源的所有权限

```typescript
const { getResourcePermissions } = usePermission()

const permissions = getResourcePermissions(RESOURCES.leads)
// 返回: ['view', 'create', 'edit', 'delete'] 或其他权限列表
```

## 二、使用 Permission 组件

### 单个权限控制

```typescript
import { Permission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

export default function LeadsPage() {
  return (
    <div>
      {/* 只有有创建权限的用户能看到 */}
      <Permission resource={RESOURCES.leads} action={ACTIONS.create}>
        <Button>创建线索</Button>
      </Permission>

      {/* 如果没有权限，显示 fallback */}
      <Permission
        resource={RESOURCES.leads}
        action={ACTIONS.delete}
        fallback={<span>您没有删除权限</span>}
      >
        <Button>删除线索</Button>
      </Permission>
    </div>
  )
}
```

### 多个权限控制（满足任意一个）

```typescript
import { PermissionAny } from '@/lib/hooks/usePermission'

export default function TrialLessonsPage() {
  return (
    <div>
      {/* 销售或教务有一个能匹配老师就行 */}
      <PermissionAny
        permissions={[
          { resource: RESOURCES.trialLessons, action: ACTIONS.matchTeacher },
          { resource: RESOURCES.trialLessons, action: ACTIONS.confirmTeacher }
        ]}
      >
        <Button>老师操作</Button>
      </PermissionAny>
    </div>
  )
}
```

## 三、各页面权限控制示例

### 3.1 线索列表页面

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { Permission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export default function LeadsPage() {
  const { leads, user } = usePermission()

  return (
    <div className="space-y-4">
      {/* 页面标题和操作 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">线索管理</h1>

        {/* 运营：创建线索 */}
        <Permission resource={RESOURCES.leads} action={ACTIONS.create}>
          <Button>创建线索</Button>
        </Permission>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2">
        <Button variant="outline">全部</Button>
        <Button variant="outline">运营未派单</Button>
        <Button variant="outline">已添加</Button>
        <Button variant="outline">未添加</Button>
        <Button variant="outline">销售未反馈</Button>
      </div>

      {/* 线索列表 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>手机号</TableHead>
            <TableHead>抢单微信</TableHead>
            <TableHead>添加状态</TableHead>
            <TableHead>转化状态</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map(lead => (
            <TableRow key={lead.id}>
              <TableCell>{lead.name}</TableCell>
              <TableCell>{lead.phone}</TableCell>
              <TableCell>{lead.xhs_source || '-'}</TableCell>
              <TableCell>
                <Badge>{lead.addStatusName}</Badge>
              </TableCell>
              <TableCell>
                <Badge>{lead.convertStatusName}</Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                {/* 销售：反馈线索 */}
                <Permission
                  resource={RESOURCES.leads}
                  action={ACTIONS.feedback}
                >
                  <Button size="sm" variant="outline">
                    反馈
                  </Button>
                </Permission>

                {/* 运营：编辑线索 */}
                <Permission
                  resource={RESOURCES.leads}
                  action={ACTIONS.edit}
                >
                  <Button size="sm" variant="outline">
                    编辑
                  </Button>
                </Permission>

                {/* 运营：删除线索 */}
                <Permission
                  resource={RESOURCES.leads}
                  action={ACTIONS.delete}
                >
                  <Button size="sm" variant="destructive">
                    删除
                  </Button>
                </Permission>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 3.2 试听列表页面

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export default function TrialLessonsPage() {
  const { trialLessons } = usePermission()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">试听管理</h1>

        {/* 销售：新增试听 */}
        {trialLessons.create() && (
          <Button>新增试听</Button>
        )}
      </div>

      {/* 试听列表 */}
      <Table>
        <TableBody>
          {lessons.map(lesson => (
            <TableRow key={lesson.id}>
              <TableCell>{lesson.studentName}</TableCell>
              <TableCell>
                <Badge>{lesson.statusName}</Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                {/* 教务：匹配老师 */}
                {trialLessons.matchTeacher() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => matchTeacher(lesson)}
                  >
                    匹配老师
                  </Button>
                )}

                {/* 教务：确认老师 */}
                {trialLessons.confirmTeacher() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirmTeacher(lesson)}
                  >
                    确认老师
                  </Button>
                )}

                {/* 教务：确定时间 */}
                {trialLessons.confirmTime() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirmTime(lesson)}
                  >
                    确定时间
                  </Button>
                )}

                {/* 教务：添加链接 */}
                {trialLessons.addLink() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addLink(lesson)}
                  >
                    添加链接
                  </Button>
                )}

                {/* 销售：转化 */}
                {trialLessons.convert() && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => convertLesson(lesson)}
                  >
                    转化
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 3.3 学生列表页面

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export default function StudentsPage() {
  const { students } = usePermission()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">学生管理</h1>

        {/* 销售、班主任：新建学生 */}
        {students.create() && (
          <Button>新建学生</Button>
        )}
      </div>

      {/* 学生列表 */}
      <Table>
        <TableBody>
          {students.map(student => (
            <TableRow key={student.id}>
              <TableCell>{student.name}</TableCell>
              <TableCell>
                <Badge>{student.statusName}</Badge>
              </TableCell>
              <TableCell>
                <Badge>{student.newStatusName}</Badge>
              </TableCell>
              <TableCell>
                <Badge>{student.visitStatusName}</Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                {/* 班主任：排课 */}
                {students.schedule() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => schedule(student)}
                  >
                    排课
                  </Button>
                )}

                {/* 班主任：课时管理 */}
                {students.manageHours() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => manageHours(student)}
                  >
                    课时管理
                  </Button>
                )}

                {/* 班主任：回访 */}
                {students.visit() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => visit(student)}
                  >
                    回访
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 3.4 异动列表页面

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export default function TransactionsPage() {
  const { transactions } = usePermission()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">课程异动</h1>

        {/* 班主任：录入退费 */}
        {transactions.create() && (
          <Button>录入退费</Button>
        )}
      </div>

      {/* 异动列表 */}
      <Table>
        <TableBody>
          {transactions.map(tx => (
            <TableRow key={tx.id}>
              <TableCell>{tx.studentName}</TableCell>
              <TableCell>
                <Badge>{tx.refundStatusName}</Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                {/* 教务：核对课时 */}
                {transactions.verifyHours() && tx.refundStatus === 'waiting_verify' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifyHours(tx)}
                  >
                    核对课时
                  </Button>
                )}

                {/* 财务：打款 */}
                {transactions.payment() && tx.refundStatus === 'waiting_payment' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => payment(tx)}
                  >
                    打款
                  </Button>
                )}

                {/* 人事：核对业绩 */}
                {transactions.verifyPerformance() && tx.refundStatus === 'waiting_performance' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifyPerformance(tx)}
                  >
                    核对业绩
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 3.5 老师面试列表页面

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export default function TeacherCandidatesPage() {
  const { teacherCandidates } = usePermission()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">老师面试</h1>

        {/* 人事：约面 */}
        {teacherCandidates.interview() && (
          <Button>约面</Button>
        )}
      </div>

      {/* 面试列表 */}
      <Table>
        <TableBody>
          {candidates.map(candidate => (
            <TableRow key={candidate.id}>
              <TableCell>{candidate.name}</TableCell>
              <TableCell className="flex gap-2">
                {/* 人事：初试评价 */}
                {teacherCandidates.evaluate() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => evaluate(candidate)}
                  >
                    初试评价
                  </Button>
                )}

                {/* 人事：上传录像 */}
                {teacherCandidates.uploadVideo() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => uploadVideo(candidate)}
                  >
                    上传录像
                  </Button>
                )}

                {/* 教学：录像复核 */}
                {teacherCandidates.reviewVideo() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewVideo(candidate)}
                  >
                    录像复核
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 3.6 老师库列表页面

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export default function TeachersPage() {
  const { teachers } = usePermission()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">老师库</h1>

        {/* 老师：信息录入 */}
        {teachers.create() && (
          <Button>信息录入</Button>
        )}
      </div>

      {/* 老师列表 */}
      <Table>
        <TableBody>
          {teachers.map(teacher => (
            <TableRow key={teacher.id}>
              <TableCell>{teacher.name}</TableCell>
              <TableCell className="flex gap-2">
                {/* 教学：备注管理 */}
                {teachers.notes() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => manageNotes(teacher)}
                  >
                    备注管理
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

## 四、侧边栏菜单权限控制

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import Link from 'next/link'

export function Sidebar() {
  const { leads, trialLessons, students, formalOrders, transactions, teacherCandidates, teachers } = usePermission()

  const menuItems = [
    // 线索管理 - 所有角色都能看
    { href: '/dashboard/leads', label: '线索管理', show: leads.view() },

    // 试听管理 - 所有角色都能看
    { href: '/dashboard/trial-lessons', label: '试听管理', show: trialLessons.view() },

    // 学生管理 - 销售、班主任、教师能看
    { href: '/dashboard/students', label: '学生管理', show: students.view() },

    // 正式订单 - 销售、班主任能看
    { href: '/dashboard/formal-orders', label: '正式订单', show: formalOrders.view() },

    // 课程异动 - 所有角色都能看
    { href: '/dashboard/transactions', label: '课程异动', show: transactions.view() },

    // 老师面试 - 所有角色都能看
    { href: '/dashboard/teacher-candidates', label: '老师面试', show: teacherCandidates.view() },

    // 老师库 - 所有角色都能看
    { href: '/dashboard/teachers', label: '老师库', show: teachers.view() },
  ].filter(item => item.show)

  return (
    <nav className="space-y-2">
      {menuItems.map(item => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

## 五、表单字段权限控制

### 线索表单

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Input, Textarea } from '@/components/ui/input'

export function LeadForm({ lead }) {
  const { leads, user } = usePermission()

  return (
    <form>
      {/* 所有角色都能查看，但只有运营能编辑 */}
      <Input
        name="name"
        defaultValue={lead?.name}
        disabled={!leads.edit()}
      />

      {/* 只有销售能编辑反馈字段 */}
      <Textarea
        name="feedback_added"
        defaultValue={lead?.feedback_added}
        disabled={!leads.feedback()}
      />

      {/* 只有运营能编辑抢单微信 */}
      <Input
        name="xhs_source"
        defaultValue={lead?.xhs_source}
        disabled={!leads.edit()}
      />
    </form>
  )
}
```

### 试听表单

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { Input } from '@/components/ui/input'

export function TrialLessonForm({ lesson }) {
  const { trialLessons } = usePermission()

  return (
    <form>
      {/* 教务：匹配老师 */}
      <Input
        name="matched_teacher"
        defaultValue={lesson?.matched_teacher}
        disabled={!trialLessons.matchTeacher()}
      />

      {/* 教务：确认老师 */}
      <Input
        name="confirmed_teacher"
        defaultValue={lesson?.confirmed_teacher}
        disabled={!trialLessons.confirmTeacher()}
      />

      {/* 教务：确定时间 */}
      <Input
        name="confirmed_time"
        type="datetime-local"
        defaultValue={lesson?.confirmed_time}
        disabled={!trialLessons.confirmTime()}
      />

      {/* 教务：上课链接 */}
      <Input
        name="class_link"
        defaultValue={lesson?.class_link}
        disabled={!trialLessons.addLink()}
      />

      {/* 销售：是否转化 */}
      <select
        name="manual_converted"
        defaultValue={lesson?.manual_converted}
        disabled={!trialLessons.convert()}
      >
        <option value="">请选择</option>
        <option value="是">是</option>
        <option value="否">否</option>
        <option value="待定">待定</option>
      </select>
    </form>
  )
}
```

## 六、最佳实践

### 1. 组合权限检查

```typescript
// 检查是否可以创建线索（运营）或试听（销售）
const canCreateAny = usePermission().checkAnyPermission([
  { resource: RESOURCES.leads, action: ACTIONS.create },
  { resource: RESOURCES.trialLessons, action: ACTIONS.create },
])
```

### 2. 条件渲染优化

```typescript
// 好的做法：使用变量存储权限检查结果
const { leads } = usePermission()
const canEdit = leads.edit()
const canDelete = leads.delete()

{canEdit && <Button>编辑</Button>}
{canDelete && <Button>删除</Button>}

// 避免：重复调用权限检查
{leads.edit() && <Button>编辑</Button>}
{leads.edit() && <Button>另一个按钮</Button>} // 重复调用
```

### 3. 加载状态处理

```typescript
const { user, leads, role } = usePermission()

if (!user) {
  return <div>加载中...</div>
}

if (!role) {
  return <div>未登录</div>
}

// 主要内容
return <div>...</div>
```

### 4. 权限错误提示

```typescript
{!leads.create() ? (
  <Alert>
    您没有创建线索的权限，请联系管理员。
  </Alert>
) : (
  <Button>创建线索</Button>
)}
```

## 七、常见问题

### Q1: 如何处理跨角色权限？

```typescript
// 使用 checkAnyPermission
const { checkAnyPermission } = usePermission()

const canOperate = checkAnyPermission([
  { resource: RESOURCES.leads, action: ACTIONS.create },    // 运营
  { resource: RESOURCES.leads, action: ACTIONS.feedback },  // 销售
])
```

### Q2: 如何根据状态显示不同按钮？

```typescript
{lesson.status === 'waiting_match' && trialLessons.matchTeacher() && (
  <Button>匹配老师</Button>
)}

{lesson.status === 'waiting_confirm' && trialLessons.confirmTeacher() && (
  <Button>确认老师</Button>
)}
```

### Q3: 如何处理批量操作权限？

```typescript
const { students } = usePermission()

{students.schedule() && (
  <Button onClick={() => batchSchedule(selectedStudents)}>
    批量排课
  </Button>
)}
```

---

**文档版本**: 1.0
**创建日期**: 2025-12-30
**作者**: Claude Code
