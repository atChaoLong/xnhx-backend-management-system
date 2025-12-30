# 业务流程与权限设计文档

## 一、线索报单管理

### 1.1 业务角色
- **运营**：录入线索
- **销售**：反馈线索

### 1.2 线索状态定义

#### 状态分类

**线索添加状态** (lead_add_status)：
```typescript
enum LeadAddStatus {
  UNASSIGNED = 'unassigned',        // 运营未派单：抢单微信号为空
  ADDED = 'added',                  // 已添加：反馈是否添加=已添加 OR 产生试听
  NOT_ADDED = 'not_added',          // 未添加：反馈是否添加=未添加
  WAITING_FEEDBACK = 'waiting_feedback' // 销售未反馈：反馈是否添加为空 AND 没产生试听
}
```

**线索转化状态** (lead_convert_status)：
```typescript
enum LeadConvertStatus {
  TRIAL = 'trial',                  // 试听：产生试听 AND 没产生正式
  FORMAL = 'formal',                // 正式：产生正式
  EMPTY = 'empty'                   // 空：其余情况
}
```

### 1.3 状态计算逻辑

```typescript
// 线索添加状态计算
function calculateLeadAddStatus(lead: Lead): LeadAddStatus {
  // 1. 运营未派单
  if (!lead.xhs_source) {
    return LeadAddStatus.UNASSIGNED
  }

  // 2. 检查是否产生试听
  const hasTrialLesson = checkIfHasTrialLesson(lead.id)

  // 3. 已添加
  if (lead.feedback_added === '已添加' || hasTrialLesson) {
    return LeadAddStatus.ADDED
  }

  // 4. 未添加
  if (lead.feedback_added === '未添加') {
    return LeadAddStatus.NOT_ADDED
  }

  // 5. 销售未反馈
  if (!lead.feedback_added && !hasTrialLesson) {
    return LeadAddStatus.WAITING_FEEDBACK
  }

  return LeadAddStatus.WAITING_FEEDBACK
}

// 线索转化状态计算
function calculateLeadConvertStatus(lead: Lead): LeadConvertStatus {
  const hasFormalOrder = checkIfHasFormalOrder(lead.id)
  const hasTrialLesson = checkIfHasTrialLesson(lead.id)

  if (hasFormalOrder) {
    return LeadConvertStatus.FORMAL
  }

  if (hasTrialLesson) {
    return LeadConvertStatus.TRIAL
  }

  return LeadConvertStatus.EMPTY
}
```

### 1.4 权限配置

```typescript
// lib/route-permissions.ts
'/api/leads': {
  GET: { resource: RESOURCES.leads, action: ACTIONS.view },
  POST: { resource: RESOURCES.leads, action: ACTIONS.create },        // 运营
  PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },          // 运营
  DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },      // 运营
}

// 销售反馈线索
'/api/leads/feedback': {
  POST: { resource: RESOURCES.leads, action: ACTIONS.feedback },      // 销售
}
```

### 1.5 前端字段权限控制

| 字段 | 运营 | 销售 | 班主任 | 其他 |
|-----|------|------|--------|------|
| 抢单微信号 | ✅编辑 | ✅查看 | ✅查看 | ✅查看 |
| 反馈是否添加 | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 反馈备注 | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 其他线索信息 | ✅编辑 | ✅查看 | ✅查看 | ✅查看 |

---

## 二、试听信息管理

### 2.1 业务角色
- **销售**：新增试听
- **教务**：匹配老师

### 2.2 试听状态定义

```typescript
enum TrialLessonStatus {
  CANCELLED = 'cancelled',           // 取消试听：课程状态=取消试听
  WAITING_MATCH = 'waiting_match',   // 待匹配老师：初始状态
  WAITING_CONFIRM = 'waiting_confirm', // 待确认老师：匹配老师不为空 AND 确认老师为空
  WAITING_TIME = 'waiting_time',     // 待确认时间：匹配老师!=空 AND 确认老师!=空 AND 确定试听时间为空
  WAITING_LINK = 'waiting_link',     // 待开链接：匹配老师!=空 AND 确认老师!=空 AND 确定试听时间!=空 AND 上课链接为空
  SCHEDULED = 'scheduled',           // 已排待上课：上述都有 AND 确定试听时间<=今天
  WAITING_FEEDBACK = 'waiting_feedback', // 上完待反馈：确定试听时间>今天 AND 是否转化为空
  COMPLETED = 'completed'            // 已完成：是否转化不为空
}
```

### 2.3 状态计算逻辑

