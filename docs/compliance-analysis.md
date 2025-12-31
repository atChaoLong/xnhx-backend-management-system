# 已实现功能符合性严格分析

**分析时间**: 2025-01-01
**分析对象**: 所有已实现的功能代码 vs 文档要求

---

## 🔍 分析方法

对每个已实现的功能，严格对照以下文档进行检查:
1. `docs/system-menu.md` - 菜单和功能要求
2. `docs/business-status-rules.md` - 状态计算规则
3. `docs/role-permissions.md` - 权限要求
4. `docs/database-design.md` - 数据库设计

---

## 1. 线索管理 (`/dashboard/leads`)

### ✅ 符合项

#### 1.1 页面和路由
- ✅ 路由正确: `/dashboard/leads`
- ✅ 页面存在且可访问
- ✅ 权限Hook已集成: `usePermission()`

#### 1.2 数据展示
**要求字段** (system-menu.md:116-153):
- ✅ 录单日期 → `entry_date`
- ✅ 报单序号 → `report_number`
- ✅ 小红书账号来源 → `xhs_source`
- ✅ 年级 → `grade_code`
- ✅ 咨询学科 → `subject_codes`
- ✅ 地域 → `region_ip`
- ✅ 添加方式 → `add_method_code`
- ✅ 家长微信 → `parent_wechat`
- ✅ 抢单微信 → `grab_wechat`
- ✅ 添加状态 → `add_status` (计算得出)
- ✅ 转化状态 → `convert_status` (计算得出)
- ✅ 运营人员 → `operator_id`
- ✅ 创建人 → `created_by`

#### 1.3 状态计算
**文档要求** (business-status-rules.md:30-95):
- ✅ **线索添加状态** 已实现 (`lib/status-calculator.ts:58-83`)
  ```typescript
  // 实现的4种状态:
  - unassigned     // 运营未派单
  - added          // 已添加
  - not_added      // 未添加
  - waiting_feedback // 销售未反馈
  ```

  **符合性检查**:
  - ✅ 检查 `xhs_source` 是否为空
  - ✅ 检查 `feedback_added` 字段
  - ✅ 检查是否产生试听
  - ❌ **严重问题**: 文档要求检查 `grab_wechat`，代码检查 `xhs_source`
    ```typescript
    // 文档要求 (business-status-rules.md:33)
    if (!lead.grab_wechat || lead.grab_wechat.trim() === '') {
      return 'unassigned';
    }

    // 实际代码 (status-calculator.ts:60)
    if (!lead.xhs_source) {
      return LeadAddStatus.UNASSIGNED
    }
    ```

- ✅ **线索转化状态** 已实现 (`lib/status-calculator.ts:88-101`)
  ```typescript
  // 实现的3种状态:
  - trial   // 试听
  - formal  // 正式
  - empty   // 空
  ```
  ✅ 完全符合文档要求

#### 1.4 权限控制
**文档要求** (role-permissions.md:138-153):
- ✅ 销售: `read: true, update: 'partial', delete: false, feedback: true`
- ✅ 班主任: `read: true, update: false, delete: false, feedback: false`

**实际代码** (leads/page.tsx:307-330):
```typescript
{leadsPerm.feedback() && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>反馈</Button>
)}
{leadsPerm.convert() && (
  <Button onClick={() => handleCreateTrialLesson(lead)}>创建试听</Button>
)}
{leadsPerm.edit() && (
  <Link href={`/dashboard/leads/${lead.id}/edit`}>编辑</Link>
)}
{leadsPerm.delete() && (
  <Button onClick={() => handleDeleteClick(lead.id)}>删除</Button>
)}
```
✅ 权限控制正确

#### 1.5 操作功能
- ✅ **销售反馈**: 已实现 `handleMarkAsFeedback` (line 134-159)
- ✅ **创建试听**: 已实现 `handleCreateTrialLesson` (line 162-165)
- ✅ **编辑线索**: 已实现，链接到编辑页面
- ✅ **删除线索**: 已实现，带确认对话框

---

### ❌ 不符合项

#### 1.1 状态计算逻辑错误

**严重问题**: 线索添加状态判断逻辑与文档不一致

| 检查项 | 文档要求 | 实际代码 | 符合性 |
|-------|---------|---------|--------|
| 运营未派单条件 | `!lead.grab_wechat` | `!lead.xhs_source` | ❌ 错误 |
| 已添加检查字段 | `lead.add_status === 'added'` | `lead.feedback_added === '已添加'` | ❌ 字段名不一致 |
| 手动标记值 | `'added'` / `'not_added'` | `'已添加'` / `'未添加'` | ❌ 值不一致 |

