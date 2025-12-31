# 试听课状态计算规则

**文档版本**: v1.0
**创建日期**: 2025-01-01
**适用范围**: trial_lessons 表状态计算

---

## 📊 试听课 8 种状态

### 状态枚举

```typescript
export enum TrialLessonStatus {
  CANCELLED = 'cancelled',              // 1. 取消试听
  WAITING_MATCH = 'waiting_match',      // 2. 待匹配老师
  WAITING_CONFIRM = 'waiting_confirm',  // 3. 待确认老师
  WAITING_TIME = 'waiting_time',        // 4. 待确认时间
  WAITING_LINK = 'waiting_link',        // 5. 待开链接
  SCHEDULED = 'scheduled',              // 6. 已排待上课
  WAITING_FEEDBACK = 'waiting_feedback',// 7. 上完待反馈
  COMPLETED = 'completed'               // 8. 已完成
}
```

### 状态流程图

```
┌──────────────────────────────────────────────────────────────┐
│                    试听课生命周期                              │
└──────────────────────────────────────────────────────────────┘

1. 创建试听
   ↓
   状态: 待匹配老师 (waiting_match)
   条件: matched_teacher 为空
   操作: 教务匹配老师

2. 匹配老师
   ↓
   状态: 待确认老师 (waiting_confirm)
   条件: matched_teacher 不空, confirmed_teacher 为空
   操作: 教务确认老师

3. 确认老师
   ↓
   状态: 待确认时间 (waiting_time)
   条件: confirmed_teacher 不空, confirmed_time 为空
   操作: 销售/班主任/教务确定时间

4. 确定时间
   ↓
   状态: 待开链接 (waiting_link)
   条件: confirmed_time 不空, class_link 为空
   操作: 教务生成上课链接

5. 生成链接
   ↓
   分支A: 时间未到
   状态: 已排待上课 (scheduled)
   条件: confirmed_time > 今天 AND 未转化
   操作: 等待上课

   分支B: 时间已过
   状态: 上完待反馈 (waiting_feedback)
   条件: confirmed_time <= 今天 AND 未转化
   操作: 老师/销售填写是否转化

6. 填写转化
   ↓
   状态: 已完成 (completed)
   条件: is_converted = true
   操作: 流程结束
```

---

## 🎯 详细状态判断规则

### 规则1: 取消试听

**状态**: `cancelled`

**判断条件**:
```typescript
if (lesson.course_status === '取消试听') {
  return TrialLessonStatus.CANCELLED
}
```

**字段**:
- `course_status` = "取消试听"

**说明**:
- 最高优先级，一旦取消不再流转
- 任何时间点都可以取消

---

### 规则2: 待匹配老师

**状态**: `waiting_match`

**判断条件**:
```typescript
if (!lesson.matched_teacher || lesson.matched_teacher.trim() === '') {
  return TrialLessonStatus.WAITING_MATCH
}
```

**字段**:
- `matched_teacher` = 空

**说明**:
- 初始状态
- 需要教务匹配老师

---

### 规则3: 待确认老师

**状态**: `waiting_confirm`

**判断条件**:
```typescript
if (lesson.matched_teacher &&
    (!lesson.confirmed_teacher || lesson.confirmed_teacher.trim() === '')) {
  return TrialLessonStatus.WAITING_CONFIRM
}
```

**字段**:
- `matched_teacher` ≠ 空
- `confirmed_teacher` = 空

**说明**:
- 已匹配老师，但教务未确认
- 需要教务确认老师

---

### 规则4: 待确认时间

**状态**: `waiting_time`

**判断条件**:
```typescript
if (lesson.matched_teacher &&
    lesson.confirmed_teacher &&
    (!lesson.confirmed_time || lesson.confirmed_time.trim() === '')) {
  return TrialLessonStatus.WAITING_TIME
}
```

**字段**:
- `matched_teacher` ≠ 空
- `confirmed_teacher` ≠ 空
- `confirmed_time` = 空

