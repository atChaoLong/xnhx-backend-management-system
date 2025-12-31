# 线上数据库实际表清单

## 📊 通过代码分析确认的线上表 (共17张)

### 从API路由和服务文件分析得出:

#### 1. **用户相关**
- `user_profiles` - 用户档案表
- `auth.users` - Supabase认证用户表(系统表)

#### 2. **线索管理**
- `leads` - 线索表
  - API: `/api/leads`, `/api/leads/[id]`
  - 服务: `lib/services/leads.ts`

- `daily_leads` - 每日线索表
  - API: `/api/daily-leads`
  - 服务: `lib/services/dailyLeads.ts`

#### 3. **老师管理**
- `teacher_candidates` - 老师候选人表
  - API: `/api/teacher-candidates`
  - 服务: `lib/services/teacherCandidates.ts`

- `teachers` - 老师表
  - API: `/api/teachers`, `/api/teachers/classin`, `/api/teachers/register-classin`
  - 服务: `lib/services/teachers.ts`

- `teacher_classin` - ClassIn老师同步表
  - 通过teachers服务访问

- `teacher_profiles` - 老师档案表
  - 在teacher_candidates服务中引用

#### 4. **学生管理**
- `students` - 学生表
  - API: `/api/students`, `/api/students/register-classin`
  - 服务: `lib/services/students.ts`

- `students_classin` - ClassIn学生同步表
  - 通过students服务访问

#### 5. **订单与课程**
- `trial_lessons` - 试听课程表
  - API: 存在但没有独立路由(可能在其他模块中)
  - 服务: `lib/services/trialLessons.ts`

- `formal_orders` - 正式订单表
  - API: `/api/formal-orders`
  - 服务: `lib/services/formalOrders.ts`

#### 6. **ClassIn集成**
- `class_classin` - ClassIn班级表
  - API: `/api/classin-sdk/course`

- `classroom_classin` - ClassIn课堂表
  - 通过班级关联访问

#### 7. **系统配置**
- `sys_dictionaries` - 系统字典表
  - 服务: `lib/services/dictionary.ts`

- `wechat_accounts` - 微信号管理表
  - API: `/api/wechat-accounts`
  - 服务: `lib/services/wechatAccounts.ts`
  - **注意**: 该表已废弃,改用user_profiles

#### 8. **异动记录**
- `transaction_records` - 异动记录表
  - API: `/api/transactions`
  - 服务: `lib/services/transactions.ts`

---

## 🔍 详细表结构分析

### user_profiles (用户档案表)
**用途**: 存储用户账号、角色和基本信息

**主要字段**:
```typescript
{
  id: string                      // UUID (关联auth.users)
  email: string                   // 邮箱
  name: string                    // 姓名
  role: 'admin' | 'operator' | 'sales' | 'head_teacher' | 'teacher' | 'academic_affairs' | 'finance' | 'hr'
  avatar_url?: string             // 头像URL
  created_at: string              // 创建时间
}
```

**API端点**:
- GET `/api/auth/profile` - 获取当前用户档案

---

### leads (线索表)
**用途**: 小红书等渠道的销售线索

**主要字段**:
```typescript
{
  id: string
  report_number: string           // 报单序号 (必填)
  entry_date: string              // 录单日期 (必填)
  xhs_source: string              // 小红书账号来源 (必填)
  add_method_code: string         // 添加方式代码 (必填)
  operator_id: string             // 运营人员ID (必填)
  grade_code?: string             // 年级代码
  subject_codes?: string[]        // 咨询学科数组
  region_ip?: string              // 地域IP
  parent_wechat?: string          // 家长微信号
  grab_wechat?: string            // 抢单微信(销售人员)
  chat_screenshots?: string       // 聊天截图(逗号分隔的URL)
  add_status?: string             // 添加状态 (unassigned/added/not_added/waiting_feedback)
  convert_status?: string         // 转化状态 (trial/formal/empty)
  duplicate_mark?: boolean        // 重复标记
  collision_operator?: string     // 冲突运营人员
  grab_user_id?: string           // 抢单用户ID
  add_feedback?: string           // 添加反馈
  feedback_time?: string          // 反馈时间
  created_by?: string             // 创建人姓名
  updated_by?: string             // 更新人姓名
  created_at: string
  updated_at: string
}
```

**业务流程**:
1. 运营录入线索
2. 系统自动计算add_status和convert_status
3. 销售反馈添加状态
4. 转化为试听或正式学生

