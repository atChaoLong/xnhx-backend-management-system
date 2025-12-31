# 业务状态计算规则文档

## 📚 目录
- [1. 线索报单状态规则](#1-线索报单状态规则)
- [2. 试听课程状态规则](#2-试听课程状态规则)
- [3. 学生管理状态规则](#3-学生管理状态规则)
- [4. 面试记录状态规则](#4-面试记录状态规则)
- [5. 课程异动状态规则](#5-课程异动状态规则)

---

## 1. 线索报单状态规则

### 表名: `leads`

### 使用角色
- **运营**: 录入线索
- **销售**: 反馈线索

### 状态类型

#### 1.1 线索添加状态 (add_status)

**字段来源**: `leads`表

**计算规则**:

```typescript
function calculateAddStatus(lead: Lead): 'unassigned' | 'added' | 'not_added' | 'waiting_feedback' {
  // a. 运营未派单
  if (!lead.grab_wechat || lead.grab_wechat.trim() === '') {
    return 'unassigned';
  }

  // b. 已添加
  // 规则: "反馈是否添加" = 'added' OR 产生了试听
  // 注意: 即使手动填写"未添加",但产生了试听,状态也是"已添加"
  const hasTrialLesson = checkHasTrialLesson(lead.id); // 查询trial_lessons表
  if (lead.add_status === 'added' || hasTrialLesson) {
    return 'added';
  }

  // c. 未添加
  if (lead.add_status === 'not_added') {
    return 'not_added';
  }

  // d. 销售未反馈
  // 规则: "反馈是否添加"为空 AND 没产生试听
  if (!lead.add_status && !hasTrialLesson) {
    return 'waiting_feedback';
  }

  // 默认返回等待反馈
  return 'waiting_feedback';
}
```

**字段说明**:
- `grab_wechat`: 抢单微信号 (销售人员微信)
- `add_status`: 反馈是否添加 ('added' | 'not_added' | null)
- `trial_lessons`: 关联的试听课程 (通过lead_id关联)

**状态映射**:
| 状态值 | 中文名称 | 条件 |
|-------|---------|------|
| `unassigned` | 运营未派单 | `grab_wechat` 为空 |
| `added` | 已添加 | `add_status='added'` 或存在试听记录 |
| `not_added` | 未添加 | `add_status='not_added'` |
| `waiting_feedback` | 销售未反馈 | `add_status` 为空且无试听记录 |

---

#### 1.2 线索转化状态 (convert_status)

**计算规则**:

```typescript
function calculateConvertStatus(lead: Lead): 'trial' | 'formal' | 'empty' {
  // 查询关联的试听和订单
  const hasTrialLesson = checkHasTrialLesson(lead.id);
  const hasFormalOrder = checkHasFormalOrder(lead.id);

  // 试听: 产生试听 AND 没产生正式
  if (hasTrialLesson && !hasFormalOrder) {
    return 'trial';
  }

  // 正式: 产生正式订单
  if (hasFormalOrder) {
    return 'formal';
  }

  // 空: 其余情况
  return 'empty';
}
```

**辅助函数**:

```typescript
// 检查是否有试听记录
function checkHasTrialLesson(leadId: string): boolean {
  const { data } = supabase
    .from('trial_lessons')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);

  return (data?.length || 0) > 0;
}

// 检查是否有正式订单
function checkHasFormalOrder(leadId: string): boolean {
  // 通过线索找到学生,再查找订单
  const { data: students } = supabase
    .from('students')
    .select('id')
    .eq('lead_id', leadId);

  if (!students || students.length === 0) {
    return false;
  }

  const studentIds = students.map(s => s.id);

  const { data: orders } = supabase
    .from('formal_orders')
    .select('id')
    .in('student_id', studentIds)
    .limit(1);

  return (orders?.length || 0) > 0;
}
```

**状态映射**:
| 状态值 | 中文名称 | 条件 |
|-------|---------|------|
| `trial` | 试听 | 存在试听记录且不存在正式订单 |
| `formal` | 正式 | 存在正式订单 |
| `empty` | 空 | 其他情况 |

---

## 2. 试听课程状态规则

### 表名: `trial_lessons`

### 使用角色
- **销售**: 新增试听
- **教务**: 匹配老师

### 状态类型

#### 2.1 试听状态 (lesson_status)

**计算规则**:

```typescript
function calculateLessonStatus(lesson: TrialLesson): LessonStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trialTime = lesson.trial_time ? new Date(lesson.trial_time) : null;

  // a. 取消试听
  if (lesson.course_status === '取消试听') {
    return 'cancelled';
  }

  // b. 待匹配老师 (初始状态)
  if (!lesson.matched_teacher) {
    return 'waiting_match';
  }

  // c. 待确认老师
  // 条件: "匹配老师"不为空 AND "确认老师（教务）"为空
  if (lesson.matched_teacher && !lesson.confirmed_teacher) {
    return 'waiting_confirm';
  }

  // d. 待确认时间
  // 条件: "匹配老师"不为空 AND "确认老师"不为空 AND "确定试听时间"为空
  if (lesson.matched_teacher && lesson.confirmed_teacher && !lesson.trial_time) {
    return 'waiting_time';
  }

  // e. 待开链接
  // 条件: 老师和时间都已确认,但"上课链接"为空
  if (lesson.matched_teacher && lesson.confirmed_teacher && lesson.trial_time && !lesson.class_link) {
    return 'waiting_link';
  }

  // f. 已排待上课
  // 条件: 所有信息都齐全 AND "确定试听时间" <= 今天
  if (trialTime && lesson.class_link && trialTime <= today) {
    return 'scheduled';
  }

  // g. 上完待反馈
  // 条件: "确定试听时间" > 今天 AND "是否转化"为空
  if (trialTime && lesson.class_link && trialTime > today) {
    if (!lesson.manual_converted && !checkHasFormalOrder(lesson.id)) {
      return 'waiting_feedback';
    }
  }

  // h. 已完成
  // 条件: "是否转化"不为空 OR 产生了正式订单
  if (lesson.manual_converted === '是' || lesson.manual_converted === '否' || checkHasFormalOrder(lesson.id)) {
    return 'completed';
  }

  // 默认状态
  return 'waiting_match';
}
```

**状态映射**:
| 状态值 | 中文名称 | 条件 |
|-------|---------|------|
| `cancelled` | 取消试听 | `course_status = '取消试听'` |
| `waiting_match` | 待匹配老师 | `matched_teacher` 为空 |
| `waiting_confirm` | 待确认老师 | 有`matched_teacher`但无`confirmed_teacher` |
| `waiting_time` | 待确认时间 | 老师已确认但无`trial_time` |
| `waiting_link` | 待开链接 | 时间已确认但无`class_link` |
| `scheduled` | 已排待上课 | 所有必要信息齐全且上课时间 <= 今天 |
| `waiting_feedback` | 上完待反馈 | 上课时间 > 今天且未填写转化结果 |
| `completed` | 已完成 | 已填写转化结果或产生正式订单 |

---

#### 2.2 是否转化 (is_converted)

**计算规则**:

```typescript
function calculateIsConverted(lesson: TrialLesson): boolean {
  // 规则1: 产生了正式订单
  if (checkHasFormalOrder(lesson.id)) {
    return true;
  }

  // 规则2: 手动标记"是否转化" = "是"
  // 注意: 其他选项都等于"是否转化(手动)"的值
  if (lesson.manual_converted === '是') {
    return true;
  }

  return false;
}
```

**字段说明**:
- `matched_teacher`: 匹配老师
- `confirmed_teacher`: 确认老师(教务)
- `trial_time`: 确定试听时间
- `class_link`: 上课链接
- `course_status`: 课程状态
- `manual_converted`: 是否转化(手动) - '是' | '否' | null

---

## 3. 学生管理状态规则

### 表名: `students`, `formal_orders`

### 使用角色
- **销售**: 新建学生
- **班主任**: 新建学生、批量排课、课时管理、回访管理

### 状态类型

#### 3.1 学生状态 (student_status)

**计算规则**:

```typescript
function calculateStudentStatus(student: Student): StudentStatus {
  // a. 缺状态
  if (!student.status) {
    return 'missing';
  }

  // b. 快没课
  // 条件: "课表截至"离今天小于7天
  if (student.class_end_date) {
    const daysUntilEnd = getDaysDifference(new Date(), student.class_end_date);
    if (daysUntilEnd < 7 && daysUntilEnd >= 0) {
      return 'running_out';
    }
  }

  // c. 已回访
  // 条件: 本月回访次数 > 0
  const visitCountThisMonth = getVisitCountThisMonth(student.id);
  if (visitCountThisMonth > 0) {
    return 'visited';
  }

  // 其他情况使用数据库中的状态
  return student.status as StudentStatus;
}
```

**辅助函数**:

```typescript
// 获取本月回访次数
function getVisitCountThisMonth(studentId: string): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { count } = supabase
    .from('visit_records')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('visit_date', startOfMonth.toISOString())
    .lt('visit_date', new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString());

  return count || 0;
}

// 计算日期差
function getDaysDifference(date1: Date, date2String: string): number {
  const date2 = new Date(date2String);
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
```

**状态映射**:
| 状态值 | 中文名称 | 条件 |
|-------|---------|------|
| `missing` | 缺状态 | `status` 字段为空 |
| `running_out` | 快没课 | 距离课表截至日期 < 7天 |
| `visited` | 已回访 | 本月有回访记录 |
| 其他 | 数据库状态 | 使用 `students.status` 的原始值 |

---

#### 3.2 新生状态 (new_student_status)

**计算规则**:

```typescript
function calculateNewStudentStatus(student: Student): NewStudentStatus {
  // 获取首次报名日期
  const firstOrderDate = getFirstOrderDate(student.id);

  if (!firstOrderDate) {
    return 'unknown';
  }

  const now = new Date();
  const weeksSinceFirstOrder = getWeeksDifference(firstOrderDate, now);

  // a. 一周新生: 首次报名日期在一周内 (0-7天)
  if (weeksSinceFirstOrder < 1) {
    return 'week_1';
  }

  // b. 两周新生: 首次报名日期在第2周 (7-14天)
  if (weeksSinceFirstOrder < 2) {
    return 'week_2';
  }

  // c. 三周新生: 首次报名日期在第3周 (14-21天)
  if (weeksSinceFirstOrder < 3) {
    return 'week_3';
  }

  // d. 四周新生: 首次报名日期在第4周 (21-28天)
  if (weeksSinceFirstOrder < 4) {
    return 'week_4';
  }

  // e. 老生: 首次报名日期超过四周 (28天以上)
  return 'old_student';
}
```

**辅助函数**:

```typescript
// 获取首次报名日期
function getFirstOrderDate(studentId: string): Date | null {
  const { data } = supabase
    .from('formal_orders')
    .select('payment_time')
    .eq('student_id', studentId)
    .order('payment_time', { ascending: true })
    .limit(1);

  if (!data || data.length === 0) {
    return null;
  }

  return new Date(data[0].payment_time);
}

// 计算周数差
function getWeeksDifference(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays / 7;
}
```

**状态映射**:
| 状态值 | 中文名称 | 条件 |
|-------|---------|------|
| `week_1` | 一周新生 | 首次报名 0-7 天 |
| `week_2` | 两周新生 | 首次报名 7-14 天 |
| `week_3` | 三周新生 | 首次报名 14-21 天 |
| `week_4` | 四周新生 | 首次报名 21-28 天 |
| `old_student` | 老生 | 首次报名 > 28 天 |
| `unknown` | 未知 | 无订单记录 |

---

## 4. 面试记录状态规则

### 表名: `teacher_candidates`

### 使用角色
- **招师HR**: 约面信息、初试评价、录像上传
- **教学**: 初试录像复核

### 状态类型

#### 4.1 面试流程状态 (interview_status)

**计算规则**:

```typescript
function calculateInterviewStatus(candidate: TeacherCandidate): InterviewStatus {
  // 根据复核状态判断
  if (candidate.review_status === 'reviewed') {
    // 已复核,检查是否入库
    return candidate.is_hired ? 'hired' : 'reviewed';
  }

  if (candidate.review_status === 'not-suitable') {
    return 'rejected';
  }

  // 检查是否有面试记录
  if (!candidate.interview_date) {
    return 'pending'; // 待面试
  }

  // 已安排面试
  return 'interviewed';
}
```

**状态映射**:
| 状态值 | 中文名称 | 条件 |
|-------|---------|------|
| `pending` | 待面试 | 无面试日期 |
| `interviewed` | 已面试 | 有面试日期但未复核 |
| `reviewed` | 已复核 | `review_status='reviewed'` 且 `is_hired=false` |
| `hired` | 已入库 | `review_status='reviewed'` 且 `is_hired=true` |
| `rejected` | 不合适 | `review_status='not-suitable'` |

---

## 5. 课程异动状态规则

### 表名: `course_changes` (需要新建)

### 使用角色
- **班主任**: 录入退费
- **教务**: 核对课时金额
- **财务**: 打款
- **人力**: 核对退费业绩

### 状态类型

#### 5.1 退费状态 (refund_status)

**计算规则**:

```typescript
function calculateRefundStatus(refund: Refund): RefundStatus {
  // a. 待核对金额: 提交后初始状态,需教务核对金额
  if (refund.status === 'pending') {
    return 'pending_verification';
  }

  // b. 待财务打款: 核对金额后,需财务打款
  if (refund.status === 'verified' && !refund.payment_date) {
    return 'pending_payment';
  }

  // c. 待核对业绩: 待人力核对退费业绩
  if (refund.status === 'paid' && !refund.performance_verified) {
    return 'pending_performance_verification';
  }

  // d. 已完成: 所有步骤都完成
  if (refund.status === 'completed') {
    return 'completed';
  }

  return 'pending_verification';
}
```

**状态流转**:

```
pending_verification (待核对金额)
    ↓ [教务核对金额]
pending_payment (待财务打款)
    ↓ [财务打款]
pending_performance_verification (待核对业绩)
    ↓ [人力核对业绩]
completed (已完成)
```

**状态映射**:
| 状态值 | 中文名称 | 条件 | 负责角色 |
|-------|---------|------|---------|
| `pending_verification` | 待核对金额 | 初始状态 | 教务 |
| `pending_payment` | 待财务打款 | 已核对金额但未打款 | 财务 |
| `pending_performance_verification` | 待核对业绩 | 已打款但未核对业绩 | 人力 |
| `completed` | 已完成 | 所有步骤完成 | - |

**字段说明**:
- `status`: 异动状态 ('pending' | 'verified' | 'paid' | 'completed')
- `payment_date`: 打款日期
- `performance_verified`: 业绩是否已核对 (boolean)

---

## 6. 实现方案

### 6.1 状态计算器创建

创建 `lib/status-calculator.ts`:

```typescript
import { supabase } from './supabase';

// 线索状态计算
export async function calculateLeadStatus(leadId: string) {
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (!lead) return null;

  const add_status = calculateAddStatus(lead);
  const convert_status = calculateConvertStatus(lead);

  return {
    add_status,
    add_status_name: getStatusDisplayName('lead_add_status', add_status),
    convert_status,
    convert_status_name: getStatusDisplayName('lead_convert_status', convert_status),
  };
}

// 批量计算线索状态
export async function batchCalculateLeadStatus() {
  const { data: leads } = await supabase
    .from('leads')
    .select('*');

  if (!leads) return [];

  return Promise.all(
    leads.map(async (lead) => {
      const add_status = calculateAddStatus(lead);
      const convert_status = calculateConvertStatus(lead);

      return {
        id: lead.id,
        add_status,
        add_status_name: getStatusDisplayName('lead_add_status', add_status),
        convert_status,
        convert_status_name: getStatusDisplayName('lead_convert_status', convert_status),
      };
    })
  );
}
```

### 6.2 API使用

```typescript
// app/api/leads/route.ts
import { batchCalculateLeadStatus } from '@/lib/status-calculator';

export async function GET(request: NextRequest) {
  const { data, error } = await supabaseServer
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 计算线索状态
  const leadsWithStatus = await batchCalculateLeadStatus();

  // 合并状态到原始数据
  const leads = data.map(lead => ({
    ...lead,
    ...leadsWithStatus.find(s => s.id === lead.id),
  }));

  return NextResponse.json({ data: leads });
}
```

---

## 7. 前端展示

### 7.1 状态Badge组件

```typescript
// components/status-badge.tsx
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  type: 'lead_add' | 'lead_convert' | 'trial_lesson' | 'student' | 'interview' | 'refund';
  status: string;
}

export function StatusBadge({ type, status }: StatusBadgeProps) {
  const config = getStatusConfig(type, status);

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}

function getStatusConfig(type: string, status: string) {
  const configs = {
    lead_add: {
      unassigned: { label: '运营未派单', className: 'bg-gray-500' },
      added: { label: '已添加', className: 'bg-green-500' },
      not_added: { label: '未添加', className: 'bg-red-500' },
      waiting_feedback: { label: '销售未反馈', className: 'bg-yellow-500' },
    },
    lead_convert: {
      trial: { label: '试听', className: 'bg-blue-500' },
      formal: { label: '正式', className: 'bg-purple-500' },
      empty: { label: '空', className: 'bg-gray-400' },
    },
    trial_lesson: {
      cancelled: { label: '取消试听', className: 'bg-red-500' },
      waiting_match: { label: '待匹配老师', className: 'bg-yellow-500' },
      waiting_confirm: { label: '待确认老师', className: 'bg-blue-500' },
      waiting_time: { label: '待确认时间', className: 'bg-indigo-500' },
      waiting_link: { label: '待开链接', className: 'bg-purple-500' },
      scheduled: { label: '已排待上课', className: 'bg-green-500' },
      waiting_feedback: { label: '上完待反馈', className: 'bg-orange-500' },
      completed: { label: '已完成', className: 'bg-green-600' },
    },
    // ... 其他状态配置
  };

  return configs[type]?.[status] || { label: status, className: 'bg-gray-500' };
}
```

---

## 8. 数据库触发器 (可选)

为了自动更新状态,可以创建数据库触发器:

```sql
-- 线索状态更新触发器
CREATE OR REPLACE FUNCTION update_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新线索添加状态
  NEW.add_status = CASE
    WHEN NEW.grab_wechat IS NULL THEN 'unassigned'
    WHEN NEW.add_status = 'added' THEN 'added'
    ELSE COALESCE(NEW.add_status, 'waiting_feedback')
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_status
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_status();
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-01
**维护人员**: 开发团队
