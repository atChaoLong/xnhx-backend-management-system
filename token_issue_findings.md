# Token 失效问题排查发现

## 问题根因确认

### 问题 1：Next.js 中间件使用 `verifyPermission` 丢失认证状态

**位置**：`/middleware.ts` (根目录)

**问题描述**：
```typescript
// 当前代码
const { hasPermission: authorized, role } = await verifyPermission(
  request,
  permission.resource,
  permission.action
)

if (!authorized) {
  return NextResponse.json({
    error: '权限不足',
    status: 403  // ❌ 错误：token 过期时也返回 403
  })
}
```

**根因分析**：
1. `verifyPermission` 返回 `{ hasPermission: boolean, role }`
2. 当 token 过期时，`getUserRole` 返回 `null`
3. `hasPermission(null, resource, action)` 返回 `false`
4. 中间件无法区分"无权限"和"未认证"，统一返回 403

**影响范围**：
- 所有经过 Next.js 中间件的 API 请求
- 不使用 `checkPermission` 的路由
- 前端无法根据状态码判断是否需要重新登录

---

### 问题 2：`getUserRole` 丢失认证状态信息

**位置**：`lib/middleware.ts`

**当前实现**：
```typescript
export async function getUserRole(request: NextRequest): Promise<Role | null> {
  const result = await authenticateUser(request)
  return result.role || null  // ❌ 丢失了 AuthStatus
}
```

**问题**：
- `authenticateUser` 返回 `{ status, role, userId }`
- `getUserRole` 只提取 `role`，丢弃了 `status`
- 调用者无法知道是 NO_TOKEN、EXPIRED_TOKEN 还是 INVALID_TOKEN

---

### 问题 3：中间件层缺少 401 处理逻辑

**当前行为**：
```
Token 过期
  ↓
getUserRole() 返回 null
  ↓
hasPermission(null, ...) 返回 false
  ↓
返回 403 "权限不足"  ❌
```

**正确行为应该是**：
```
Token 过期
  ↓
authenticateUser() 返回 EXPIRED_TOKEN
  ↓
返回 401 "登录已过期"  ✅
```

---

## 解决方案

### 方案 1：修改 `verifyPermission` 返回认证状态（推荐）

**改动**：
```typescript
export async function verifyPermission(
  request: NextRequest,
  resource: Resource,
  action: Action
): Promise<{
  hasPermission: boolean
  role: Role | null
  authStatus: AuthStatus  // 新增
}> {
  const authResult = await authenticateUser(request)
  return {
    hasPermission: hasPermission(authResult.role, resource, action),
    role: authResult.role,
    authStatus: authResult.status  // 返回完整状态
  }
}
```

**配合修改**：`middleware.ts`
```typescript
const { hasPermission: authorized, role, authStatus } = await verifyPermission(...)

if (authStatus !== 'authenticated') {
  // 根据 authStatus 返回不同的错误
  if (authStatus === 'expired_token') {
    return NextResponse.json({
      error: '登录已过期，请重新登录'
    }, { status: 401 })
  }
  if (authStatus === 'no_token') {
    return NextResponse.json({
      error: '未登录或登录已过期'
    }, { status: 401 })
  }
  return NextResponse.json({
    error: '登录信息无效，请重新登录'
  }, { status: 401 })
}

if (!authorized) {
  // 真正的权限不足
  return NextResponse.json({
    error: '权限不足'
  }, { status: 403 })
}
```

---

### 方案 2：让中间件直接使用 `authenticateUser`

**改动**：
```typescript
// middleware.ts
import { authenticateUser, AuthStatus } from '@/lib/middleware'

export async function middleware(request: NextRequest) {
  // ...

  // 1. 先检查认证状态
  const authResult = await authenticateUser(request)

  // 2. 处理认证失败
  if (authResult.status !== AuthStatus.AUTHENTICATED) {
    if (authResult.status === AuthStatus.EXPIRED_TOKEN) {
      return NextResponse.json({
        error: '登录已过期，请重新登录'
      }, { status: 401 })
    }
    // ... 其他认证状态
  }

  // 3. 再检查权限
  if (!hasPermission(authResult.role, permission.resource, permission.action)) {
    return NextResponse.json({
      error: '权限不足'
    }, { status: 403 })
  }

  // ...
}
```

---

## 推荐方案

**方案 1**（修改 `verifyPermission`）
- 优点：向后兼容性好，改动集中
- 缺点：需要修改返回值类型

**方案 2**（直接使用 `authenticateUser`）
- 优点：逻辑清晰，直接使用完整认证信息
- 缺点：中间件代码改动较多

**建议采用方案 2**，因为：
1. 更直接，逻辑更清晰
2. 不需要维护多层封装
3. 中间件是请求的第一道关卡，应该先检查认证再检查权限

---

## 待完成任务

- [ ] 实现推荐的解决方案
- [ ] 更新中间件代码
- [ ] 测试各种 token 失效场景
- [ ] 验证前端错误处理
- [ ] 更新文档

---

**发现时间**：2025-01-13
**状态**：根因已确认，待实施修复