```typescript
function calculateTrialLessonStatus(lesson: TrialLesson): TrialLessonStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 1. 取消试听
  if (lesson.course_status === '取消试听') {
    return TrialLessonStatus.CANCELLED
  }

  // 2. 待匹配老师
  if (!lesson.matched_teacher) {
    return TrialLessonStatus.WAITING_MATCH
  }

  // 3. 待确认老师
  if (!lesson.confirmed_teacher) {
    return TrialLessonStatus.WAITING_CONFIRM
  }

  // 4. 待确认时间
  if (!lesson.confirmed_time) {
    return TrialLessonStatus.WAITING_TIME
  }

  // 5. 待开链接
  if (!lesson.class_link) {
    return TrialLessonStatus.WAITING_LINK
  }

  // 6. 已排待上课 OR 上完待反馈
  const lessonTime = new Date(lesson.confirmed_time)
  lessonTime.setHours(0, 0, 0, 0)

  if (lessonTime <= today) {
    return TrialLessonStatus.SCHEDULED
  } else if (!lesson.is_converted) {
    return TrialLessonStatus.WAITING_FEEDBACK
  }

  // 7. 已完成
  return TrialLessonStatus.COMPLETED
}
```

### 2.4 是否转化计算

```typescript
function calculateIsConverted(lesson: TrialLesson): boolean {
  const hasFormalOrder = checkIfHasFormalOrderFromLesson(lesson.id)

  if (hasFormalOrder) {
    return true
  }

  // 手动标记为"是"
  if (lesson.manual_converted === '是') {
    return true
  }

  // 其他选项都等于手动值
  if (lesson.manual_converted === '否' || lesson.manual_converted === '待定') {
    return false
  }

  return false
}
```

### 2.5 权限配置

```typescript
'/api/trial-lessons': {
  GET: { resource: RESOURCES.trialLessons, action: ACTIONS.view },
  POST: { resource: RESOURCES.trialLessons, action: ACTIONS.create },      // 销售
  PUT: { resource: RESOURCES.trialLessons, action: ACTIONS.edit },        // 销售
  DELETE: { resource: RESOURCES.trialLessons, action: ACTIONS.delete },
}

// 教务匹配老师
'/api/trial-lessons/match-teacher': {
  POST: { resource: RESOURCES.trialLessons, action: ACTIONS.matchTeacher }, // 教务
}

// 教务确认老师
'/api/trial-lessons/confirm-teacher': {
  POST: { resource: RESOURCES.trialLessons, action: ACTIONS.confirmTeacher }, // 教务
}

// 教务确定时间
'/api/trial-lessons/confirm-time': {
  POST: { resource: RESOURCES.trialLessons, action: ACTIONS.confirmTime }, // 教务
}

// 教务添加链接
'/api/trial-lessons/add-link': {
  POST: { resource: RESOURCES.trialLessons, action: ACTIONS.addLink }, // 教务
}

// 销售转化
'/api/trial-lessons/convert': {
  POST: { resource: RESOURCES.trialLessons, action: ACTIONS.convert }, // 销售
}
```

### 2.6 前端字段权限控制

| 字段 | 销售 | 教务 | 班主任 | 其他 |
|-----|------|------|--------|------|
| 学生信息 | ✅编辑 | ✅查看 | ✅查看 | ✅查看 |
| 匹配老师 | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 确认老师（教务） | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 确定试听时间 | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 上课链接 | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 是否转化（手动） | ✅编辑 | ❌ | ✅查看 | ✅查看 |
| 课程状态 | ✅编辑 | ✅编辑 | ✅查看 | ✅查看 |

---

## 三、学生库管理

### 3.1 业务角色
- **销售**：新建学生
- **班主任**：新建学生

### 3.2 权限配置

```typescript
'/api/students': {
  GET: { resource: RESOURCES.students, action: ACTIONS.view },
  POST: { resource: RESOURCES.students, action: ACTIONS.create },    // 销售、班主任
  PUT: { resource: RESOURCES.students, action: ACTIONS.edit },      // 销售、班主任
  DELETE: { resource: RESOURCES.students, action: ACTIONS.delete },
}
```

---

## 四、正式订单管理

### 4.1 业务角色
- **销售**：录入新签订单
- **班主任**：录入续费订单

### 4.2 订单类型定义

```typescript
enum OrderType {
  NEW = 'new',           // 新签：销售录入
  RENEWAL = 'renewal',   // 续费：班主任录入
}
```

### 4.3 权限配置

