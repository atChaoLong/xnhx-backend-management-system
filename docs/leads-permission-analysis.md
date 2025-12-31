# 线索管理展示条件和操作权限分析

**分析时间**: 2025-01-01
**分析目标**: 检查线索管理页面的展示条件和操作按钮是否符合业务需求

---

## 📋 业务需求 (来自文档)

### 运营人员 (operator)
**路由**: `/dashboard/leads/new` - 线索录入
**职责**: 录入线索并派单给销售

**操作**:
- ✅ 录入新线索
- ✅ 编辑自己创建的线索
- ✅ 删除线索
- ❌ 不需要反馈线索（这是销售的工作）

**查看范围**: 所有线索（监控整体情况）

---

### 销售顾问 (sales)
**路由**: `/dashboard/leads` - 线索管理
**职责**: 跟进线索、反馈状态、创建试听

**操作**:
- ✅ 查看所有线索
- ✅ 反馈线索添加状态（已添加/未添加）
- ✅ 创建试听课程
- ❌ 不能编辑线索基本信息（只能反馈）
- ❌ 不能删除线索

**查看范围**: 所有线索（但只能操作派给自己的）

---

### 班主任 (head_teacher)
**路由**: `/dashboard/leads` - 线索管理
**职责**: 查看线索、创建试听

**操作**:
- ✅ 查看所有线索
- ✅ 创建试听课程
- ❌ 不能反馈线索（这是销售的工作）
- ❌ 不能编辑线索
- ❌ 不能删除线索

**查看范围**: 所有线索

---

## 🔍 当前实现分析

### 权限矩阵 (lib/permissions.ts)

#### 运营人员权限
```typescript
operator: {
  leads: ['view', 'create', 'edit', 'delete'],
}
```
✅ **符合需求**:
- ✅ view - 可以查看线索
- ✅ create - 可以录入线索
- ✅ edit - 可以编辑线索
- ✅ delete - 可以删除线索
- ❌ 缺少 feedback - 运营不需要反馈（正确，不应该有）

#### 销售顾问权限
```typescript
sales: {
  leads: ['view', 'edit', 'feedback', 'convert'],
}
```
⚠️ **部分符合**:
- ✅ view - 可以查看线索
- ✅ feedback - 可以反馈线索
- ✅ convert - 可以创建试听
- ❌ edit - 不应该有编辑权限（当前实现有误）
- ❌ 缺少限制：应该只能操作派给自己的线索

#### 班主任权限
```typescript
head_teacher: {
  leads: ['view'],
}
```
❌ **不符合需求**:
- ✅ view - 可以查看线索
- ❌ 缺少 convert - 应该可以创建试听（文档要求：system-menu.md:129）

---

### 页面实际使用 (app/dashboard/leads/page.tsx)

#### 操作按钮展示条件

**当前代码** (line 307-354):
```typescript
{/* 销售反馈按钮 */}
{leadsPerm.feedback() && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>
    <MessageCircle className="mr-2 h-4 w-4" />
    反馈
  </Button>
)}

{/* 创建试听按钮 */}
{leadsPerm.convert() && (
  <Button onClick={() => handleCreateTrialLesson(lead)}>
    <Video className="mr-2 h-4 w-4" />
    创建试听
  </Button>
)}

{/* 运营编辑按钮 */}
{leadsPerm.edit() && (
  <Link href={`/dashboard/leads/${lead.id}/edit`}>
    <Button variant="ghost" size="icon">
      <Edit className="h-4 w-4" />
    </Button>
  </Link>
)}

{/* 运营删除按钮 */}
{leadsPerm.delete() && (
  <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(lead.id)}>
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
)}
```

---

## ❌ 发现的问题

### 问题1: 销售有编辑权限但不应该编辑基本信息

**严重程度**: 🟡 P1 - 重要问题

**当前状态**:
- sales 有 `edit` 权限
- 页面上会显示"编辑"按钮

**问题**:
- 销售应该只能反馈 `add_status`，不能编辑其他字段
- 当前编辑按钮会让销售可以修改 `report_number`, `entry_date` 等关键字段

