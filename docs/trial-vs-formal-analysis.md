# 试听订单 vs 正式订单 - 业务逻辑深度分析

## 问题提出

**用户疑问**: "会不会只是名字有订单，其实逻辑不一样呢？"

本文档旨在深入分析试听订单(trial_lessons)和正式订单(formal_orders)的业务逻辑差异，为架构设计提供决策依据。

---

## 1. 业务流程对比

### 1.1 试听订单业务流程

```
线索 → 销售反馈 → 新增试听 → 教务匹配老师 → 确认老师 → 确定时间 → 开链接 → 上课 → 填写反馈 → (转化/未转化)
```

**关键特点**:
- **目标**: 验证教学效果，促成转化
- **时效性**: 强(需快速匹配)
- **一次性**: 每个线索通常只有1次试听机会
- **转化导向**: 最终目的是促成正式订单
- **免费**: 不涉及付费流程

### 1.2 正式订单业务流程

```
学生 → 新建订单 → 选择课程包 → 确认课时/单价 → 签约付款 → 排课 → 上课 → 课时消耗 → 续费/退费
```

**关键特点**:
- **目标**: 提供长期教学服务
- **持续性**: 可续费，长期服务关系
- **复杂性**: 涉及付费、排课、课时管理、退费等
- **服务导向**: 关注教学质量和客户满意度
- **收费**: 完整的财务流程

---

## 2. 状态机对比

### 2.1 试听订单状态机

**8个状态**:

```typescript
type TrialLessonStatus =
  | 'cancelled'           // 取消试听
  | 'waiting_match'       // 待匹配老师
  | 'waiting_confirm'     // 待确认老师
  | 'waiting_time'        // 待确认时间
  | 'waiting_link'        // 待开链接
  | 'scheduled'           // 已排待上课
  | 'waiting_feedback'    // 上完待反馈
  | 'completed';          // 已完成
```

**状态流转**:
```
waiting_match → waiting_confirm → waiting_time → waiting_link → scheduled → waiting_feedback → completed
     ↓                                                                         ↓
cancelled                                                               (manual_converted='是'/'否')
```

**核心触发条件**:
- `matched_teacher` 是否存在
- `confirmed_teacher` 是否存在
- `trial_time` 是否确定
- `class_link` 是否生成
- `manual_converted` 是否填写
- 是否产生正式订单

### 2.2 正式订单状态机

**文档中未明确定义，推测状态**:

```typescript
type FormalOrderStatus =
  | 'draft'        // 草稿
  | 'pending_payment'  // 待付款
  | 'active'       // 进行中
  | 'suspended'    // 暂停
  | 'completed'    // 已完成
  | 'refunded'     // 已退费
  | 'cancelled';   // 已取消
```

**状态流转**:
```
draft → pending_payment → active → completed
  ↓         ↓                ↓
cancelled  cancelled  suspended → (refunded)
```

**核心触发条件**:
- `payment_amount` 是否支付
- `payment_time` 支付时间
- 课程是否开始/结束
- 剩余课时数量
- 是否申请退费

---

## 3. 数据字段对比

### 3.1 试听订单独有字段

| 字段名 | 类型 | 说明 | 业务含义 |
|-------|------|------|---------|
| `lead_id` | UUID | 关联线索ID | 试听必须关联线索 |
| `matched_teacher` | UUID | 匹配老师(推荐) | 教务推荐的老师 |
| `confirmed_teacher` | UUID | 确认老师(教务) | 最终确认的老师 |
| `trial_time` | TIMESTAMP | 试听时间 | 具体上课时间 |
| `trial_duration` | INT | 试听时长(分钟) | 通常60分钟 |
| `class_link` | TEXT | 上课链接 | ClassIn/Zoom链接 |
| `manual_converted` | VARCHAR | 是否转化(手动) | '是'/'否'/null |
| `converted_order_id` | UUID | 转化订单ID | 关联的正式订单 |
| `course_status` | VARCHAR | 课程状态 | '正常上课'/'取消试听' |
| `lesson_feedback` | TEXT | 试听反馈 | 上课后的反馈内容 |

### 3.2 正式订单独有字段

| 字段名 | 类型 | 说明 | 业务含义 |
|-------|------|------|---------|
| `student_id` | UUID | 关联学生ID | 正式订单必须关联学生 |
| `order_number` | VARCHAR | 订单编号 | 唯一编号 |
| `enrollment_subject` | VARCHAR | 报名科目 | 数学、英语等 |
| `session_count` | INT | 课时数量 | 购买的总课时 |
| `session_duration` | INT | 单课时长(分钟) | 每节课时长 |
| `hourly_rate_manual` | DECIMAL | 单价(手动) | 手动录入的单价 |
| `hourly_rate_auto` | DECIMAL | 单价(自动) | 系统计算的单价 |
| `payment_channel` | VARCHAR | 支付渠道 | 微信/支付宝/银行 |
| `payment_amount` | DECIMAL | 实付金额 | 实际支付金额 |
| `payment_proof` | TEXT | 支付凭证 | 付款截图URL |
| `payment_time` | TIMESTAMP | 支付时间 | 付款时间 |
| `consultant_id` | UUID | 顾问ID | 销售顾问 |
| `head_teacher_id` | UUID | 班主任ID | 负责班主任 |
| `first_class_time` | TIMESTAMP | 首课时间 | 第一次上课时间 |
| `class_end_date` | DATE | 课表截至 | 预计结束日期 |
| `renewed_from` | UUID | 续费自订单ID | 续费来源订单 |