**说明**:
- 老师已确认，但未确定上课时间
- 销售、班主任或教务可以确定时间

---

### 规则5: 待开链接

**状态**: `waiting_link`

**判断条件**:
```typescript
if (lesson.matched_teacher &&
    lesson.confirmed_teacher &&
    lesson.confirmed_time &&
    (!lesson.class_link || lesson.class_link.trim() === '')) {
  return TrialLessonStatus.WAITING_LINK
}
```

**字段**:
- `matched_teacher` ≠ 空
- `confirmed_teacher` ≠ 空
- `confirmed_time` ≠ 空
- `class_link` = 空

**说明**:
- 时间已确定，但未生成上课链接
- 需要教务生成 ClassIn 链接

---

### 规则6: 已排待上课

**状态**: `scheduled`

**判断条件**:
```typescript
// 先检查是否已转化
const isConverted = await calculateIsConverted(lesson)

if (lessonTime > today && !isConverted) {
  return TrialLessonStatus.SCHEDULED
}
```

**字段**:
- `matched_teacher` ≠ 空
- `confirmed_teacher` ≠ 空
- `confirmed_time` ≠ 空
- `class_link` ≠ 空
- `confirmed_time` > 今天
- `is_converted` = false

**说明**:
- 所有准备工作已完成
- 上课时间还未到
- 等待上课

---

### 规则7: 上完待反馈

**状态**: `waiting_feedback`

**判断条件**:
```typescript
// 先检查是否已转化
const isConverted = await calculateIsConverted(lesson)

if (lessonTime <= today && !isConverted) {
  return TrialLessonStatus.WAITING_FEEDBACK
}
```

**字段**:
- `matched_teacher` ≠ 空
- `confirmed_teacher` ≠ 空
- `confirmed_time` ≠ 空
- `class_link` ≠ 空
- `confirmed_time` <= 今天
- `is_converted` = false

**说明**:
- 上课时间已过
- 还没有填写是否转化
- 需要老师或销售填写转化结果

---

### 规则8: 已完成

**状态**: `completed`

**判断条件**:
```typescript
const isConverted = await calculateIsConverted(lesson)

if (isConverted) {
  return TrialLessonStatus.COMPLETED
}
```

**字段**:
- `is_converted` = true

**说明**:
- 已填写转化结果（是/否/待定）
- 流程结束

---

## 🔄 是否转化计算规则

### 规则

```typescript
export async function calculateIsConverted(lesson: any): Promise<boolean> {
  // 1. 检查是否产生正式订单
  const hasFormalOrder = await checkIfHasFormalOrderFromLesson(lesson.id)
  if (hasFormalOrder) {
    return true
  }

  // 2. 检查手动标记
  const manualConverted = lesson.manual_converted

  // 2a. 手动标记为"是"
  if (manualConverted === '是') {
    return true
  }

  // 2b. 手动标记为"否"或"待定"
  if (manualConverted === '否' || manualConverted === '待定') {
    return false
  }

  // 2c. 没有手动标记，默认未转化
  if (!manualConverted || manualConverted.trim() === '') {
    return false
  }

  // 3. 其他情况默认未转化
  return false
}
```

### 逻辑表

| 条件 | is_converted | 说明 |
|------|-------------|------|
| 产生正式订单 | true | 自动转化 |
| manual_converted = "是" | true | 手动标记为是 |
| manual_converted = "否" | false | 手动标记为否 |
| manual_converted = "待定" | false | 手动标记为待定 |
| manual_converted = 空 | false | 未填写，默认未转化 |

---

## 📅 时间比较逻辑

### 今天的计算

```typescript
const today = new Date()
today.setHours(23, 59, 59, 999) // 今天的最后一刻
```

### 课程时间的计算

```typescript
const lessonTime = new Date(lesson.confirmed_time)
lessonTime.setHours(23, 59, 59, 999) // 当天的最后一刻
```

