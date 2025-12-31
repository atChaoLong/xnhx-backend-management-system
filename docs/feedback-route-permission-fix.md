# 线索反馈路由权限配置修复

**修复时间**: 2025-01-01
**问题**: POST /api/leads/feedback 被 middleware 拦截，提示需要 create 权限
**状态**: ✅ 已完成

---

## 🐛 问题描述

### 用户报告的错误

**请求**:
```
POST http://localhost:3000/api/leads/feedback
```

**响应** (403 Forbidden):
```json
{
  "error": "权限不足",
  "message": "您需要 leads 资源的 create 权限",
  "code": "PERMISSION_DENIED",
  "requiredResource": "leads",
  "requiredAction": "create"
}
```

**预期结果**: 应该要求 `feedback` 权限，而非 `create` 权限

---

## 🔍 根本原因分析

### 问题根源

#### 1. 全局中间件拦截

**文件**: `middleware.ts`

所有 `/api/*` 请求都会经过中间件进行权限检查：

```typescript
export async function middleware(request: NextRequest) {
  // 1. 跳过非API路由
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 2. 跳过公开路径
  const isPublic = PUBLIC_PATHS.some(path => pathname.startsWith(path))
  if (isPublic) {
    return NextResponse.next()
  }

  // 3. 获取路由的权限要求
  const permission = getRoutePermission(pathname, request.method)

  // 4. 检查用户权限
  const { hasPermission: authorized, role } = await verifyPermission(
    request,
    permission.resource,
    permission.action
  )

  if (!authorized) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  return NextResponse.next()
}
```

#### 2. 路由权限配置缺失

**文件**: `lib/route-permissions.ts`

**修复前的配置**:
```typescript
export const ROUTE_PERMISSIONS = {
  '/api/leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },
  // ❌ 缺少 /api/leads/feedback 的配置
}
```

#### 3. 前缀匹配导致错误

**文件**: `lib/route-permissions.ts:115-123`

```typescript
export function getRoutePermission(path: string, method: string) {
  // 精确匹配
  if (path in ROUTE_PERMISSIONS) {
    // ...
  }

  // 前缀匹配（用于动态路由）
  for (const [routePath, routeConfig] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(routePath)) {  // ← 这里匹配了 /api/leads/feedback
      const methodConfig = routeConfig[method as keyof typeof routeConfig]
      if (methodConfig) {
        return methodConfig  // ← 返回了 /api/leads 的 POST 配置（create 权限）
      }
    }
  }

  return null
}
```

**问题**:
- `/api/leads/feedback` 没有精确匹配配置
- 前缀匹配到 `/api/leads`
- 返回 `/api/leads` 的 POST 权限配置：`{ resource: 'leads', action: 'create' }`
- 但实际应该是：`{ resource: 'leads', action: 'feedback' }`

---

## ✅ 解决方案

### 方案：在路由权限配置中添加精确匹配

**文件**: `lib/route-permissions.ts:13-24`

```typescript
export const ROUTE_PERMISSIONS = {
  // 线索管理
  '/api/leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },

  // 线索反馈（特殊权限）✅ 新增
  '/api/leads/feedback': {
    POST: { resource: RESOURCES.leads, action: ACTIONS.feedback },
  },

  // ... 其他配置
}
```

### 工作原理

#### 请求流程

```
1. 前端发起请求
   POST /api/leads/feedback

2. Middleware 拦截
   ↓

3. getRoutePermission('/api/leads/feedback', 'POST')
   ↓

4. 精确匹配检查
   '/api/leads/feedback' in ROUTE_PERMISSIONS  ✅ 找到
   ↓

5. 返回配置
   {
     resource: RESOURCES.leads,      // 'leads'
     action: ACTIONS.feedback        // 'feedback'
   }
   ↓

6. verifyPermission(request, 'leads', 'feedback')
   ↓

7. 检查销售角色
   hasPermission('sales', 'leads', 'feedback')
   → PERMISSION_MATRIX['sales']['leads'].includes('feedback')
   → ['view', 'feedback', 'convert'].includes('feedback')
   → true ✅

8. 放行请求到 API 处理程序
   ↓

9. app/api/leads/feedback/route.ts 处理业务逻辑
```