### 3.3 共同字段(但语义不同)

| 字段名 | 试听订单语义 | 正式订单语义 | 是否真的相同？ |
|-------|-------------|-------------|--------------|
| `teacher_id` | 试听老师(临时) | 授课老师(长期) | ❌ 不同 |
| `course_name` | 试听课程名称 | 正式课程包名称 | ❌ 不同 |
| `grade` | 试听年级 | 学生年级 | ⚠️ 可能相同 |
| `subject` | 试听科目 | 报名科目 | ⚠️ 可能相同 |
| `status` | 8种状态之一 | 订单状态 | ❌ 完全不同 |
| `created_at` | 创建时间 | 创建时间 | ✅ 相同 |

---

## 4. 核心差异总结

### 4.1 业务目标不同

| 维度 | 试听订单 | 正式订单 |
|-----|---------|---------|
| **主要目标** | 验证匹配度，促成转化 | 提供教学服务，持续收费 |
| **成功指标** | 转化率(是否报名正式订单) | 续费率、满意度、课耗 |
| **时间跨度** | 1-2天(短期) | 数月到数年(长期) |
| **业务本质** | 市场营销工具 | 服务交付合同 |

### 4.2 操作角色不同

**试听订单**:
- 销售: 新增试听
- 教务: 匹配老师、确认老师、开链接
- 老师: 上课、填写反馈
- 销售主管: 查看转化率

**正式订单**:
- 销售: 新建订单、签约
- 财务: 核对付款
- 教务: 排课、课时管理
- 班主任: 回访管理、续费跟进
- 人力: 业绩核算

### 4.3 数据关系不同

**试听订单关系图**:
```
leads (线索)
  ↓ 1:1
trial_lessons (试听订单)
  ↓ 0:1 (可能不转化)
formal_orders (正式订单，通过converted_order_id关联)
```

**正式订单关系图**:
```
students (学生)
  ↓ 1:N
formal_orders (正式订单)
  ↓ 1:N
courses (课程排课)
  ↓ 1:N
class_sessions (具体课次)
```

### 4.4 状态计算逻辑不同

**试听订单状态计算特点**:
- **基于字段组合判断**: 多个字段(matched_teacher, confirmed_teacher, trial_time, class_link)组合决定状态
- **时间敏感**: 状态依赖当前时间与trial_time比较
- **外部依赖**: 检查是否产生formal_order来决定是否completed
- **人工干预**: manual_converted字段影响最终状态

**正式订单状态计算特点**:
- **基于支付和进度**: 主要看payment_time、剩余课时
- **续费链**: renewed_from形成续费链
- **退费流程**: 复杂的多角色审核流程
- **暂停/恢复**: 支持暂停和恢复

---

## 5. 是否应该合并？深度分析

### 5.1 合并方案(统一orders表)

**技术优势**:
1. ✅ 数据关系简单: 学生-订单统一管理
2. ✅ 统计方便: LTV计算、转化率分析
3. ✅ 续费自然: renewed_from直接关联
4. ✅ 减少表数量: 从2张表变成1张表

**业务劣势**:
1. ❌ **状态逻辑完全不同**: 无法用统一的状态机
2. ❌ **字段含义不同**: teacher_id在试听和正式订单中语义完全不同
3. ❌ **业务流程不同**: 试听是营销工具，正式订单是服务合同
4. ❌ **权限控制不同**: 试听和正式订单的操作角色不同
5. ❌ **代码复杂度**: 需要大量 `if order_type === 'trial'` 判断

### 5.2 分开方案(保持trial_lessons和formal_orders)

**业务优势**:
1. ✅ **业务逻辑清晰**: 试听归试听，订单归订单
2. ✅ **状态机独立**: 各自管理自己的状态流转
3. ✅ **代码简洁**: 不需要大量order_type判断
4. ✅ **权限清晰**: 不同角色操作不同表
5. ✅ **扩展性好**: 未来试听或订单流程变化互不影响

**技术劣势**:
1. ❌ 转化率分析需要JOIN查询
2. ❌ LTV计算需要跨表统计
3. ❌ 续费链条需要通过converted_order_id关联

---

## 6. 推荐方案

### 🎯 **方案C: 分开存储 + 统一视图**

基于以上分析，**试听订单和正式订单的业务逻辑本质上是不同的**，建议:

#### 6.1 数据库层: **保持分开**

