# 角色权限配置文档

## 📚 目录
- [1. 角色定义](#1-角色定义)
- [2. 权限矩阵](#2-权限矩阵)
- [3. 模块权限详解](#3-模块权限详解)
- [4. 权限实现方案](#4-权限实现方案)

---

## 1. 角色定义

### 1.1 角色列表

| 角色代码 | 角色名称 | 英文名称 | 描述 |
|---------|---------|---------|------|
| `admin` | 管理员 | Administrator | 系统管理员，拥有所有权限 |
| `operator` | 运营 | Operator | 负责线索录入和管理 |
| `sales` | 销售 | Sales | 负责线索反馈、试听创建、新签订单录入 |
| `head_teacher` | 班主任 | Head Teacher | 负责学生管理、续费订单、排课、回访 |
| `academic_affairs` | 教务 | Academic Affairs | 负责老师匹配、课时核算、面试复核 |
| `teacher` | 老师 | Teacher | 授课老师，管理个人信息 |
| `hr` | 招师HR | HR Recruiter | 负责老师招聘、约面、面试 |
| `finance` | 财务 | Finance | 负责打款、财务核算 |
| `hr_bp` | 人力HRBP | HR Business Partner | 负责退费业绩核对 |

---

## 2. 权限矩阵

### 2.1 核心业务权限矩阵

| 操作模块 | 具体操作 | admin | operator | sales | head_teacher | academic_affairs | teacher | hr | finance | hr_bp |
|---------|---------|-------|----------|-------|--------------|------------------|---------|----|----|-------|
| **线索管理** | | | | | | | | | | |
| | 录入线索 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | 查看线索 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| | 编辑线索 | ✓ | ✓ | 部分 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 反馈线索 | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | 删除线索 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **试听管理** | | | | | | | | | | |
| | 新增试听 | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | 匹配老师 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 编辑试听 | ✓ | ✗ | 部分 | 部分 | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看试听 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| | 删除试听 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **学生管理** | | | | | | | | | | |
| | 新建学生 | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看学生 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| | 编辑学生 | ✓ | ✗ | 部分 | 部分 | ✓ | 部分 | ✗ | ✗ | ✗ |
| | 删除学生 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **订单管理** | | | | | | | | | | |
| | 录入新签订单 | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 录入续费订单 | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看订单 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| | 编辑订单 | ✓ | ✗ | 部分 | 部分 | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 删除订单 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **排课管理** | | | | | | | | | | |
| | 批量排课 | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 课时管理 | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看课表 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| | 编辑课表 | ✓ | ✗ | ✗ | ✓ | ✓ | 部分 | ✗ | ✗ | ✗ |
| | 删除课表 | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **回访管理** | | | | | | | | | | |
| | 新增回访 | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看回访 | ✓ | ✓ | 部分 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 编辑回访 | ✓ | ✗ | 部分 | 部分 | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 删除回访 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **面试管理** | | | | | | | | | | |
| | 约面信息 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| | 初试评价 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ |
| | 录像上传 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| | 面试复核 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看面试 | ✓ | ✓ | ✗ | ✓ | ✓ | 部分 | ✓ | ✗ | ✗ |
| | 编辑面试 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | 部分 | ✗ | ✗ |
| | 定薪入库 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **老师档案** | | | | | | | | | | |
| | 信息录入 | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| | 查看老师 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| | 编辑老师 | ✓ | ✗ | ✗ | ✗ | ✓ | 部分 | ✗ | ✗ | ✗ |
| | 备注管理 | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| | 删除老师 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **异动管理** | | | | | | | | | | |
| | 申请异动 | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 审批异动 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 查看异动 | ✓ | ✓ | 部分 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 编辑异动 | ✓ | ✗ | ✗ | 部分 | ✓ | ✗ | ✗ | ✗ | ✗ |
| **退费管理** | | | | | | | | | | |
| | 录入退费 | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | 核对课时金额 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 打款 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| | 核对业绩 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| | 查看退费 | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| **待办事项** | | | | | | | | | | |
| | 创建待办 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| | 查看待办 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| | 编辑待办 | ✓ | 部分 | 部分 | 部分 | ✓ | 部分 | 部分 | 部分 | 部分 |
| | 删除待办 | ✓ | 部分 | 部分 | 部分 | ✓ | 部分 | 部分 | 部分 | 部分 |
| **系统管理** | | | | | | | | | | |
| | 用户管理 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | 角色管理 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| | 字典管理 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| | 数据统计 | ✓ | 部分 | 部分 | 部分 | ✓ | ✗ | ✗ | ✓ | ✓ |

---

## 3. 模块权限详解

### 3.1 线索管理模块 (leads)

#### 运营 (operator)
```typescript
{
  create: true,    // 录入线索
  read: true,      // 查看线索
  update: true,    // 编辑线索(只能编辑自己创建的)
  delete: false,   // 不能删除
  feedback: false  // 不能反馈
}
```

#### 销售 (sales)
```typescript
{
  create: false,   // 不能录入
  read: true,      // 可以查看
  update: 'partial', // 只能反馈状态
  delete: false,   // 不能删除
  feedback: true   // 反馈线索
}
```

### 3.2 试听管理模块 (trial-lessons)

#### 销售 (sales)
```typescript
{
  create: true,    // 新增试听
  read: true,      // 查看试听
  update: 'partial', // 只能编辑自己创建的
  delete: false,   // 不能删除
  matchTeacher: false // 不能匹配老师
}
```

#### 教务 (academic_affairs)
```typescript
{
  create: false,   // 不能新增
  read: true,      // 查看试听
  update: true,    // 可以编辑
  delete: true,    // 可以删除
  matchTeacher: true // 匹配老师
}
```

### 3.3 订单管理模块 (orders)

#### 销售 (sales)
```typescript
{
  create: {
    new: true,     // 可以录入新签订单
    renewal: false // 不能录入续费订单
  },
  read: true,      // 查看订单
  update: 'partial', // 只能编辑自己创建的新签订单
  delete: false    // 不能删除
}
```

#### 班主任 (head_teacher)
```typescript
{
  create: {
    new: false,    // 不能录入新签订单
    renewal: true  // 可以录入续费订单
  },
  read: true,      // 查看订单
  update: 'partial', // 只能编辑自己的续费订单
  delete: false    // 不能删除
}
```

### 3.4 排课管理模块 (class-schedules)

#### 班主任 (head_teacher)
```typescript
{
  batchSchedule: true,  // 批量排课
  manageHours: true,    // 课时管理
  read: true,           // 查看课表
  update: true,         // 编辑课表
  delete: true          // 删除课表
}
```

#### 老师 (teacher)
```typescript
{
  batchSchedule: false,  // 不能批量排课
  manageHours: false,    // 不能管理课时
  read: true,           // 只能查看自己的课表
  update: 'partial',    // 只能更新备注
  delete: false         // 不能删除
}
```

### 3.5 面试管理模块 (teacher-interview)

#### 招师HR (hr)
```typescript
{
  interviewArrange: true,  // 约面信息
  initialEvaluation: true,  // 初试评价
  uploadVideo: true,       // 录像上传
  review: false,           // 不能复核
  pricing: false,          // 不能定薪
  read: true,              // 查看面试
  update: 'partial'        // 只能编辑自己负责的
}
```

#### 教学 (academic_affairs)
```typescript
{
  interviewArrange: false, // 不能约面
  initialEvaluation: false, // 不能初试评价
  uploadVideo: false,      // 不能上传录像
  review: true,            // 面试复核
  pricing: true,           // 可以定薪
  read: true,              // 查看面试
  update: true             // 可以编辑
}
```

### 3.6 退费管理模块 (refunds)

#### 班主任 (head_teacher)
```typescript
{
  create: true,    // 录入退费
  read: true,      // 查看退费
  verify: false,   // 不能核对课时金额
  payment: false,  // 不能打款
  verifyPerformance: false // 不能核对业绩
}
```

#### 教务 (academic_affairs)
```typescript
{
  create: false,   // 不能录入
  read: true,      // 查看退费
  verify: true,    // 核对课时金额
  payment: false,  // 不能打款
  verifyPerformance: false // 不能核对业绩
}
```

#### 财务 (finance)
```typescript
{
  create: false,   // 不能录入
  read: true,      // 查看退费
  verify: false,   // 不能核对课时金额
  payment: true,   // 可以打款
  verifyPerformance: false // 不能核对业绩
}
```

#### 人力HRBP (hr_bp)
```typescript
{
  create: false,   // 不能录入
  read: true,      // 查看退费
  verify: false,   // 不能核对课时金额
  payment: false,  // 不能打款
  verifyPerformance: true // 核对业绩
}
```

---

## 4. 权限实现方案

### 4.1 权限定义文件

创建 `lib/permissions.ts`:

```typescript
/**
 * 权限定义
 */

// 权限动作枚举
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // 包含所有权限
}

// 资源类型枚举
export enum PermissionResource {
  LEADS = 'leads',
  TRIAL_LESSONS = 'trial_lessons',
  STUDENTS = 'students',
  ORDERS = 'orders',
  COURSES = 'courses',
  CLASS_SCHEDULES = 'class_schedules',
  VISIT_RECORDS = 'visit_records',
  TEACHER_CANDIDATES = 'teacher_candidates',
  INTERVIEW_SESSIONS = 'interview_sessions',
  TEACHER_PROFILES = 'teacher_profiles',
  COURSE_CHANGES = 'course_changes',
  REFUNDS = 'refunds',
  TODOS = 'todos',
  USERS = 'users',
  ROLES = 'roles',
  DICTIONARIES = 'dictionaries',
}

// 角色权限配置
export const RolePermissions: Record<string, Record<PermissionResource, PermissionAction[]>> = {
  admin: {
    [PermissionResource.LEADS]: [PermissionAction.MANAGE],
    [PermissionResource.TRIAL_LESSONS]: [PermissionAction.MANAGE],
    [PermissionResource.STUDENTS]: [PermissionAction.MANAGE],
    [PermissionResource.ORDERS]: [PermissionAction.MANAGE],
    [PermissionResource.COURSES]: [PermissionAction.MANAGE],
    [PermissionResource.CLASS_SCHEDULES]: [PermissionAction.MANAGE],
    [PermissionResource.VISIT_RECORDS]: [PermissionAction.MANAGE],
    [PermissionResource.TEACHER_CANDIDATES]: [PermissionAction.MANAGE],
    [PermissionResource.INTERVIEW_SESSIONS]: [PermissionAction.MANAGE],
    [PermissionResource.TEACHER_PROFILES]: [PermissionAction.MANAGE],
    [PermissionResource.COURSE_CHANGES]: [PermissionAction.MANAGE],
    [PermissionResource.REFUNDS]: [PermissionAction.MANAGE],
    [PermissionResource.TODOS]: [PermissionAction.MANAGE],
    [PermissionResource.USERS]: [PermissionAction.MANAGE],
    [PermissionResource.ROLES]: [PermissionAction.MANAGE],
    [PermissionResource.DICTIONARIES]: [PermissionAction.MANAGE],
  },

  operator: {
    [PermissionResource.LEADS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.TRIAL_LESSONS]: [PermissionAction.READ],
    [PermissionResource.STUDENTS]: [PermissionAction.READ],
    [PermissionResource.ORDERS]: [PermissionAction.READ],
    [PermissionResource.COURSES]: [PermissionAction.READ],
    [PermissionResource.CLASS_SCHEDULES]: [PermissionAction.READ],
    [PermissionResource.VISIT_RECORDS]: [PermissionAction.READ],
    [PermissionResource.TEACHER_CANDIDATES]: [PermissionAction.READ],
    [PermissionResource.TEACHER_PROFILES]: [PermissionAction.READ],
    [PermissionResource.COURSE_CHANGES]: [PermissionAction.READ],
    [PermissionResource.REFUNDS]: [PermissionAction.READ],
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },

  sales: {
    [PermissionResource.LEADS]: [PermissionAction.READ, PermissionAction.UPDATE], // 只能反馈
    [PermissionResource.TRIAL_LESSONS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE], // 只能编辑自己的
    [PermissionResource.STUDENTS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE], // 只能编辑自己的
    [PermissionResource.ORDERS]: [
      PermissionAction.CREATE, // 只能创建新签订单
      PermissionAction.READ,
      PermissionAction.UPDATE, // 只能编辑自己的新签订单
    ],
    [PermissionResource.COURSES]: [PermissionAction.READ],
    [PermissionResource.CLASS_SCHEDULES]: [PermissionAction.READ],
    [PermissionResource.VISIT_RECORDS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE], // 只能编辑自己的
    [PermissionResource.TEACHER_PROFILES]: [PermissionAction.READ],
    [PermissionResource.REFUNDS]: [PermissionAction.READ],
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },

  head_teacher: {
    [PermissionResource.LEADS]: [PermissionAction.READ],
    [PermissionResource.TRIAL_LESSONS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.STUDENTS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.ORDERS]: [
      PermissionAction.CREATE, // 只能创建续费订单
      PermissionAction.READ,
      PermissionAction.UPDATE, // 只能编辑自己的续费订单
    ],
    [PermissionResource.COURSES]: [PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.CLASS_SCHEDULES]: [
      PermissionAction.CREATE, // 批量排课
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [PermissionResource.VISIT_RECORDS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.TEACHER_CANDIDATES]: [PermissionAction.READ],
    [PermissionResource.INTERVIEW_SESSIONS]: [PermissionAction.READ],
    [PermissionResource.TEACHER_PROFILES]: [PermissionAction.READ, PermissionAction.UPDATE], // 备注管理
    [PermissionResource.COURSE_CHANGES]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE], // 申请异动
    [PermissionResource.REFUNDS]: [PermissionAction.CREATE, PermissionAction.READ], // 录入退费
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },

  academic_affairs: {
    [PermissionResource.LEADS]: [PermissionAction.READ],
    [PermissionResource.TRIAL_LESSONS]: [PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE], // 匹配老师
    [PermissionResource.STUDENTS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.ORDERS]: [
      PermissionAction.CREATE, // 可以录入新签订单
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ],
    [PermissionResource.COURSES]: [PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.CLASS_SCHEDULES]: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [PermissionResource.VISIT_RECORDS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.TEACHER_CANDIDATES]: [PermissionAction.READ],
    [PermissionResource.INTERVIEW_SESSIONS]: [
      PermissionAction.READ,
      PermissionAction.UPDATE, // 面试复核
    ],
    [PermissionResource.TEACHER_PROFILES]: [PermissionAction.READ, PermissionAction.UPDATE],
    [PermissionResource.COURSE_CHANGES]: [PermissionAction.READ, PermissionAction.UPDATE], // 审批异动
    [PermissionResource.REFUNDS]: [PermissionAction.READ, PermissionAction.UPDATE], // 核对课时金额
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
    [PermissionResource.DICTIONARIES]: [PermissionAction.MANAGE],
  },

  teacher: {
    [PermissionResource.TRIAL_LESSONS]: [PermissionAction.READ],
    [PermissionResource.STUDENTS]: [PermissionAction.READ],
    [PermissionResource.ORDERS]: [PermissionAction.READ],
    [PermissionResource.COURSES]: [PermissionAction.READ],
    [PermissionResource.CLASS_SCHEDULES]: [PermissionAction.READ, PermissionAction.UPDATE], // 只能更新备注
    [PermissionResource.TEACHER_PROFILES]: [
      PermissionAction.CREATE, // 信息录入
      PermissionAction.READ,
      PermissionAction.UPDATE, // 只能编辑自己的
    ],
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },

  hr: {
    [PermissionResource.LEADS]: [PermissionAction.READ],
    [PermissionResource.TEACHER_CANDIDATES]: [PermissionAction.READ, PermissionAction.CREATE, PermissionAction.UPDATE],
    [PermissionResource.INTERVIEW_SESSIONS]: [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE, // 约面、初试评价、录像上传
    ],
    [PermissionResource.TEACHER_PROFILES]: [PermissionAction.READ],
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },

  finance: {
    [PermissionResource.STUDENTS]: [PermissionAction.READ],
    [PermissionResource.ORDERS]: [PermissionAction.READ],
    [PermissionResource.COURSES]: [PermissionAction.READ],
    [PermissionResource.CLASS_SCHEDULES]: [PermissionAction.READ],
    [PermissionResource.REFUNDS]: [PermissionAction.READ, PermissionAction.UPDATE], // 打款
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },

  hr_bp: {
    [PermissionResource.STUDENTS]: [PermissionAction.READ],
    [PermissionResource.ORDERS]: [PermissionAction.READ],
    [PermissionResource.COURSES]: [PermissionAction.READ],
    [PermissionResource.CLASS_SCHEDULES]: [PermissionAction.READ],
    [PermissionResource.REFUNDS]: [PermissionAction.READ, PermissionAction.UPDATE], // 核对业绩
    [PermissionResource.TODOS]: [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE],
  },
};

// 检查权限函数
export function hasPermission(
  role: string,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  const permissions = RolePermissions[role]?.[resource] || [];
  return permissions.includes(PermissionAction.MANAGE) || permissions.includes(action);
}

// 检查多个权限
export function hasAnyPermission(
  role: string,
  resource: PermissionResource,
  actions: PermissionAction[]
): boolean {
  return actions.some(action => hasPermission(role, resource, action));
}

// 检查是否拥有资源的编辑权限(只能编辑自己创建的)
export function canEditOwnResource(
  role: string,
  resource: PermissionResource,
  resourceCreatorId: string,
  currentUserId: string
): boolean {
  if (!hasPermission(role, resource, PermissionAction.UPDATE)) {
    return false;
  }

  // 管理员和教务可以编辑所有
  if (role === 'admin' || role === 'academic_affairs') {
    return true;
  }

  // 其他角色只能编辑自己创建的
  return resourceCreatorId === currentUserId;
}
```

### 4.2 权限Hook使用

```typescript
// lib/hooks/usePermission.ts
import { useCurrentUser } from './useCurrentUser';
import { PermissionAction, PermissionResource, hasPermission } from '@/lib/permissions';

export function usePermission() {
  const { user } = useCurrentUser();

  return {
    can: (resource: PermissionResource, action: PermissionAction) => {
      if (!user) return false;
      return hasPermission(user.role, resource, action);
    },

    canCreate: (resource: PermissionResource) => {
      return usePermission().can(resource, PermissionAction.CREATE);
    },

    canRead: (resource: PermissionResource) => {
      return usePermission().can(resource, PermissionAction.READ);
    },

    canUpdate: (resource: PermissionResource) => {
      return usePermission().can(resource, PermissionAction.UPDATE);
    },

    canDelete: (resource: PermissionResource) => {
      return usePermission().can(resource, PermissionAction.DELETE);
    },

    canManage: (resource: PermissionResource) => {
      return usePermission().can(resource, PermissionAction.MANAGE);
    },
  };
}

// 使用示例
function LeadListPage() {
  const { canCreate, canUpdate, canDelete } = usePermission();

  return (
    <div>
      {canCreate(PermissionResource.LEADS) && (
        <Button>新增线索</Button>
      )}

      <Table>
        {leads.map(lead => (
          <TableRow key={lead.id}>
            <TableCell>{lead.name}</TableCell>
            <TableCell>
              {canUpdate(PermissionResource.LEADS) && (
                <Button>编辑</Button>
              )}
              {canDelete(PermissionResource.LEADS) && (
                <Button>删除</Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
```

### 4.3 API层权限校验

```typescript
// middleware.ts 或 API路由中
import { PermissionAction, PermissionResource, hasPermission } from '@/lib/permissions';
import { getUserRole } from '@/lib/auth';

export async function checkApiPermission(
  request: Request,
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
  const user = await getUserRole(request);

  if (!user) {
    return false;
  }

  return hasPermission(user.role, resource, action);
}

// 使用示例
export async function POST(request: Request) {
  // 检查是否有创建线索的权限
  const hasPermission = await checkApiPermission(
    request,
    PermissionResource.LEADS,
    PermissionAction.CREATE
  );

  if (!hasPermission) {
    return NextResponse.json(
      { error: '权限不足' },
      { status: 403 }
    );
  }

  // 继续处理请求...
}
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-01
**维护人员**: 开发团队