```typescript
'/api/formal-orders': {
  GET: { resource: RESOURCES.formalOrders, action: ACTIONS.view },
  POST: { resource: RESOURCES.formalOrders, action: ACTIONS.create }, // 销售、班主任
  PUT: { resource: RESOURCES.formalOrders, action: ACTIONS.edit },
  DELETE: { resource: RESOURCES.formalOrders, action: ACTIONS.delete },
}
```

### 4.4 前端权限控制

```typescript
// 销售只能创建新签订单
{user?.role === 'sales' && (
  <Button onClick={() => createOrder('new')}>新签订单</Button>
)}

// 班主任只能创建续费订单
{user?.role === 'head_teacher' && (
  <Button onClick={() => createOrder('renewal')}>续费订单</Button>
)}
```

---

## 五、学生管理（排课、课时、回访）

### 5.1 业务角色
- **班主任**：批量排课、课时管理、回访管理

### 5.2 学生状态定义

```typescript
enum StudentStatus {
  MISSING = 'missing',           // 缺状态：学生状态为空
  LOW_HOURS = 'low_hours',       // 快没课：课表截至离今天<7天
  NORMAL = 'normal',             // 正常
}

enum StudentNewStatus {
  WEEK_1 = 'week_1',             // 一周新生：首次报名在一周内
  WEEK_2 = 'week_2',             // 两周新生：首次报名在第2周
  WEEK_3 = 'week_3',             // 三周新生：首次报名在第3周
  WEEK_4 = 'week_4',             // 四周新生：首次报名在第4周
  OLD = 'old',                   // 老生：首次报名超过四周
}

enum VisitStatus {
  VISITED = 'visited',           // 已回访：本月回访次数>0
  NOT_VISITED = 'not_visited',   // 未回访：本月回访次数=0
}
```

### 5.3 状态计算逻辑

```typescript
// 学生状态
function calculateStudentStatus(student: Student): StudentStatus {
  if (!student.status) {
    return StudentStatus.MISSING
  }

  if (student.course_end_date) {
    const today = new Date()
    const endDate = new Date(student.course_end_date)
    const diffDays = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 7) {
      return StudentStatus.LOW_HOURS
    }
  }

  return StudentStatus.NORMAL
}

// 新生状态
function calculateStudentNewStatus(student: Student): StudentNewStatus {
  if (!student.first_enrollment_date) {
    return StudentNewStatus.OLD
  }

  const today = new Date()
  const enrollDate = new Date(student.first_enrollment_date)
  const diffWeeks = Math.floor((today.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24 * 7))

  if (diffWeeks < 1) return StudentNewStatus.WEEK_1
  if (diffWeeks < 2) return StudentNewStatus.WEEK_2
  if (diffWeeks < 3) return StudentNewStatus.WEEK_3
  if (diffWeeks < 4) return StudentNewStatus.WEEK_4

  return StudentNewStatus.OLD
}

// 回访状态
function calculateVisitStatus(student: Student): VisitStatus {
  // 查询本月回访记录数
  const thisMonthVisits = countVisitsThisMonth(student.id)

  return thisMonthVisits > 0 ? VisitStatus.VISITED : VisitStatus.NOT_VISITED
}
```

### 5.4 权限配置

```typescript
'/api/students': {
  GET: { resource: RESOURCES.students, action: ACTIONS.view },
  POST: { resource: RESOURCES.students, action: ACTIONS.create },
  PUT: { resource: RESOURCES.students, action: ACTIONS.edit },
  DELETE: { resource: RESOURCES.students, action: ACTIONS.delete },
}

// 班主任排课
'/api/students/schedule': {
  POST: { resource: RESOURCES.students, action: ACTIONS.schedule },   // 班主任
}

// 课时管理
'/api/students/manage-hours': {
  POST: { resource: RESOURCES.students, action: ACTIONS.manageHours }, // 班主任
}

// 回访管理
'/api/students/visit': {
  POST: { resource: RESOURCES.students, action: ACTIONS.visit },      // 班主任
}
```

---

## 六、招师面试管理

### 6.1 业务角色
- **人事（HR）**：约面信息、初试评价、录像上传
- **教学**：初试录像复核

### 6.2 权限配置