```sql
-- 试听订单表(不变)
CREATE TABLE trial_lessons (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  matched_teacher UUID REFERENCES teacher_profiles(id),
  confirmed_teacher UUID REFERENCES teacher_profiles(id),
  trial_time TIMESTAMP,
  trial_duration INT,
  class_link TEXT,
  manual_converted VARCHAR(10),
  converted_order_id UUID REFERENCES formal_orders(id),
  course_status VARCHAR(50),
  lesson_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 正式订单表(不变)
CREATE TABLE formal_orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(100) UNIQUE,
  student_id UUID REFERENCES students(id),
  enrollment_subject VARCHAR(100),
  session_count INT,
  hourly_rate_manual DECIMAL(10,2),
  payment_amount DECIMAL(10,2),
  payment_time TIMESTAMP,
  renewed_from UUID REFERENCES formal_orders(id),
  trial_lesson_id UUID REFERENCES trial_lessons(id), -- 反向关联试听订单
  created_at TIMESTAMP DEFAULT NOW()
);
```

**关键设计**:
- `trial_lessons.converted_order_id` → 试听转化到的正式订单
- `formal_orders.trial_lesson_id` → 正式订单来源的试听
- **双向关联**, 方便双向查询

#### 6.2 服务层: **分别实现**

```typescript
// 试听订单服务
class TrialLessonService {
  async create(data: NewTrialLesson) { }
  async matchTeacher(id: string, teacherId: string) { }
  async confirmTeacher(id: string, teacherId: string) { }
  async scheduleTime(id: string, time: Date) { }
  async generateClassLink(id: string) { }
  async submitFeedback(id: string, feedback: string) { }
  async markConverted(id: string, converted: boolean) { }

  // 状态计算
  calculateStatus(lesson: TrialLesson): TrialLessonStatus { }
}

// 正式订单服务
class FormalOrderService {
  async create(data: NewFormalOrder) { }
  async confirmPayment(id: string) { }
  async renew(orderId: string, newOrderData: NewFormalOrder) { }
  async requestRefund(id: string, reason: string) { }
  async suspend(id: string) { }
  async resume(id: string) { }

  // 状态计算
  calculateStatus(order: FormalOrder): FormalOrderStatus { }
}
```

#### 6.3 视图层: **统一分析视图**

```sql
-- 统一的订单分析视图(用于报表和统计)
CREATE OR REPLACE VIEW order_analytics_view AS
SELECT
  'trial' as order_type,
  tl.id as order_id,
  tl.lead_id as customer_id,
  tl.trial_time as order_time,
  tl.manual_converted as converted,
  tl.created_at as created_at,
  NULL as payment_amount,
  NULL as session_count
FROM trial_lessons tl

UNION ALL

SELECT
  'formal' as order_type,
  fo.id as order_id,
  fo.student_id as customer_id,
  fo.first_class_time as order_time,
  NULL as converted,
  fo.created_at as created_at,
  fo.payment_amount as payment_amount,
  fo.session_count as session_count
FROM formal_orders fo;
```

#### 6.4 API层: **统一入口** (可选)

如果需要统一API入口:

```typescript
// app/api/orders/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'trial' | 'formal' | 'all'

  if (type === 'trial') {
    return TrialLessonService.getAll();
  } else if (type === 'formal') {
    return FormalOrderService.getAll();
  } else {
    // 返回合并后的数据(用于报表)
    return getOrderAnalytics();
  }
}
```

---

## 7. 总结

### 核心结论

**试听订单和正式订单的业务逻辑确实不同**:

1. **试听订单**是**营销工具**，目标是促成转化
2. **正式订单**是**服务合同**，目标是提供长期教学服务

两者虽然都叫"订单"，但:
- ❌ 状态机完全不同
- ❌ 业务流程完全不同
- ❌ 操作角色不同
- ❌ 数据关系不同
- ❌ 成功指标不同

### 最佳方案

**分开存储(trial_lessons和formal_orders) + 统一分析视图**

**原因**:
1. ✅ 符合业务本质(营销 vs 服务)
2. ✅ 代码逻辑清晰，不需要大量order_type判断
3. ✅ 状态机独立，易于维护
4. ✅ 通过视图可以实现统一分析
5. ✅ 通过双向关联(trial_lessons.converted_order_id和formal_orders.trial_lesson_id)实现数据关联

### 实施建议

1. **保持现有表结构不变** (trial_lessons和formal_orders)
2. **添加双向关联字段**:
   - `trial_lessons.converted_order_id` (已存在)
   - `formal_orders.trial_lesson_id` (新增)
3. **创建统一分析视图** `order_analytics_view`
4. **分别实现状态计算器**:
   - `lib/status-calculator.ts` 中分别实现
   - `calculateTrialLessonStatus()`
   - `calculateFormalOrderStatus()`
5. **UI页面保持分开**:
   - `/dashboard/trial-lessons` - 试听课程
   - `/dashboard/formal-orders` - 正式订单
   - `/dashboard/analytics` - 统一数据分析(使用视图)

---

**文档版本**: v1.0
**创建日期**: 2025-01-01
**状态**: 待确认