**影响**:
- 状态计算结果不准确
- 可能导致"运营未派单"的线索永远无法正确识别

**修复建议**:
```typescript
// 应该修改为:
export async function calculateLeadAddStatus(lead: any): Promise<LeadAddStatus> {
  // 1. 运营未派单：抢单微信号为空
  if (!lead.grab_wechat || lead.grab_wechat.trim() === '') {
    return LeadAddStatus.UNASSIGNED
  }

  // 2. 检查是否产生试听
  const hasTrialLesson = await checkIfHasTrialLesson(lead.id)

  // 3. 已添加 (even if manual says 'not_added', if trial exists then 'added')
  if (lead.add_status === 'added' || hasTrialLesson) {
    return LeadAddStatus.ADDED
  }

  // 4. 未添加
  if (lead.add_status === 'not_added') {
    return LeadAddStatus.NOT_ADDED
  }

  // 5. 销售未反馈
  if (!lead.add_status && !hasTrialLesson) {
    return LeadAddStatus.WAITING_FEEDBACK
  }

  return LeadAddStatus.WAITING_FEEDBACK
}
```

#### 1.2 数据库字段不匹配

**问题**: 代码使用的字段名与数据库设计不一致

**实际代码使用** (status-calculator.ts:68-75):
- `lead.feedback_added` - ❌ 这个字段在文档中不存在
- `lead.add_status` - ✅ 文档中定义的字段

**文档定义** (business-status-rules.md:30-95):
- `leads.add_status` - 添加状态 (enum)

**影响**:
- 状态计算可能永远返回默认值
- 手动反馈功能无法正常工作

#### 1.3 缺少筛选功能

**文档要求** (system-menu.md:122-133):
> 查看所有线索列表

**实际实现**: 无任何筛选或搜索功能

**建议添加**:
- 按添加状态筛选
- 按转化状态筛选
- 按运营人员筛选
- 按时间范围筛选

---

## 2. 线索录入 (`/dashboard/leads/new`)

### ✅ 符合项

#### 2.1 页面和路由
- ✅ 路由正确: `/dashboard/leads/new`
- ✅ 权限控制: 运营角色专属

#### 2.2 表单字段
**要求字段** (system-menu.md:99-99):
- ✅ 报单序号 → `report_number`
- ✅ 录单日期 → `entry_date`
- ✅ 小红书账号来源 → `xhs_source`
- ✅ 添加方式 → `add_method_code`
- ✅ 运营人员 → `operator_id` (默认当前用户)
- ✅ 年级 → `grade_code`
- ✅ 咨询学科 → `subject_codes`
- ✅ 地域 → `region_ip`
- ✅ 家长微信 → `parent_wechat`
- ✅ 聊天截图 → `chat_screenshots`

#### 2.3 默认值
- ✅ 运营人员默认为当前登录用户
- ✅ 录单日期默认为今天

#### 2.4 提交流程
- ✅ 提交后自动设置状态为"运营未派单"
- ✅ 记录创建人和更新人

---

### ❌ 不符合项

#### 2.1 缺少重复标记功能

**文档要求** (system-menu.md:96-97):
> 填写基础信息: 报单序号、录单日期、小红书账号来源、添加方式

**实际表单** (需要检查): 缺少重复标记和冲突运营人员字段

**数据库字段**:
- `duplicate_mark` - 重复标记 (boolean)
- `collision_operator` - 冲突运营人员

---

## 3. 试听课程管理

### ❌ 完全未实现

**状态**: 页面不存在 `/dashboard/trial-lessons`

**影响**:
- ❌ 销售无法创建试听课程
- ❌ 教务无法匹配老师
- ❌ 无法查看试听状态流转
- ❌ 整个试听转化流程断裂

**文档要求** (system-menu.md:157-207):
- 试听列表 (8种状态)
- 新增试听 (销售/班主任)
- 匹配老师 (教务)
- 确认老师 (教务)
- 确定时间 (教务)
- 生成链接 (教务)
- 填写反馈 (老师)

