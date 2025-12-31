# 系统菜单与功能模块文档

## 📚 目录
- [1. 菜单层级结构](#1-菜单层级结构)
- [2. 详细功能说明](#2-详细功能说明)
- [3. 权限配置](#3-权限配置)
- [4. 实现方案](#4-实现方案)

---

## 1. 菜单层级结构

### 1.1 完整菜单树

```
系统菜单
├── 运营管理
│   └── 线索录入
│       └── 角色: 运营
│
├── 销售管理
│   ├── 线索管理
│   │   ├── 角色: 销售、班主任
│   │
│   ├── 试听课程
│   │   └── 角色: 销售、班主任、教务
│   │
│   └── 正式订单
│       └── 角色: 销售、班主任
│
├── 学生管理
│   └── 正式生管理
│       └── 角色: 班主任、教务
│
├── 异动记录
│   └── 角色: 班主任、教务
│
├── 老师面试
│   ├── 老师约面
│   │   └── 角色: 招师HR
│   │
│   ├── 初试管理
│   │   ├── 录像上传
│   │   │   └── 角色: 招师HR
│   │   │
│   │   └── 教学复核
│   │       └── 角色: 教务
│   │
│   ├── 待入库
│   │   └── 角色: 招师HR、教务
│   │
│   └── 储备
│       └── 角色: 招师HR
│
├── 老师库
│   ├── 老师库（教学版）
│   │   └── 角色: 教务
│   │
│   ├── 老师库（销售版）
│   │   └── 角色: 销售、班主任
│   │
│   ├── 新入库异常
│   │   └── 角色: 招师HR
│   │
│   ├── 试听转化质检
│   │   └── 角色: 教务
│   │
│   └── 课后服务质检
│       └── 角色: 教务
│
└── 教务管理
    ├── 学生库
    │   └── 角色: 教务
    │
    └── 待试听匹配
        └── 角色: 教务
```

---

## 2. 详细功能说明

### 2.1 运营管理

#### 线索录入

**路由**: `/dashboard/leads/new`

**使用角色**: 运营 (operator)

**功能描述**:
- 录入从小红书等渠道获取的销售线索
- 填写基础信息: 报单序号、录单日期、小红书账号来源、添加方式
- 填写学生信息: 年级、咨询学科、地域、家长微信
- 选择运营人员: 默认为当前登录用户
- 上传聊天截图
- 提交后自动设置状态为"运营未派单"

**数据表**: `leads`

**权限**:
```typescript
{
  create: true,    // 可以创建
  read: true,      // 可以查看
  update: true,    // 可以编辑(只能编辑自己创建的)
  delete: false    // 不能删除
}
```

---

### 2.2 销售管理

#### 线索管理

**路由**: `/dashboard/leads`

**使用角色**: 销售 (sales)、班主任 (head_teacher)

**功能描述**:
- 查看所有线索列表
- 销售操作:
  - 反馈线索添加状态(已添加/未添加)
  - 标记为"已反馈"后状态变更为"已添加"
  - 查看线索详情和聊天截图
- 班主任操作:
  - 查看分配给自己的线索
  - 创建试听课程
- 状态显示:
  - 线索添加状态: 运营未派单、已添加、未添加、销售未反馈
  - 线索转化状态: 试听、正式、空

**数据表**: `leads`

**权限**:
```typescript
// 销售
{
  read: true,
  update: 'partial', // 只能更新添加状态
  delete: false,
  feedback: true    // 可以反馈线索
}

// 班主任
{
  read: true,
  update: false,
  delete: false,
  feedback: false
}
```

---

#### 试听课程

**路由**: `/dashboard/trial-lessons`

**使用角色**: 销售 (sales)、班主任 (head_teacher)、教务 (academic_affairs)

**功能描述**:
- **销售/班主任**:
  - 新增试听课程(可从线索快速创建)
  - 填写学生信息、试讲科目、试听时间
  - 查看试听状态
- **教务**:
  - 匹配老师
  - 确认老师
  - 生成上课链接
  - 查看所有试听课程
- 试听状态流转:
  1. 待匹配老师 → 2. 待确认老师 → 3. 待确认时间 → 4. 待开链接 → 5. 已排待上课 → 6. 上完待反馈 → 7. 已完成

**数据表**: `trial_lessons`

**权限**:
```typescript
// 销售
{
  create: true,    // 可以创建
  read: true,      // 可以查看
  update: 'partial', // 只能编辑自己创建的
  delete: false,   // 不能删除
  matchTeacher: false // 不能匹配老师
}

// 班主任
{
  create: true,
  read: true,
  update: 'partial',
  delete: false,
  matchTeacher: false
}

// 教务
{
  create: false,
  read: true,
  update: true,    // 可以编辑
  delete: true,
  matchTeacher: true // 可以匹配老师
}
```

---

#### 正式订单

**路由**: `/dashboard/formal-orders`

**使用角色**: 销售 (sales)、班主任 (head_teacher)

**功能描述**:
- **销售**:
  - 录入新签订单
  - 选择学生
  - 填写订单信息: 学科、课时、付款信息
  - 上传付款凭证
- **班主任**:
  - 录入续费订单
  - 选择已有学生
  - 关联原订单
  - 调整课程信息
- 订单状态: active(活跃)、completed(已完成)、cancelled(已取消)、suspended(已暂停)

**数据表**: `formal_orders`

**权限**:
```typescript
// 销售
{
  create: {
    new: true,     // 可以录入新签订单
    renewal: false // 不能录入续费订单
  },
  read: true,
  update: 'partial', // 只能编辑自己的新签订单
  delete: false
}

// 班主任
{
  create: {
    new: false,    // 不能录入新签订单
    renewal: true  // 可以录入续费订单
  },
  read: true,
  update: 'partial', // 只能编辑自己的续费订单
  delete: false
}
```

---

### 2.3 学生管理

#### 正式生管理

**路由**: `/dashboard/students`

**使用角色**: 班主任 (head_teacher)、教务 (academic_affairs)

**功能描述**:
- **班主任**:
  - 查看负责的学生列表
  - 新建学生档案
  - 批量排课
  - 课时管理
  - 回访管理
  - 查看学生状态: 缺状态、快没课、已回访
  - 查看新生状态: 一周新生、两周新生、三周新生、四周新生、老生
- **教务**:
  - 查看所有学生
  - 查看学生订单和课程信息
  - 查看回访记录
- 学生状态计算:
  - 缺状态: status字段为空
  - 快没课: 课表截至离今天<7天
  - 已回访: 本月回访次数>0

**数据表**: `students`, `student_profiles`, `courses`, `visit_records`

**权限**:
```typescript
// 班主任
{
  create: true,    // 可以新建学生
  read: true,      // 可以查看(负责的学生)
  update: true,    // 可以编辑
  delete: false,   // 不能删除
  batchSchedule: true, // 批量排课
  manageHours: true,   // 课时管理
  manageVisits: true   // 回访管理
}

// 教务
{
  create: true,
  read: true,      // 可以查看所有学生
  update: true,
  delete: true,    // 可以删除
  batchSchedule: true,
  manageHours: true,
  manageVisits: false // 不负责回访
}
```

---

### 2.4 异动记录

**路由**: `/dashboard/transaction-records`

**使用角色**: 班主任 (head_teacher)、教务 (academic_affairs)

**功能描述**:
- **班主任**:
  - 录入退费申请
  - 填写退费原因、退费课时
  - 查看退费进度
- **教务**:
  - 核对课时金额
  - 审批退费申请
  - 查看所有异动记录
- 退费状态流转:
  1. 待核对金额 → 2. 待财务打款 → 3. 待核对业绩 → 4. 已完成
- **财务**:
  - 打款操作
- **人力**:
  - 核对退费业绩,扣减销售业绩

**数据表**: `transaction_records`, `course_changes`

**权限**:
```typescript
// 班主任
{
  create: true,    // 可以录入退费
  read: true,      // 可以查看自己的
  update: false,   // 不能修改
  delete: false
}

// 教务
{
  create: false,
  read: true,      // 可以查看所有
  update: true,    // 核对金额、审批
  delete: false
}

// 财务
{
  create: false,
  read: true,
  update: true,    // 打款
  delete: false
}

// 人力HRBP
{
  create: false,
  read: true,
  update: true,    // 核对业绩
  delete: false
}
```

---

### 2.5 老师面试

#### 老师约面

**路由**: `/dashboard/teacher-candidates/interview`

**使用角色**: 招师HR (hr)

**功能描述**:
- 从每日线索导入候选人
- 安排面试时间
- 生成面试链接(腾讯会议、Zoom等)
- 发送面试邀请
- 查看待约面候选人列表

**数据表**: `teacher_candidates`

**权限**:
```typescript
{
  create: true,    // 可以创建约面
  read: true,
  update: true,    // 可以编辑约面信息
  delete: false
}
```

---

#### 初试管理 - 录像上传

**路由**: `/dashboard/teacher-candidates/upload`

**使用角色**: 招师HR (hr)

**功能描述**:
- 上传面试录像
- 上传试讲视频
- 填写面试评分表:
  - 逻辑表达能力
  - 礼仪着装/精神面貌
  - 课件准备充分度
  - 总体评分
  - 初试评价
  - 中高考分数

**数据表**: `teacher_candidates`

**权限**:
```typescript
{
  create: false,
  read: true,
  update: true,    // 上传录像、填写评分
  delete: false
}
```

---

#### 初试管理 - 教学复核

**路由**: `/dashboard/teacher-candidates/review`

**使用角色**: 教务 (academic_affairs)

**功能描述**:
- 查看面试录像
- 查看面试评分
- 填写复核评价:
  - 复核结果(通过/不通过/待定)
  - 复核评价(定薪依据)
  - 批准时薪
  - 老师级别
  - 能否排毕业班
- 决定是否入库

**数据表**: `teacher_candidates`

**权限**:
```typescript
{
  create: false,
  read: true,
  update: true,    // 复核、定薪
  delete: false,
  review: true,    // 复核权限
  pricing: true    // 定薪权限
}
```

---

#### 待入库

**路由**: `/dashboard/teacher-candidates/pending`

**使用角色**: 招师HR (hr)、教务 (academic_affairs)

**功能描述**:
- 查看已通过复核的候选人
- 准备入库到老师库
- 创建老师档案
- 上传形象照
- 填写入库备注

**数据表**: `teacher_candidates`, `teacher_profiles`, `hire_records`

**权限**:
```typescript
// 招师HR
{
  read: true,
  update: 'partial', // 准备入库信息
  delete: false
}

// 教务
{
  read: true,
  update: true,    // 最终确认入库
  delete: false
}
```

---

#### 储备

**路由**: `/dashboard/teacher-candidates/reserve`

**使用角色**: 招师HR (hr)

**功能描述**:
- 查看储备候选人
- 暂时不入库的老师
- 可以重新激活
- 查看储备原因

**数据表**: `teacher_candidates`

**权限**:
```typescript
{
  read: true,
  update: true,    // 可以激活储备候选人
  delete: false
}
```

---

### 2.6 老师库

#### 老师库（教学版）

**路由**: `/dashboard/teachers/teaching`

**使用角色**: 教务 (academic_affairs)

**功能描述**:
- 查看所有老师详细信息
- 管理老师档案:
  - 基本信息
  - 教学信息(学科、年级、教学风格)
  - 可排课时间
  - 教学经验
  - 提分案例
- 管理备注信息
- 查看ClassIn同步数据
- 核对课耗信息

**数据表**: `teacher_profiles`, `teachers`, `teacher_classin`

**权限**:
```typescript
{
  read: true,
  update: true,    // 可以编辑所有字段
  delete: true,    // 可以删除
  notes: true,     // 备注管理
  sync: true       // ClassIn同步
}
```

---

#### 老师库（销售版）

**路由**: `/dashboard/teachers/sales`

**使用角色**: 销售 (sales)、班主任 (head_teacher)

**功能描述**:
- 查看老师基础信息
- 查看教授学科、年级
- 查看教学特点
- 查看可排课时间
- **不能编辑** (只读视图)
- 用于为试听和正式订单匹配合适老师

**数据表**: `teacher_profiles`, `teachers`

**权限**:
```typescript
{
  read: true,
  update: false,   // 不能编辑
  delete: false,
  notes: false     // 只读备注
}
```

---

#### 新入库异常

**路由**: `/dashboard/teachers/exceptions`

**使用角色**: 招师HR (hr)

**功能描述**:
- 查看入库后出现异常的老师
- 处理异常情况
- 记录异常原因
- 跟踪处理进度

**数据表**: `teacher_profiles`, `teacher_exceptions`(新建)

**权限**:
```typescript
{
  read: true,
  update: true,    // 处理异常
  delete: false
}
```

---

#### 试听转化质检

**路由**: `/dashboard/quality/trial-conversion`

**使用角色**: 教务 (academic_affairs)

**功能描述**:
- 查看所有试听课程
- 检查试听转化率
- 标记异常转化
- 分析未转化原因
- 生成质检报告

**数据表**: `trial_lessons`, `quality_reports`(新建)

**权限**:
```typescript
{
  read: true,
  update: true,    // 标记异常、填写质检报告
  delete: false
}
```

---

#### 课后服务质检

**路由**: `/dashboard/quality/service`

**使用角色**: 教务 (academic_affairs)

**功能描述**:
- 查看课后服务情况
- 检查回访记录
- 评估服务质量
- 标记服务问题
- 生成质检报告

**数据表**: `visit_records`, `quality_reports`

**权限**:
```typescript
{
  read: true,
  update: true,    // 标记问题、填写质检报告
  delete: false
}
```

---

### 2.7 教务管理

#### 学生库

**路由**: `/dashboard/academic/students`

**使用角色**: 教务 (academic_affairs)

**功能描述**:
- 查看所有学生信息
- 查看学生订单详情
- 查看课程排课情况
- 查看回访记录
- 查看异动记录
- 查看课耗信息
- 统计分析

**数据表**: `students`, `student_profiles`, `orders`, `courses`, `visit_records`, `transaction_records`

**权限**:
```typescript
{
  read: true,      // 可以查看所有
  update: true,    // 可以编辑
  delete: true     // 可以删除
}
```

---

#### 待试听匹配

**路由**: `/dashboard/academic/pending-trials`

**使用角色**: 教务 (academic_affairs)

**功能描述**:
- 查看待匹配老师的试听课程
- 根据学科、年级、时间匹配合适老师
- 批量匹配老师
- 发送老师确认
- 生成上课链接

**数据表**: `trial_lessons`, `teacher_profiles`

**权限**:
```typescript
{
  read: true,
  update: true,    // 匹配老师
  delete: false,
  batchMatch: true // 批量匹配
}
```

---

## 3. 权限配置

### 3.1 完整权限矩阵

| 功能模块 | 运营 | 销售 | 班主任 | 教务 | 老师 | 招师HR | 财务 | 人力 |
|---------|-----|------|--------|------|------|--------|------|------|
| **线索录入** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **线索管理** | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ |
| **线索反馈** | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **试听课程-创建** | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **试听课程-匹配** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **试听课程-查看** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **新签订单** | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **续费订单** | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **学生管理-创建** | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **学生管理-排课** | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **学生管理-回访** | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **异动记录-申请** | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **异动记录-审批** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **异动记录-打款** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **异动记录-业绩核对** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **老师约面** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| **初试管理-上传** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| **初试管理-复核** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **老师库-教学版** | ✗ | ✗ | ✗ | ✓ | 部分 | ✗ | ✗ | ✗ |
| **老师库-销售版** | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **质检** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **待试听匹配** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |

### 3.2 角色代码映射

| 中文名称 | 英文代码 | 英文名称 |
|---------|---------|---------|
| 管理员 | admin | Administrator |
| 运营 | operator | Operator |
| 销售 | sales | Sales |
| 班主任 | head_teacher | Head Teacher |
| 教务 | academic_affairs | Academic Affairs |
| 老师 | teacher | Teacher |
| 招师HR | hr | HR Recruiter |
| 财务 | finance | Finance |
| 人力HRBP | hr_bp | HR Business Partner |

---

## 4. 实现方案

### 4.1 菜单配置文件

创建 `lib/menu-config.ts`:

```typescript
import {
  LayoutDashboard,
  Target,
  MessageCircle,
  Video,
  FileText,
  Users,
  Briefcase,
  UserPlus,
  Upload,
  CheckCircle,
  Clock,
  Database,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Settings,
} from 'lucide-react';

export interface MenuItem {
  name: string;
  href: string;
  icon?: any;
  roles?: string[]; // 允许访问的角色
  children?: MenuItem[];
}

export const menuConfig: MenuItem[] = [
  {
    name: '运营管理',
    icon: LayoutDashboard,
    roles: ['admin', 'operator'],
    children: [
      {
        name: '线索录入',
        href: '/dashboard/leads/new',
        roles: ['admin', 'operator'],
      },
    ],
  },
  {
    name: '销售管理',
    icon: Target,
    roles: ['admin', 'sales', 'head_teacher'],
    children: [
      {
        name: '线索管理',
        href: '/dashboard/leads',
        roles: ['admin', 'operator', 'sales', 'head_teacher'],
      },
      {
        name: '试听课程',
        href: '/dashboard/trial-lessons',
        roles: ['admin', 'sales', 'head_teacher', 'academic_affairs'],
      },
      {
        name: '正式订单',
        href: '/dashboard/formal-orders',
        roles: ['admin', 'sales', 'head_teacher'],
      },
    ],
  },
  {
    name: '学生管理',
    icon: Users,
    roles: ['admin', 'head_teacher', 'academic_affairs'],
    children: [
      {
        name: '正式生管理',
        href: '/dashboard/students',
        roles: ['admin', 'head_teacher', 'academic_affairs'],
      },
      {
        name: '异动记录',
        href: '/dashboard/transaction-records',
        roles: ['admin', 'head_teacher', 'academic_affairs', 'finance', 'hr_bp'],
      },
    ],
  },
  {
    name: '老师面试',
    icon: UserPlus,
    roles: ['admin', 'hr', 'academic_affairs'],
    children: [
      {
        name: '老师约面',
        href: '/dashboard/teacher-candidates/interview',
        roles: ['admin', 'hr'],
      },
      {
        name: '初试管理',
        href: '/dashboard/teacher-candidates',
        roles: ['admin', 'hr', 'academic_affairs'],
      },
      {
        name: '待入库',
        href: '/dashboard/teacher-candidates/pending',
        roles: ['admin', 'hr', 'academic_affairs'],
      },
      {
        name: '储备',
        href: '/dashboard/teacher-candidates/reserve',
        roles: ['admin', 'hr'],
      },
    ],
  },
  {
    name: '老师库',
    icon: GraduationCap,
    roles: ['admin', 'academic_affairs', 'sales', 'head_teacher', 'teacher'],
    children: [
      {
        name: '老师库（教学版）',
        href: '/dashboard/teachers/teaching',
        roles: ['admin', 'academic_affairs'],
      },
      {
        name: '老师库（销售版）',
        href: '/dashboard/teachers/sales',
        roles: ['admin', 'sales', 'head_teacher'],
      },
      {
        name: '新入库异常',
        href: '/dashboard/teachers/exceptions',
        roles: ['admin', 'hr'],
      },
      {
        name: '试听转化质检',
        href: '/dashboard/quality/trial-conversion',
        roles: ['admin', 'academic_affairs'],
      },
      {
        name: '课后服务质检',
        href: '/dashboard/quality/service',
        roles: ['admin', 'academic_affairs'],
      },
    ],
  },
  {
    name: '教务管理',
    icon: Settings,
    roles: ['admin', 'academic_affairs'],
    children: [
      {
        name: '学生库',
        href: '/dashboard/academic/students',
        roles: ['admin', 'academic_affairs'],
      },
      {
        name: '待试听匹配',
        href: '/dashboard/academic/pending-trials',
        roles: ['admin', 'academic_affairs'],
      },
    ],
  },
];

// 根据用户角色过滤菜单
export function filterMenuByRole(menu: MenuItem[], userRole: string): MenuItem[] {
  return menu
    .filter(item => {
      // 如果没有配置角色限制,默认所有角色可见
      if (!item.roles) return true;
      return item.roles.includes(userRole) || item.roles.includes('admin');
    })
    .map(item => ({
      ...item,
      children: item.children
        ? filterMenuByRole(item.children, userRole)
        : undefined,
    }))
    .filter(item => {
      // 如果有子菜单,只显示有子菜单的项
      if (item.children) {
        return item.children.length > 0;
      }
      return true;
    });
}
```

### 4.2 Sidebar组件使用

```typescript
// components/dashboard/sidebar.tsx
import { menuConfig, filterMenuByRole } from '@/lib/menu-config';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export function Sidebar() {
  const { user } = useCurrentUser();
  const userRole = user?.role || 'sales';

  const filteredMenu = filterMenuByRole(menuConfig, userRole);

  return (
    <nav className="space-y-6">
      {filteredMenu.map((item) => (
        <div key={item.name}>
          <h3 className="mb-2 text-sm font-semibold">{item.name}</h3>
          {item.children && (
            <ul className="space-y-1">
              {item.children.map((child) => (
                <li key={child.href}>
                  <Link href={child.href}>
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
```

### 4.3 路由权限中间件

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const user = await verifyAuthToken(token);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 获取请求路径
  const path = request.nextUrl.pathname;

  // 检查权限
  const hasAccess = checkPathPermission(path, user.role);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

function checkPathPermission(path: string, role: string): boolean {
  // 定义路径权限映射
  const pathPermissions: Record<string, string[]> = {
    '/dashboard/leads/new': ['admin', 'operator'],
    '/dashboard/leads': ['admin', 'operator', 'sales', 'head_teacher'],
    '/dashboard/trial-lessons': ['admin', 'sales', 'head_teacher', 'academic_affairs'],
    '/dashboard/formal-orders': ['admin', 'sales', 'head_teacher'],
    '/dashboard/students': ['admin', 'head_teacher', 'academic_affairs'],
    '/dashboard/teacher-candidates': ['admin', 'hr', 'academic_affairs'],
    '/dashboard/teachers/teaching': ['admin', 'academic_affairs'],
    '/dashboard/teachers/sales': ['admin', 'sales', 'head_teacher'],
    '/dashboard/academic': ['admin', 'academic_affairs'],
  };

  // 检查精确匹配
  if (pathPermissions[path]) {
    return pathPermissions[path].includes(role) || pathPermissions[path].includes('admin');
  }

  // 检查前缀匹配
  for (const [allowedPath, allowedRoles] of Object.entries(pathPermissions)) {
    if (path.startsWith(allowedPath)) {
      return allowedRoles.includes(role) || allowedRoles.includes('admin');
    }
  }

  return false;
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-01
**维护人员**: 开发团队