**建议修复**:
```typescript
// lib/permissions.ts
sales: {
  leads: ['view', 'feedback', 'convert'],  // 移除 'edit'
}
```

---

### 问题2: 班主任缺少创建试听权限

**严重程度**: 🟡 P1 - 重要问题

**当前状态**:
- head_teacher 没有 `convert` 权限
- 页面上不显示"创建试听"按钮

**文档要求** (system-menu.md:129):
> 班主任操作:
>   - 创建试听课程

**建议修复**:
```typescript
// lib/permissions.ts
head_teacher: {
  leads: ['view', 'convert'],  // 添加 'convert'
}
```

---

### 问题3: 缺少"派单给我"筛选条件

**严重程度**: 🟢 P2 - 用户体验问题

**需求场景**:
- 销售只关心派给自己的线索
- 需要快速筛选"我负责的线索"

**建议添加**:
```typescript
// 筛选条件
const [filterMyLeads, setFilterMyLeads] = useState(false)

// 筛选逻辑
const filteredLeads = filterMyLeads
  ? leads.filter(l => l.grab_user_id === user?.id)
  : leads

// UI
<Checkbox
  checked={filterMyLeads}
  onCheckedChange={setFilterMyLeads}
/>
<label>只看我的线索</label>
```

---

### 问题4: 缺少按添加状态筛选

**严重程度**: 🟢 P2 - 用户体验问题

**需求场景**:
- 销售需要快速找到"销售未反馈"的线索
- 运营需要查看"运营未派单"的线索

**建议添加**:
```typescript
// 筛选条件
const [filterAddStatus, setFilterAddStatus] = useState<string>('all')

// 筛选选项
const ADD_STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'unassigned', label: '运营未派单' },
  { value: 'waiting_feedback', label: '销售未反馈' },
  { value: 'added', label: '已添加' },
  { value: 'not_added', label: '未添加' },
]

// UI
<Select value={filterAddStatus} onValueChange={setFilterAddStatus}>
  {ADD_STATUS_OPTIONS.map(option => (
    <SelectItem key={option.value} value={option.value}>
      {option.label}
    </SelectItem>
  ))}
</Select>
```

---

### 问题5: 缺少按转化状态筛选

**严重程度**: 🟢 P2 - 用户体验问题

**需求场景**:
- 运营需要查看试听转化率
- 销售需要跟进未转化的线索

**建议添加**:
```typescript
// 筛选条件
const [filterConvertStatus, setFilterConvertStatus] = useState<string>('all')

// 筛选选项
const CONVERT_STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'empty', label: '未转化' },
  { value: 'trial', label: '试听中' },
  { value: 'formal', label: '已报名' },
]
```

---

### 问题6: "运营派单"状态线索不应该显示"反馈"按钮

**严重程度**: 🟡 P1 - 逻辑错误

**问题**:
- 当 `add_status = 'unassigned'` (运营未派单) 时
- 销售还没有接单，不应该显示"反馈"按钮

**当前逻辑**:
```typescript
{leadsPerm.feedback() && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>
    反馈
  </Button>
)}
```
❌ 所有销售都能看到反馈按钮

**应该的逻辑**:
```typescript
{leadsPerm.feedback() && lead.grab_user_id === user?.id && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>
    反馈
  </Button>
)}
```
✅ 只有派给当前用户的线索才显示反馈按钮

---

## 📊 修复优先级

### 🔴 P0 - 立即修复 (影响业务正确性)
1. **修复班主任缺少创建试听权限**
   - 文件: `lib/permissions.ts`
   - 修改: 添加 `convert` 权限到 `head_teacher`

2. **修复销售编辑权限问题**
   - 文件: `lib/permissions.ts`
   - 修改: 移除 `edit` 权限从 `sales`

### 🟡 P1 - 应该修复 (影响用户体验)
3. **修复"反馈"按钮显示逻辑**
   - 文件: `app/dashboard/leads/page.tsx`
   - 修改: 只对派给自己的线索显示反馈按钮

### 🟢 P2 - 可以后续优化 (提升体验)
4. 添加"只看我的线索"筛选
5. 添加按添加状态筛选
6. 添加按转化状态筛选

---