```typescript
'/api/teacher-candidates': {
  GET: { resource: RESOURCES.teacherCandidates, action: ACTIONS.view },
  POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.interview }, // 人事
  PUT: { resource: RESOURCES.teacherCandidates, action: ACTIONS.evaluate },    // 人事
  DELETE: { resource: RESOURCES.teacherCandidates, action: ACTIONS.delete },
}

// 人事上传录像
'/api/teacher-candidates/upload-video': {
  POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.uploadVideo }, // 人事
}

// 教学复核录像
'/api/teacher-candidates/review-video': {
  POST: { resource: RESOURCES.teacherCandidates, action: ACTIONS.reviewVideo }, // 教学
}
```

### 6.3 前端字段权限控制

| 字段 | 人事 | 教学 | 其他 |
|-----|------|------|------|
| 约面信息 | ✅编辑 | ✅查看 | ✅查看 |
| 初试评价 | ✅编辑 | ✅查看 | ✅查看 |
| 录像上传 | ✅编辑 | ❌ | ❌ |
| 录像复核 | ❌ | ✅编辑 | ❌ |

---

## 七、老师库管理

### 7.1 业务角色
- **老师**：信息录入
- **教学**：备注管理

### 7.2 权限配置

```typescript
'/api/teachers': {
  GET: { resource: RESOURCES.teachers, action: ACTIONS.view },
  POST: { resource: RESOURCES.teachers, action: ACTIONS.create },      // 老师
  PUT: { resource: RESOURCES.teachers, action: ACTIONS.edit },        // 老师
  DELETE: { resource: RESOURCES.teachers, action: ACTIONS.delete },
}

// 教学备注管理
'/api/teachers/notes': {
  POST: { resource: RESOURCES.teachers, action: ACTIONS.notes },      // 教学
}
```

---

## 八、课程异动（退费）管理

### 8.1 业务角色
- **班主任**：录入退费
- **教务**：核对课时金额
- **财务**：打款
- **人事**：核对退费业绩

### 8.2 退费状态定义

```typescript
enum RefundStatus {
  WAITING_VERIFY = 'waiting_verify',     // 待核对金额：提交后初始状态
  WAITING_PAYMENT = 'waiting_payment',   // 待财务打款：核对金额后
  WAITING_PERFORMANCE = 'waiting_performance', // 待核对业绩：待人力核对
  COMPLETED = 'completed',               // 已完成
}
```

### 8.3 状态流转

```
班主任录入退费
    ↓
待核对金额 (waiting_verify)
    ↓ 教务核对金额
待财务打款 (waiting_payment)
    ↓ 财务打款
待核对业绩 (waiting_performance)
    ↓ 人事核对业绩
已完成 (completed)
```

### 8.4 权限配置

```typescript
'/api/transactions': {
  GET: { resource: RESOURCES.transactions, action: ACTIONS.view },
  POST: { resource: RESOURCES.transactions, action: ACTIONS.create },    // 班主任
  PUT: { resource: RESOURCES.transactions, action: ACTIONS.edit },
  DELETE: { resource: RESOURCES.transactions, action: ACTIONS.delete },
}

// 教务核对课时
'/api/transactions/verify-hours': {
  POST: { resource: RESOURCES.transactions, action: ACTIONS.verifyHours }, // 教务
}

// 财务打款
'/api/transactions/payment': {
  POST: { resource: RESOURCES.transactions, action: ACTIONS.payment },    // 财务
}

// 人事核对业绩
'/api/transactions/verify-performance': {
  POST: { resource: RESOURCES.transactions, action: ACTIONS.verifyPerformance }, // 人事
}
```

### 8.5 前端字段权限控制

| 字段 | 班主任 | 教务 | 财务 | 人事 | 其他 |
|-----|--------|------|------|------|------|
| 退费信息 | ✅编辑 | ✅查看 | ✅查看 | ✅查看 | ✅查看 |
| 核对课时金额 | ❌ | ✅编辑 | ✅查看 | ✅查看 | ✅查看 |
| 打款信息 | ❌ | ❌ | ✅编辑 | ✅查看 | ✅查看 |
| 核对业绩 | ❌ | ❌ | ❌ | ✅编辑 | ✅查看 |

---

## 九、数据库视图或计算字段建议

### 9.1 线索表（leads）

建议添加计算字段：

```sql
ALTER TABLE leads ADD COLUMN lead_add_status TEXT;
ALTER TABLE leads ADD COLUMN lead_convert_status TEXT;

-- 使用数据库触发器或应用层计算
```

### 9.2 试听表（trial_lessons）

建议添加计算字段：

```sql
ALTER TABLE trial_lessons ADD COLUMN lesson_status TEXT;
ALTER TABLE trial_lessons ADD COLUMN is_converted BOOLEAN;
```