**API端点**:
- GET `/api/leads` - 获取所有线索
- POST `/api/leads` - 创建线索
- GET `/api/leads/[id]` - 获取单条线索
- PUT `/api/leads/[id]` - 更新线索
- DELETE `/api/leads/[id]` - 删除线索

---

### teacher_candidates (老师候选人表)
**用途**: 老师面试全流程管理

**主要字段**:
```typescript
{
  id: string
  daily_lead_id?: string          // 从每日线索导入
  name: string                    // 姓名
  wechat_id: string               // 微信号 (必填)
  resume_url?: string             // 简历URL
  profile_photo_url?: string      // 形象照
  grade_level: string             // 年级段
  subjects_taught: string[]       // 教授学科数组
  teacher_type?: string           // 老师类型
  trial_subject?: string          // 试讲科目
  teaching_style?: string         // 授课风格
  interview_date?: string         // 面试日期
  interview_time?: string         // 面试时间
  interviewer_name?: string       // 面试官
  interview_link?: string         // 面试链接
  interview_score?: number        // 面试评分
  logical_expression_score?: number
  dress_appearance_score?: number
  material_preparation_score?: number
  exam_score?: string             // 中高考分数
  initial_evaluation?: string     // 初试评价
  teacher_characteristics?: string // 老师特点
  mandarin_level?: string         // 普通话水平
  research_ability?: string       // 教研能力
  service_awareness?: string      // 服务意识
  affinity?: string               // 亲和力
  review_status?: string          // 复核状态 (pending/reviewed/not-suitable)
  review_result?: string          // 复核结果
  review_evaluation_comment?: string // 复核定薪评价
  reviewed_by?: string            // 复核人
  review_date?: string            // 复核日期
  is_hired?: boolean              // 是否入库
  teacher_feeling?: string        // 老师感觉
  suitable_for_students?: string  // 适合学生
  scheduling_preference?: string  // 排课偏好
  teacher_level?: string          // 老师级别
  can_teach_graduation_class?: boolean // 能否排毕业班
  current_rate?: number           // 当前时薪
  approved_hourly_rate?: number   // 批准时薪
  created_at: string
  updated_at: string
}
```

**面试流程**:
1. 从daily_leads导入或直接创建
2. HR约面(设置interview_date, interview_time, interview_link)
3. HR初试评价(各项评分)
4. 教务复核(review_status, approved_hourly_rate)
5. 入库(is_hired=true, 创建teacher_profiles)

---

### students (学生表)
**用途**: 学生基础信息管理

**主要字段**:
```typescript
{
  id: string
  classin_uid?: number            // ClassIn UID
  student_number?: string         // 学号
  name: string                    // 姓名
  grade?: string                  // 年级
  region?: string                 // 地域
  parent_phone?: string           // 家长电话
  parent_wechat?: string          // 家长微信
  mobile?: string                 // 学生本人电话
  school?: string                 // 学校
  head_teacher_id?: string        // 班主任ID
  status?: string                 // 状态
  school_uid?: number             // ClassIn学校UID
  serve_state?: number            // 服务状态
  join_type?: number              // 加入类型
  stud_id?: number                // ClassIn学生ID
  classin_extra?: object          // ClassIn额外信息
  notes?: string
  created_at: string
  updated_at: string
}
```

---

### trial_lessons (试听课程表)
**用途**: 试听课程管理

**主要字段**:
```typescript
{
  id: string
  child_name: string              // 孩子姓名
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  lead_id?: string                // 关联线索
  region: string                  // 地域
  grade: string                   // 年级
  trial_subject: string           // 试讲科目
  trial_time: string              // 试讲时间
  trial_duration: number          // 试讲时长(分钟)
  phone: string                   // 联系电话
  channel: string                 // 渠道
  trial_amount?: number           // 试听费用
  payment_proof?: string          // 付款凭证
  urgency_level?: 'low' | 'medium' | 'high'
  notes?: string
  assigned_consultant?: string    // 分配顾问
  course_status?: string
  student_type?: string
  matched_teacher?: string        // 匹配老师
  confirmed_teacher?: string      // 确认老师
  confirmed_time?: string         // 确认时间
  class_link?: string             // 上课链接
  manual_converted?: string
  classin_uid?: number            // ClassIn UID
  classin_course_id?: number      // ClassIn班级ID
  created_at: string
  updated_at: string
}
```