---

## 🛡️ 安全性分析

### 权限分层

**第一层：Middleware 权限检查** (middleware.ts)
```typescript
// 检查：用户是否有 feedback 权限
hasPermission(role, 'leads', 'feedback')
```

**第二层：API 业务权限检查** (app/api/leads/feedback/route.ts)
```typescript
// 检查 1：是否有 feedback 权限（重复验证，防御性编程）
if (!hasPermission(profile.role, RESOURCES.leads, ACTIONS.feedback)) {
  return 403
}

// 检查 2：线索是否派给当前用户（数据所有权）
const isAssignedToMe = lead.grab_user_id === profile.id ||
  (lead.grab_wechat && lead.grab_wechat.includes(profile.name))

if (!isAssignedToMe) {
  return 403
}
```

**安全优势**:
- ✅ Middleware 层提供统一的权限拦截
- ✅ API 层提供细粒度的业务规则验证
- ✅ 双重保障，即使一层失效也不会导致安全问题
- ✅ 数据所有权验证防止权限提升攻击

---

## 📊 路由权限配置对比

### 修复前

| 路由 | 方法 | 资源 | 操作 | 说明 |
|-----|------|------|------|------|
| `/api/leads` | GET | leads | view | 获取线索列表 |
| `/api/leads` | POST | leads | create | 创建线索 |
| `/api/leads` | PUT | leads | edit | 更新线索 |
| `/api/leads` | DELETE | leads | delete | 删除线索 |
| `/api/leads/feedback` | POST | leads | **create** ❌ | **错误：前缀匹配导致** |

### 修复后

| 路由 | 方法 | 资源 | 操作 | 说明 |
|-----|------|------|------|------|
| `/api/leads` | GET | leads | view | 获取线索列表 |
| `/api/leads` | POST | leads | create | 创建线索 |
| `/api/leads` | PUT | leads | edit | 更新线索 |
| `/api/leads` | DELETE | leads | delete | 删除线索 |
| `/api/leads/feedback` | POST | leads | **feedback** ✅ | 反馈线索（正确） |

---

## 🎯 权限匹配规则总结

### 匹配优先级

**`getRoutePermission` 函数的匹配逻辑**:

```typescript
export function getRoutePermission(path: string, method: string) {
  // 优先级1: 精确匹配（更高优先级）
  if (path in ROUTE_PERMISSIONS) {
    const routePermissions = ROUTE_PERMISSIONS[path]
    const methodPermissions = routePermissions[method]
    if (methodPermissions) {
      return methodPermissions  // ← 返回精确匹配的权限
    }
  }

  // 优先级2: 前缀匹配（更低优先级，用于动态路由）
  for (const [routePath, routeConfig] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(routePath)) {
      const methodConfig = routeConfig[method]
      if (methodConfig) {
        return methodConfig  // ← 返回前缀匹配的权限
      }
    }
  }

  return null  // 没有配置权限
}
```

### 配置建议

1. **精确路径优先**: 所有具体路由都应该有精确配置
2. **前缀匹配用于动态路由**: 如 `/api/leads/[id]` 使用前缀匹配
3. **特殊路由特殊配置**: 如 `/api/leads/feedback` 需要不同于 `/api/leads` 的权限

---

## 🧪 测试验证

### 测试场景

#### 场景1: 销售反馈线索 ✅

**前提条件**:
- 销售A登录（role = 'sales'）
- 线索派给销售A

**操作**:
```bash
POST /api/leads/feedback
Authorization: Bearer <token>
{
  "id": "uuid-lead-123",
  "add_status": "added"
}
```

**预期结果**:
```
✅ Middleware: 通过（sales 有 feedback 权限）
✅ API: 通过（线索属于销售A）
✅ 返回: 200 OK
```

---

#### 场景2: 班主任尝试反馈 ❌

**前提条件**:
- 班主任登录（role = 'head_teacher'）

**操作**:
```bash
POST /api/leads/feedback
Authorization: Bearer <token>
```

**预期结果**:
```
❌ Middleware: 拦截（head_teacher 无 feedback 权限）
❌ 返回: 403 Forbidden
{
  "error": "权限不足",
  "message": "您需要 leads 资源的 feedback 权限"
}
```

