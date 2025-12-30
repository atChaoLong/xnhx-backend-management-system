# 非侵入式权限系统设计

## 核心思路：不修改任何业务代码

### 方案：Next.js中间件 + 路由元数据

完全不需要修改API代码，权限检查在中间件层自动完成。

---

## 实现步骤

### 1. 定义路由权限配置（集中管理）

```typescript
// lib/route-permissions.ts
import { RESOURCES, ACTIONS } from './permissions'

/**
 * API路由权限映射表
 * 路径 -> HTTP方法 -> 资源 + 操作
 */
export const ROUTE_PERMISSIONS = {
  '/api/leads': {
    GET: { resource: 'leads', action: 'view' },
    POST: { resource: 'leads', action: 'create' },
    PUT: { resource: 'leads', action: 'edit' },
    DELETE: { resource: 'leads', action: 'delete' },
  },
  '/api/trial-lessons': {
    GET: { resource: 'trialLessons', action: 'view' },
    POST: { resource: 'trialLessons', action: 'create' },
    PUT: { resource: 'trialLessons', action: 'edit' },
    DELETE: { resource: 'trialLessons', action: 'delete' },
  },
  '/api/students': {
    GET: { resource: 'students', action: 'view' },
    POST: { resource: 'students', action: 'create' },
    PUT: { resource: 'students', action: 'edit' },
    DELETE: { resource: 'students', action: 'delete' },
  },
  '/api/formal-orders': {
    GET: { resource: 'formalOrders', action: 'view' },
    POST: { resource: 'formalOrders', action: 'create' },
    PUT: { resource: 'formalOrders', action: 'edit' },
    DELETE: { resource: 'formalOrders', action: 'delete' },
  },
  '/api/transactions': {
    GET: { resource: 'transactions', action: 'view' },
    POST: { resource: 'transactions', action: 'create' },
    PUT: { resource: 'transactions', action: 'edit' },
    DELETE: { resource: 'transactions', action: 'delete' },
  },
  '/api/teacher-candidates': {
    GET: { resource: 'teacherCandidates', action: 'view' },
    POST: { resource: 'teacherCandidates', action: 'create' },
    PUT: { resource: 'teacherCandidates', action: 'edit' },
    DELETE: { resource: 'teacherCandidates', action: 'delete' },
  },
  '/api/teachers': {
    GET: { resource: 'teachers', action: 'view' },
    POST: { resource: 'teachers', action: 'create' },
    PUT: { resource: 'teachers', action: 'edit' },
    DELETE: { resource: 'teachers', action: 'delete' },
  },
  '/api/dictionaries': {
    GET: { resource: 'dictionaries', action: 'view' },
    POST: { resource: 'dictionaries', action: 'create' },
    PUT: { resource: 'dictionaries', action: 'edit' },
    DELETE: { resource: 'dictionaries', action: 'delete' },
  },
  '/api/users': {
    GET: { resource: 'users', action: 'view' },
    POST: { resource: 'users', action: 'create' },
    PUT: { resource: 'users', action: 'edit' },
    DELETE: { resource: 'users', action: 'delete' },
  },
} as const

/**
 * 获取路由的权限要求
 */
export function getRoutePermission(path: string, method: string) {
  // 精确匹配
  if (path in ROUTE_PERMISSIONS) {
    const routePermissions = ROUTE_PERMISSIONS[path as keyof typeof ROUTE_PERMISSIONS]
    const methodPermissions = routePermissions[method as keyof typeof routePermissions]
    if (methodPermissions) {
      return methodPermissions
    }
  }

  // 前缀匹配（用于动态路由）
  for (const [routePath, routeConfig] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(routePath)) {
      const methodConfig = routeConfig[method as keyof typeof routeConfig]
      if (methodConfig) {
        return methodConfig
      }
    }
  }

  return null
}
```

### 2. 创建Next.js中间件（自动权限检查）

```typescript
// middleware.ts (项目根目录)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyPermission } from '@/lib/middleware'
import { getRoutePermission } from '@/lib/route-permissions'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. 跳过非API路由和公开路由
  if (!pathname.startsWith('/api/') ||
      pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/api/upload')) {
    return NextResponse.next()
  }

  // 2. 获取路由的权限要求
  const permission = getRoutePermission(pathname, request.method)

  if (!permission) {
    // 没有配置权限，放行（或者你可以选择拒绝）
    console.warn(`未配置权限: ${pathname} ${request.method}`)
    return NextResponse.next()
  }

  // 3. 检查用户权限
  const { hasPermission: authorized } = await verifyPermission(
    request,
    permission.resource as any,
    permission.action as any
  )

  if (!authorized) {
    return NextResponse.json(
      {
        error: '权限不足',
        message: `您需要 ${permission.resource} 资源的 ${permission.action} 权限`,
        code: 'PERMISSION_DENIED'
      },
      { status: 403 }
    )
  }

  // 4. 权限验证通过，放行
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

### 3. API代码完全不需要修改！

```typescript
// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

// GET: 获取所有线索
export async function GET(request: NextRequest) {
  // ✅ 不需要任何权限检查代码！
  const { data, error } = await supabaseServer
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

// POST: 创建新线索
export async function POST(request: NextRequest) {
  // ✅ 不需要任何权限检查代码！
  const body = await request.json()

  const { data, error } = await supabaseServer
    .from('leads')
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

// PUT: 更新线索
export async function PUT(request: NextRequest) {
  // ✅ 不需要任何权限检查代码！
  const body = await request.json()

  const { data, error } = await supabaseServer
    .from('leads')
    .update(body)
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
```

---

## 优点总结

### ✅ 零侵入
- API代码完全不需要修改
- 业务逻辑和权限完全分离

### ✅ 集中管理
- 所有权限配置在一个文件中
- 修改权限不需要改业务代码

### ✅ 易于维护
- 新增API只需在配置文件中添加一行
- 权限规则一目了然

### ✅ 灵活
- 可以针对不同路由设置不同权限
- 支持精确匹配和前缀匹配

### ✅ 自动化
- 所有API自动受保护
- 不会遗漏任何接口

---

## 使用流程

1. **创建权限配置文件** `lib/route-permissions.ts`
2. **创建中间件** `middleware.ts`
3. **完成！** 所有API自动受保护

以后新增API时，只需要：
1. 编写API代码（不需要任何权限相关代码）
2. 在 `route-permissions.ts` 中添加一行配置
3. 自动受保护

---

## 特殊权限处理

### 需要多个权限的操作（如：销售可以创建，班主任也可以创建）

```typescript
// lib/route-permissions.ts
export const ROUTE_PERMISSIONS = {
  '/api/students': {
    GET: { resource: 'students', action: 'view' },
    POST: {
      resource: 'students',
      action: 'create',
      // 允许的角色（可选，覆盖默认权限矩阵）
      allowedRoles: ['sales', 'head_teacher']
    },
    PUT: { resource: 'students', action: 'edit' },
    DELETE: {
      resource: 'students',
      action: 'delete',
      allowedRoles: ['admin'] // 只有管理员能删除
    },
  },
}
```

### 动态路由（如 `/api/users/:id`）

```typescript
// lib/route-permissions.ts
export const ROUTE_PERMISSIONS = {
  '/api/users': {
    GET: { resource: 'users', action: 'view' },
    POST: { resource: 'users', action: 'create' },
    // PUT和DELETE会自动匹配 /api/users/:id
    PUT: { resource: 'users', action: 'edit' },
    DELETE: { resource: 'users', action: 'delete' },
  },
}
```

前缀匹配会自动处理所有子路径。

---

这就是完全非侵入式的方案！需要我帮你实现吗？