### 9.3 学生表（students）

建议添加计算字段：

```sql
ALTER TABLE students ADD COLUMN student_status TEXT;
ALTER TABLE students ADD COLUMN new_status TEXT;
ALTER TABLE students ADD COLUMN visit_status TEXT;

-- 或者在查询时实时计算
```

### 9.4 异动表（transactions）

建议添加计算字段：

```sql
ALTER TABLE transactions ADD COLUMN refund_status TEXT;
```

---

## 十、前端列表操作按钮设计

### 10.1 线索列表操作栏

```typescript
// 根据角色显示不同操作
{hasPermission(user?.role, RESOURCES.leads, ACTIONS.create) && (
  <Button>创建线索</Button>
)}

{hasPermission(user?.role, RESOURCES.leads, ACTIONS.edit) && (
  <Button onClick={() => editLead(lead)}>编辑</Button>
)}

{hasPermission(user?.role, RESOURCES.leads, ACTIONS.feedback) && (
  <Button onClick={() => feedbackLead(lead)}>反馈</Button>
)}

{hasPermission(user?.role, RESOURCES.leads, ACTIONS.delete) && (
  <Button onClick={() => deleteLead(lead)}>删除</Button>
)}
```

### 10.2 试听列表操作栏

```typescript
// 销售：新增试听
{hasPermission(user?.role, RESOURCES.trialLessons, ACTIONS.create) && (
  <Button>新增试听</Button>
)}

// 教务：匹配老师
{hasPermission(user?.role, RESOURCES.trialLessons, ACTIONS.matchTeacher) && (
  <Button onClick={() => matchTeacher(lesson)}>匹配老师</Button>
)}

// 教务：确认老师
{hasPermission(user?.role, RESOURCES.trialLessons, ACTIONS.confirmTeacher) && (
  <Button onClick={() => confirmTeacher(lesson)}>确认老师</Button>
)}

// 教务：确定时间
{hasPermission(user?.role, RESOURCES.trialLessons, ACTIONS.confirmTime) && (
  <Button onClick={() => confirmTime(lesson)}>确定时间</Button>
)}

// 教务：添加链接
{hasPermission(user?.role, RESOURCES.trialLessons, ACTIONS.addLink) && (
  <Button onClick={() => addLink(lesson)}>添加链接</Button>
)}

// 销售：转化
{hasPermission(user?.role, RESOURCES.trialLessons, ACTIONS.convert) && (
  <Button onClick={() => convertLesson(lesson)}>转化</Button>
)}
```

### 10.3 异动列表操作栏

```typescript
// 班主任：录入退费
{hasPermission(user?.role, RESOURCES.transactions, ACTIONS.create) && (
  <Button>录入退费</Button>
)}

// 教务：核对课时
{hasPermission(user?.role, RESOURCES.transactions, ACTIONS.verifyHours) && (
  <Button onClick={() => verifyHours(tx)}>核对课时</Button>
)}

// 财务：打款
{hasPermission(user?.role, RESOURCES.transactions, ACTIONS.payment) && (
  <Button onClick={() => payment(tx)}>打款</Button>
)}

// 人事：核对业绩
{hasPermission(user?.role, RESOURCES.transactions, ACTIONS.verifyPerformance) && (
  <Button onClick={() => verifyPerformance(tx)}>核对业绩</Button>
)}
```

---

## 十一、实施步骤

### Phase 1: 更新权限系统
- [x] 创建权限设计文档
- [ ] 更新 lib/permissions.ts 中的权限矩阵
- [ ] 更新 lib/route-permissions.ts 中的路由配置
- [ ] 添加新的操作类型（feedback, matchTeacher, confirmTeacher等）

### Phase 2: 数据库迁移
- [ ] 为各表添加状态计算字段
- [ ] 创建数据库函数或触发器
- [ ] 编写状态计算逻辑

### Phase 3: 后端实现
- [ ] 实现状态计算工具函数
- [ ] 创建新的 API 端点（反馈、匹配老师等）
- [ ] 在现有 API 中添加状态自动更新

### Phase 4: 前端实现
- [ ] 根据角色隐藏/显示按钮和字段
- [ ] 实现状态徽章显示
- [ ] 添加操作按钮
- [ ] 实现表单权限控制

### Phase 5: 测试与优化
- [ ] 测试各角色权限
- [ ] 测试状态计算逻辑
- [ ] 性能优化
- [ ] 用户体验优化

---

**文档版本**: 1.0
**创建日期**: 2025-12-30
**作者**: Claude Code