---

### formal_orders (正式订单表)
**用途**: 正式课程订单

**主要字段**:
```typescript
{
  id: string
  student_id: string              // 学生ID
  order_number: string            // 订单号
  teacher_names: string[]         // 老师姓名数组
  subjects: string[]              // 学科数组
  order_type: string              // 订单类型
  total_hours: number             // 总课时
  payment_channel?: string        // 付款渠道
  payment_amount?: number         // 付款金额
  hourly_rate?: number            // 时薪
  payment_proof?: string          // 付款凭证
  payment_time?: string           // 付款时间
  consultant_teacher?: string     // 顾问老师
  order_notes?: string            // 订单备注
  total_sessions?: number         // 总课次
  session_duration?: number       // 单课时长(分钟)
  fixed_mode?: string             // 固定模式
  frequency?: string              // 频次
  official_start_time?: string    // 正式开始时间
  first_class_time?: string       // 第一次上课时间
  status: 'active' | 'completed' | 'cancelled' | 'suspended'
  created_at: string
  updated_at: string
}
```

---

### transaction_records (异动记录表)
**用途**: 学生课程异动记录

**主要字段**:
```typescript
{
  id: string
  student_id: string              // 学生ID
  student_name?: string           // 学生姓名
  transaction_type: string        // 异动类型
  description: string             // 描述
  transaction_date: string        // 异动日期
  handled_by: string              // 处理人
  notes?: string
  created_at: string
}
```

---

### sys_dictionaries (系统字典表)
**用途**: 数据字典配置

**字典分类**:
- `grade` - 年级
- `subject` - 学科
- `add_method` - 添加方式
- `province` - 省份地域
- `xhs_source` - 小红书账号来源

**主要字段**:
```typescript
{
  id: string
  category: string                // 分类代码
  code: string                    // 代码
  label: string                   // 显示标签
  sort_order: number              // 排序
  is_active: boolean              // 是否激活
  created_at: string
  updated_at: string
}
```

---

## 📈 表使用统计

| 表名 | API路由 | 服务文件 | 状态 |
|------|---------|----------|------|
| user_profiles | ✓ | ✓ | 活跃 |
| leads | ✓ | ✓ | 活跃 |
| daily_leads | ✓ | ✓ | 活跃 |
| teacher_candidates | ✓ | ✓ | 活跃 |
| teachers | ✓ | ✓ | 活跃 |
| teacher_profiles | - | ✓ | 活跃 |
| students | ✓ | ✓ | 活跃 |
| trial_lessons | - | ✓ | 活跃 |
| formal_orders | ✓ | ✓ | 活跃 |
| transaction_records | ✓ | ✓ | 活跃 |
| sys_dictionaries | - | ✓ | 活跃 |
| wechat_accounts | ✓ | ✓ | **已废弃** |
| teacher_classin | ✓ | ✓ | ClassIn同步 |
| students_classin | ✓ | ✓ | ClassIn同步 |
| class_classin | ✓ | - | ClassIn同步 |
| classroom_classin | - | - | ClassIn同步 |

---

## 🔗 表关联关系

```
user_profiles (系统用户)
    ↓
    ├── leads (运营录入线索)
    │     ↓
    │     └── trial_lessons (创建试听)
    │
    ├── daily_leads (HR导入候选人)
    │     ↓
    │     └── teacher_candidates (面试流程)
    │           ↓
    │           └── teacher_profiles (入库)
    │
    ├── students (学生管理)
    │     ↓
    │     └── formal_orders (正式订单)
    │
    └── teachers (老师管理)
```

---

## ⚠️ 重要提示

1. **wechat_accounts表已废弃**
   - 不再使用独立的微信号管理表
   - 改用user_profiles表获取销售人员信息
   - 运营人员: `role = 'operator'`
   - 销售人员: `role = 'sales'`

2. **ClassIn同步表**
   - teacher_classin
   - students_classin
   - class_classin
   - classroom_classin
   这些表用于同步ClassIn系统数据,不应直接修改

3. **业务流程关键表**
   - **线索转化**: leads → trial_lessons → formal_orders → students
   - **老师招聘**: daily_leads → teacher_candidates → teacher_profiles
   - **异动管理**: students → transaction_records

---

**文档版本**: v1.0
**最后更新**: 2025-01-01 (基于代码分析)
**数据来源**: 实际代码和API路由分析