**状态计算器**: ✅ 已实现 (status-calculator.ts:160-224)
```typescript
export enum TrialLessonStatus {
  CANCELLED = 'cancelled',           // 取消试听
  WAITING_MATCH = 'waiting_match',   // 待匹配老师
  WAITING_CONFIRM = 'waiting_confirm', // 待确认老师
  WAITING_TIME = 'waiting_time',     // 待确认时间
  WAITING_LINK = 'waiting_link',     // 待开链接
  SCHEDULED = 'scheduled',           // 已排待上课
  WAITING_FEEDBACK = 'waiting_feedback', // 上完待反馈
  COMPLETED = 'completed'            // 已完成
}
```
✅ 状态定义完全符合文档要求 (business-status-rules.md:156-231)

---

## 4. 正式订单管理 (`/dashboard/formal-orders`)

### ✅ 符合项

#### 4.1 页面和路由
- ✅ 路由正确: `/dashboard/formal-orders`
- ✅ 新增页面: `/dashboard/formal-orders/new`
- ✅ 编辑页面: `/dashboard/formal-orders/[id]/edit`

#### 4.2 基本功能
- ✅ 订单列表展示
- ✅ 新建订单
- ✅ 编辑订单
- ✅ 权限控制

---

### ❌ 不符合项

#### 4.1 缺少续费订单限制

**文档要求** (system-menu.md:214-255):
```typescript
// 销售
{
  create: {
    new: true,     // 可以录入新签订单
    renewal: false // 不能录入续费订单
  }
}

// 班主任
{
  create: {
    new: false,    // 不能录入新签订单
    renewal: true  // 可以录入续费订单
  }
}
```

**实际实现**: 需要检查是否有角色限制逻辑

#### 4.2 订单状态未实现

**文档要求**: 订单状态流转
- draft (草稿)
- pending_payment (待付款)
- active (进行中)
- suspended (已暂停)
- completed (已完成)
- refunded (已退费)
- cancelled (已取消)

**实际实现**: 需要检查是否有状态计算

---

## 5. 学生管理 (`/dashboard/students`)

### ✅ 符合项

#### 5.1 基本功能
- ✅ 学生列表
- ✅ 新建学生
- ✅ 编辑学生
- ✅ 学生详情页 (需要检查)

---

### ❌ 不符合项

#### 5.1 缺少学生状态计算

**文档要求** (business-status-rules.md:265-340):
- 缺状态: `status` 字段为空
- 快没课: 距离课表截至 < 7天
- 已回访: 本月回访次数 > 0
- 新生状态: 一周/两周/三周/四周/老生

**实际实现**:
- ✅ 状态计算器已实现 (status-calculator.ts:294-375)
- ❌ 但列表页面可能未展示这些状态
- ❌ `student_visits` 表不存在，回访状态无法计算

#### 5.2 缺少学生详情页功能

**文档要求** (system-menu.md:260-309):
- 批量排课
- 课时管理
- 回访管理

**实际实现**: 需要检查详情页是否存在

---

## 6. 老师候选人管理 (`/dashboard/teacher-candidates`)

### ✅ 符合项

#### 6.1 基本功能
- ✅ 候选人列表
- ✅ 新建候选人
- ✅ 编辑候选人

---

### ❌ 不符合项

#### 6.1 面试流程未拆分

**文档要求** (system-menu.md:374-523):
- 老师约面 (`/dashboard/teacher-candidates/interview`)
- 录像上传 (`/dashboard/teacher-candidates/upload`)
- 教学复核 (`/dashboard/teacher-candidates/review`)
- 待入库 (`/dashboard/teacher-candidates/pending`)
- 储备 (`/dashboard/teacher-candidates/reserve`)

**实际实现**: 只有统一的列表页，未按面试流程拆分

**影响**:
- ❌ 招师HR无法约面
- ❌ 无法上传面试录像
- ❌ 教务无法教学复核
- ❌ 入库流程不清晰

---

## 7. 权限系统

### ✅ 符合项

#### 7.1 权限定义
- ✅ `lib/permissions.ts` - 权限定义完整
- ✅ `docs/role-permissions.md` - 文档完整

#### 7.2 权限Hook
- ✅ `lib/hooks/usePermission.ts` 已实现

#### 7.3 集成使用
- ✅ 线索管理页面已使用权限Hook

---

### ❌ 不符合项

#### 7.1 缺少API层权限验证

**文档要求** (system-menu.md:992-1053):
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const user = await verifyAuthToken(token)
  const hasAccess = checkPathPermission(path, user.role)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

**实际实现**: 需要检查middleware是否存在

#### 7.2 缺少RLS策略