## 🔧 具体修复代码

### 修复1: 权限矩阵

```typescript
// lib/permissions.ts

// 销售顾问：线索跟进、学生管理、订单录入
sales: {
  leads: ['view', 'feedback', 'convert'],  // ✅ 移除 'edit'
  trialLessons: ['view', 'create', 'edit', 'confirmTime', 'convert'],
  students: ['view', 'create', 'edit'],
  formalOrders: ['view', 'create', 'edit'],
  transactions: ['view'],
  teacherCandidates: ['view'],
  teachers: ['view'],
  dictionaries: ['view'],
  users: ['view'],
},

// 班主任：学生管理、排课、回访、续费
head_teacher: {
  leads: ['view', 'convert'],  // ✅ 添加 'convert'
  trialLessons: ['view', 'edit'],
  students: ['view', 'create', 'edit', 'schedule', 'visit'],
  formalOrders: ['view', 'create', 'edit'],
  transactions: ['view', 'create'],
  teacherCandidates: ['view'],
  teachers: ['view'],
  dictionaries: ['view'],
  users: ['view'],
},
```

### 修复2: 反馈按钮显示逻辑

```typescript
// app/dashboard/leads/page.tsx

{/* 销售反馈按钮 - 只对派给自己的线索显示 */}
{leadsPerm.feedback() && lead.grab_user_id === user?.id && (
  <Button
    variant="outline"
    size="sm"
    title="标记为已反馈"
    onClick={() => handleMarkAsFeedback(lead)}
    disabled={lead.add_status === 'added'}
  >
    <MessageCircle className="mr-2 h-4 w-4" />
    反馈
  </Button>
)}
```

### 修复3: 添加筛选功能

```typescript
// app/dashboard/leads/page.tsx

// 添加状态
const [filterMyLeads, setFilterMyLeads] = useState(false)
const [filterAddStatus, setFilterAddStatus] = useState<string>('all')
const [filterConvertStatus, setFilterConvertStatus] = useState<string>('all')

// 筛选逻辑
const filteredLeads = leads.filter(lead => {
  // 1. 只看我的线索
  if (filterMyLeads && lead.grab_user_id !== user?.id) {
    return false
  }

  // 2. 按添加状态筛选
  if (filterAddStatus !== 'all' && lead.add_status !== filterAddStatus) {
    return false
  }

  // 3. 按转化状态筛选
  if (filterConvertStatus !== 'all' && lead.convert_status !== filterConvertStatus) {
    return false
  }

  return true
})

// UI 在列表上方添加筛选栏
<div className="flex gap-4 mb-4">
  <Checkbox
    checked={filterMyLeads}
    onCheckedChange={setFilterMyLeads}
  />
  <label>只看我的线索</label>

  <Select value={filterAddStatus} onValueChange={setFilterAddStatus}>
    <SelectTrigger className="w-40">
      <SelectValue placeholder="添加状态" />
    </SelectTrigger>
    <SelectContent>
      {ADD_STATUS_OPTIONS.map(option => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  <Select value={filterConvertStatus} onValueChange={setFilterConvertStatus}>
    <SelectTrigger className="w-40">
      <SelectValue placeholder="转化状态" />
    </SelectTrigger>
    <SelectContent>
      {CONVERT_STATUS_OPTIONS.map(option => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

## ✅ 修复后的预期效果

### 运营人员
- ✅ 可以录入新线索
- ✅ 可以编辑/删除线索
- ✅ 可以查看所有线索
- ✅ 不显示"反馈"和"创建试听"按钮

### 销售顾问
- ✅ 可以查看所有线索
- ✅ 只对派给自己的线索显示"反馈"按钮
- ✅ 可以创建试听
- ❌ 不能编辑线索基本信息
- ❌ 不能删除线索
- ✅ 可以筛选"我的线索"

### 班主任
- ✅ 可以查看所有线索
- ✅ 可以创建试听（按钮显示）
- ❌ 不能反馈线索（按钮不显示）
- ❌ 不能编辑线索
- ❌ 不能删除线索

---

**文档版本**: v1.0
**创建日期**: 2025-01-01
**状态**: 待修复