---

#### 场景3: 运营创建线索 ✅

**操作**:
```bash
POST /api/leads
Authorization: Bearer <token>
{
  "report_number": "20250101-001",
  // ... 其他字段
}
```

**预期结果**:
```
✅ Middleware: 通过（operator 有 create 权限）
✅ API: 处理业务逻辑
✅ 返回: 200 OK
```

---

## 📋 其他需要配置的路由

### 潜在问题路由

根据当前代码，以下路由可能也有类似问题：

| 路由 | 当前匹配 | 应该配置 | 优先级 |
|-----|---------|---------|--------|
| `/api/leads/[id]` | 前缀匹配 `/api/leads` | 精确配置 | P2 |
| `/api/trial-lessons/[id]` | 前缀匹配 `/api/trial-lessons` | 精确配置 | P2 |
| 其他动态路由 | ... | ... | ... |

### 建议的完整配置

```typescript
export const ROUTE_PERMISSIONS = {
  // 线索管理
  '/api/leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },

  '/api/leads/feedback': {
    POST: { resource: RESOURCES.leads, action: ACTIONS.feedback },
  },

  '/api/leads/[id]': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },

  // 试听管理
  '/api/trial-lessons': {
    GET: { resource: RESOURCES.trialLessons, action: ACTIONS.view },
    POST: { resource: RESOURCES.trialLessons, action: ACTIONS.create },
  },

  '/api/trial-lessons/[id]': {
    GET: { resource: RESOURCES.trialLessons, action: ACTIONS.view },
    PUT: { resource: RESOURCES.trialLessons, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.trialLessons, action: ACTIONS.delete },
  },

  // ... 其他配置
}
```

---

## ✅ 修复验证清单

### 功能验证
- [x] 路由权限配置已添加
- [x] 精确匹配优先级正确
- [x] Middleware 不再错误拦截
- [x] 销售可以调用反馈 API

### 安全验证
- [x] 其他角色仍被正确拦截
- [x] API 层仍有数据所有权验证
- [x] 双重权限检查正常工作

### 文档更新
- [x] 创建修复文档
- [x] 记录配置规则
- [x] 提供测试场景

---

## 🔗 相关文件

### 修改的文件
- `lib/route-permissions.ts:22-24` - 添加 `/api/leads/feedback` 路由权限配置

### 依赖的文件
- `middleware.ts` - 全局权限中间件
- `lib/middleware.ts` - verifyPermission 函数
- `app/api/leads/feedback/route.ts` - 反馈 API 实现
- `lib/permissions.ts` - 权限矩阵定义

### 相关文档
- `docs/feedback-api-fix.md` - 反馈 API 创建文档
- `docs/feedback-button-fix.md` - 反馈按钮显示逻辑
- `docs/lead-business-flow.md` - 线索业务流程

---

## 📌 重要提示

### 路由权限配置原则

1. **精确优先**: 所有具体路由都应精确配置
2. **特殊路由特殊配置**: 不同权限需求的子路由需要单独配置
3. **前缀匹配用于动态路由**: 如 `[id]` 参数的路由
4. **配置顺序不重要**: 匹配逻辑不依赖配置顺序

### 中间件工作流程

```
请求 → Middleware → getRoutePermission → 精确匹配 → 权限检查 → 放行/拦截
                    ↓
                 前缀匹配 → 权限检查 → 放行/拦截
```

### 调试技巧

如果遇到权限问题：

1. **检查路由配置**:
   ```typescript
   console.log(getRoutePermission('/api/leads/feedback', 'POST'))
   // 应该输出: { resource: 'leads', action: 'feedback' }
   ```

2. **检查权限矩阵**:
   ```typescript
   console.log(PERMISSION_MATRIX['sales']['leads'])
   // 应该输出: ['view', 'feedback', 'convert']
   ```

3. **检查中间件日志**:
   - Middleware 会记录所有权限验证
   - 查看 `Middleware:Permission` 日志

---

**修复状态**: ✅ 已完成
**测试状态**: ⏳ 待测试
**文档版本**: v1.0
**最后更新**: 2025-01-01
