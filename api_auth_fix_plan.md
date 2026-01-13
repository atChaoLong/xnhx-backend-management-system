# API 请求认证问题系统性修复计划

## 问题概述

发现多个前端页面直接使用 `fetch()` 而不是带认证的 `api` 函数，导致：
1. 请求没有携带 Authorization header
2. API 返回 401 Unauthorized
3. 用户功能无法正常使用

## 已修复

✅ `app/dashboard/teachers/[id]/page.tsx` - 老师详情页面获取面试记录

## 待修复列表

### 高优先级（核心业务功能）

| 文件 | 行号 | API 路径 | 功能描述 | 优先级 |
|------|------|----------|----------|--------|
| `app/dashboard/leads/page.tsx` | 219 | `/api/leads/feedback` | 线索反馈 | P0 |
| `app/dashboard/leads/page.tsx` | 266 | `/api/leads/grab` | 抢单 | P0 |
| `app/dashboard/leads/page.tsx` | 291 | `/api/leads/release` | 释放线索 | P0 |
| `app/dashboard/teachers/page.tsx` | 158 | `/api/teachers/register-classin` | 老师ClassIn入库 | P0 |
| `app/dashboard/formal-orders/page.tsx` | 153 | `/api/teachers/classin` | 获取ClassIn老师 | P1 |
| `app/dashboard/formal-orders/page.tsx` | 167 | `/api/classin-sdk/classroom` | 创建ClassIn课堂 | P1 |
| `app/dashboard/trial-lessons/page.tsx` | 294 | `/api/trial-lessons/open-class` | 开设试听课 | P1 |
| `app/dashboard/trial-lessons/[id]/page.tsx` | 160 | `/api/trial-lessons/create-classin` | 创建ClassIn课程 | P1 |
| `app/dashboard/students/page.tsx` | 130 | `/api/users?role=head_teacher` | 获取班主任列表 | P1 |
| `app/dashboard/students/page.tsx` | 214 | `/api/students/assign-head-teacher` | 分配班主任 | P1 |
| `app/dashboard/students/page.tsx` | 273 | `/api/student-entries/confirm` | 学生入库确认 | P1 |

### 中优先级（管理功能）

| 文件 | 行号 | API 路径 | 功能描述 | 优先级 |
|------|------|----------|----------|--------|
| `app/dashboard/teacher-candidates/[id]/entry/page.tsx` | 67 | `/api/teacher-entries/confirm` | 老师入库确认 | P2 |
| `app/dashboard/sync/page.tsx` | 74 | `/api/sync/teachers` | 同步老师 | P2 |
| `app/dashboard/sync/page.tsx` | 118 | `/api/sync/students` | 同步学生 | P2 |
| `app/dashboard/sync/page.tsx` | 162 | `/api/sync/classes` | 同步课程 | P2 |
| `app/dashboard/sync/page.tsx` | 206 | `/api/sync/classrooms` | 同步课堂 | P2 |
| `app/dashboard/courses/[id]/page.tsx` | 263 | `/api/class-sessions` | 创建课节 | P2 |
| `app/dashboard/courses/[id]/page.tsx` | 310 | `/api/class-sessions/recreate` | 重建课节 | P2 |
| `app/dashboard/courses/[id]/page.tsx` | 361 | `/api/class-sessions/sync` | 同步课节 | P2 |
| `app/dashboard/students/[id]/page.tsx` | 362 | `/api/visit-records` | 创建回访记录 | P2 |

### 低优先级（测试/工具页面）

| 文件 | 行号 | API 路径 | 功能描述 | 优先级 |
|------|------|----------|----------|--------|
| `app/dashboard/classin/test/page.tsx` | 54, 102, 158 | `/api/classin/*` | ClassIn测试页面 | P3 |
| `app/dashboard/classin-sdk/page.tsx` | 70, 106, 142... | `/api/classin-sdk/*` | ClassIn SDK测试 | P3 |

## 修复方案

### 标准修复步骤

1. **导入 api 函数**
```typescript
import { api } from '@/lib/fetch'
```

2. **替换 fetch 调用**
```typescript
// 修复前
const response = await fetch('/api/xxx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})

// 修复后
const response = await api.post('/api/xxx', data)
```

3. **处理 POST/PUT 请求**
```typescript
// 修复前
const response = await fetch('/api/xxx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id, name })
})

// 修复后
const response = await api.post('/api/xxx', { id, name })
```

4. **处理带 options 的请求**
```typescript
// 修复前
const response = await fetch('/api/xxx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  cache: 'no-cache'
})

// 修复后 - api 函数不支持自定义 options，需要特殊处理
// 方案1：使用原生 fetch 但手动添加 token
const token = localStorage.getItem('supabase.auth.token')
const response = await fetch('/api/xxx', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data),
  cache: 'no-cache'
})

// 方案2：扩展 api 函数支持 options（推荐）
```

## 实施计划

### 阶段 1：核心业务功能 (P0)
- [ ] `app/dashboard/leads/page.tsx` - 线索管理
- [ ] `app/dashboard/teachers/page.tsx` - 老师管理

### 阶段 2：订单和学生管理 (P1)
- [ ] `app/dashboard/formal-orders/page.tsx` - 正式订单
- [ ] `app/dashboard/trial-lessons/` - 试听课管理
- [ ] `app/dashboard/students/page.tsx` - 学生管理

### 阶段 3：课程管理 (P2)
- [ ] `app/dashboard/courses/[id]/page.tsx` - 课程详情
- [ ] `app/dashboard/sync/page.tsx` - 数据同步
- [ ] `app/dashboard/students/[id]/page.tsx` - 学生详情

### 阶段 4：测试页面 (P3)
- [ ] `app/dashboard/classin/test/page.tsx`
- [ ] `app/dashboard/classin-sdk/page.tsx`

## 注意事项

1. **POST 请求带 options**
   - 如果使用了 `cache`、`mode` 等 fetch options
   - 需要手动添加 Authorization header
   - 或者扩展 api 函数支持自定义 options

2. **错误处理**
   - 修复后应该有更好的错误处理
   - 利用 401 拦截器自动处理 token 过期

3. **测试**
   - 修复后测试每个功能是否正常
   - 特别关注需要认证的操作

## 预期效果

- ✅ 所有 API 请求都携带认证 token
- ✅ Token 过期时自动清除本地存储
- ✅ 用户体验改善，不再出现无提示的 401 错误
- ✅ 代码统一，使用 api 函数而不是原生 fetch

---

**创建时间**: 2025-01-13
**状态**: 待实施