### 比较逻辑

| 比较 | 含义 | 示例 |
|------|------|------|
| `lessonTime > today` | 时间还未到 | 今天是1月1日，上课时间是1月5日 |
| `lessonTime <= today` | 时间已过 | 今天是1月5日，上课时间是1月1日 |
| `lessonTime === today` | 就是今天 | 今天是1月1日，上课时间也是1月1日 |

---

## 🧪 测试场景

### 场景1: 正常流程（转化）

**时间线**:
```
2025-01-01: 创建试听 → waiting_match
2025-01-02: 匹配老师 → waiting_confirm
2025-01-03: 确认老师 → waiting_time
2025-01-04: 确定时间 → waiting_link
2025-01-05: 生成链接 → scheduled (时间: 2025-01-10)
2025-01-10: 上完课，标记为"是" → completed
```

**预期结果**:
- ✅ 状态正确流转
- ✅ 1月10日前显示"已排待上课"
- ✅ 1月10日后显示"上完待反馈"
- ✅ 填写转化后显示"已完成"

---

### 场景2: 正常流程（未转化）

**时间线**:
```
2025-01-01: 创建试听 → waiting_match
...
2025-01-05: 生成链接 → scheduled (时间: 2025-01-10)
2025-01-10: 上完课，标记为"否" → completed
```

**预期结果**:
- ✅ 1月10日前显示"已排待上课"
- ✅ 1月10日后显示"上完待反馈"
- ✅ 填写"否"后显示"已完成"

---

### 场景3: 中途取消

**时间线**:
```
2025-01-01: 创建试听 → waiting_match
2025-01-02: 匹配老师 → waiting_confirm
2025-01-03: 设置 course_status = "取消试听" → cancelled
```

**预期结果**:
- ✅ 状态立即变为"取消试听"
- ✅ 不再流转到其他状态

---

### 场景4: 产生正式订单自动转化

**时间线**:
```
2025-01-01: 创建试听 → waiting_match
...
2025-01-05: 生成链接 → scheduled (时间: 2025-01-10)
2025-01-08: 创建正式订单 (关联此试听) → completed
```

**预期结果**:
- ✅ 即使时间未到，也显示"已完成"
- ✅ 因为产生了正式订单

---

## 📋 字段说明

### trial_lessons 表关键字段

| 字段名 | 类型 | 说明 | 必填 |
|--------|------|------|------|
| `course_status` | string | 课程状态 | 是 |
| `matched_teacher` | string | 匹配老师 | 否 |
| `confirmed_teacher` | string | 确认老师（教务） | 否 |
| `confirmed_time` | date | 确定试听时间 | 否 |
| `class_link` | string | 上课链接 | 否 |
| `manual_converted` | string | 是否转化（手动） | 否 |
| `is_converted` | boolean | 是否转化（计算字段） | - |

### formal_orders 表关联字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `trial_lesson_id` | uuid | 关联的试听ID |

---

## ✅ 代码位置

**文件**: `lib/status-calculator.ts`

**函数**:
- `calculateTrialLessonStatus()` - 计算试听状态
- `calculateIsConverted()` - 计算是否转化
- `checkIfHasFormalOrderFromLesson()` - 检查是否有正式订单
- `getTrialLessonStatusName()` - 获取状态中文名

---

## 🔧 维护说明

### 修改状态规则

如需修改状态判断逻辑，编辑 `calculateTrialLessonStatus()` 函数。

### 添加新状态

1. 在 `TrialLessonStatus` enum 中添加新状态
2. 在 `calculateTrialLessonStatus()` 中添加判断逻辑
3. 在 `getTrialLessonStatusName()` 中添加中文名称

### 修改转化规则

编辑 `calculateIsConverted()` 函数。

---

**文档版本**: v1.0
**最后更新**: 2025-01-01
**维护者**: 开发团队