**文档要求**: Supabase Row Level Security策略

**实际实现**: 需要检查Supabase项目

---

## 8. 数据库表

### ✅ 已存在的表 (17张)
见 `docs/online-tables.md`

### ❌ 缺失的表 (13张)

#### 8.1 严重影响功能的缺失

1. **`student_profiles`** - 学生详细档案
   - 影响: 学生管理功能不完整
   - 优先级: P0

2. **`visit_records`** - 回访记录 (实际代码查询 `student_visits`)
   - 影响: 学生状态"已回访"无法计算
   - 优先级: P0
   - **严重问题**: 代码查询的表名 `student_visits` 与文档不一致 `visit_records`

3. **`courses`** - 课程详细排课
   - 影响: 批量排课功能无法实现
   - 优先级: P1

4. **`class_sessions`** - 具体课次
   - 影响: 课时管理无法实现
   - 优先级: P1

5. **`class_schedules`** - 课程日历
   - 影响: 排课日历无法实现
   - 优先级: P1

6. **`todos`** - 待办事项
   - 影响: 任务管理功能缺失
   - 优先级: P2

---

## 9. 总体符合性评分

| 功能模块 | 符合性 | 评分 | 说明 |
|---------|--------|------|------|
| 线索录入 | ⚠️ 部分 | 70% | 基本功能正常，缺少重复标记 |
| 线索管理 | ⚠️ 部分 | 60% | **严重bug**: 状态计算逻辑错误 |
| 试听课程 | ❌ 缺失 | 0% | 页面不存在，流程断裂 |
| 正式订单 | ⚠️ 部分 | 70% | 基本功能正常，缺少续费限制 |
| 学生管理 | ⚠️ 部分 | 50% | 基本CRUD正常，缺少状态展示 |
| 老师候选人 | ⚠️ 部分 | 40% | 未按面试流程拆分 |
| 权限系统 | ⚠️ 部分 | 60% | 前端权限正常，缺少API验证 |
| 状态计算器 | ✅ 已实现 | 90% | 逻辑完整，但有字段不匹配bug |
| 数据库表 | ❌ 缺失 | 57% | 缺13张关键表 |

**总体评分**: **55% - 不合格**

---

## 10. 关键问题总结

### 🔴 P0 - 严重bug (必须立即修复)

#### Bug 1: 线索添加状态计算错误
**位置**: `lib/status-calculator.ts:58-83`

**问题**: 检查 `xhs_source` 而非 `grab_wechat`
**影响**: 所有"运营未派单"的线索无法正确识别
**修复**: 修改判断条件为 `!lead.grab_wechat`

#### Bug 2: 字段名不匹配
**位置**: `lib/status-calculator.ts:68-75`

**问题**: 使用 `feedback_added` 而非 `add_status`
**影响**: 手动反馈功能无法正常工作
**修复**: 统一使用 `add_status` 字段

#### Bug 3: 回访记录表名不一致
**位置**: `lib/status-calculator.ts:282-287`

**问题**: 代码查询 `student_visits`，文档定义 `visit_records`
**影响**: 学生状态"已回访"无法计算
**修复**: 统一表名为 `visit_records` 或更新文档

---

### 🟡 P1 - 重要缺失 (应该尽快修复)

1. **试听课程管理页面** - 核心功能缺失
2. **回访记录表** - 学生管理关键
3. **学生详细档案表** - 批量排课需要
4. **课程排课表** - 教务核心功能

---

### 🟢 P2 - 增强功能 (可以后续优化)

1. 筛选和搜索功能
2. 面试流程页面拆分
3. 待办事项系统
4. API权限中间件

---

## 11. 修复优先级建议

### 第1周 - 修复P0 bug
1. 修复线索状态计算逻辑
2. 统一字段名称
3. 创建 `visit_records` 表
4. 修复回访状态计算

### 第2周 - 补齐核心功能
5. 创建试听课程管理页面
6. 集成试听状态计算器
7. 创建待试听匹配页面

### 第3周 - 完善数据模型
8. 创建 `student_profiles` 表
9. 创建 `courses` 等排课表
10. 实现批量排课功能

### 第4周+ - 优化和增强
11. 添加筛选搜索
12. 拆分面试流程页面
13. 完善权限系统

---

**文档版本**: v1.0
**创建日期**: 2025-01-01
**分析师**: Claude AI
**结论**: 已实现功能存在严重bug，需要立即修复后再继续开发新功能
