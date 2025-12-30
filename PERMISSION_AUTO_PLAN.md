# 权限系统自动化实施方案

## 方案一：API路由自动权限保护（推荐）

### 创建一个通用权限包装器

```typescript
// lib/api-wrapper.ts
import { NextRequest } from 'next/server'
import { checkPermission } from './middleware'
import { RESOURCES, ACTIONS, Role } from './permissions'

/**
 * API路由权限装饰器
 * 自动为API添加权限检查
 */
export function withPermission(
  resource: keyof typeof RESOURCES,
  action: keyof typeof ACTIONS
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      return checkPermission(request, RESOURCES[resource], ACTIONS[action], async () => {
        return originalMethod.apply(this, [request, ...args])
      })
    }

    return descriptor
  }
}

/**
 * API路由包装函数（更简单的方式）
 */
export function apiRoute(
  resource: keyof typeof RESOURCES,
  action: keyof typeof ACTIONS
) {
  return function (handler: (request: NextRequest) => Promise<Response>) {
    return async function (request: NextRequest) {
      return checkPermission(request, RESOURCES[resource], ACTIONS[action], async () => {
        return handler(request)
      })
    }
  }
}
```

### 使用方式

#### 方式1：包装整个路由文件（最简单）

```typescript
// app/api/leads/route.ts
import { apiRoute } from '@/lib/api-wrapper'
import { RESOURCES, ACTIONS } from '@/lib/permissions'
import { supabaseServer } from '@/lib/supabase'

// GET 获取线索列表
export const GET = apiRoute('leads', 'view')(async (request) => {
  const { data } = await supabaseServer
    .from('leads')
    .select('*')

  return Response.json({ data })
})

// POST 创建线索
export const POST = apiRoute('leads', 'create')(async (request) => {
  const body = await request.json()
  const { data } = await supabaseServer
    .from('leads')
    .insert(body)

  return Response.json({ data })
})

// PUT 更新线索
export const PUT = apiRoute('leads', 'edit')(async (request) => {
  const body = await request.json()
  const { data } = await supabaseServer
    .from('leads')
    .update(body)

  return Response.json({ data })
})

// DELETE 删除线索
export const DELETE = apiRoute('leads', 'delete')(async (request) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const { error } = await supabaseServer
    .from('leads')
    .delete()
    .eq('id', id)

  return Response.json({ success: !error })
})
```

#### 方式2：使用高阶函数（如果不想改导出方式）

```typescript
// app/api/leads/route.ts
import { protectAPI } from '@/lib/api-wrapper'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  return protectAPI(RESOURCES.leads, ACTIONS.view, async () => {
    // 业务逻辑
  })
}

export async function POST(request: NextRequest) {
  return protectAPI(RESOURCES.leads, ACTIONS.create, async () => {
    // 业务逻辑
  })
}
```

---

## 方案二：Next.js中间件（全局权限）

### 创建Next.js中间件

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyPermission } from '@/lib/middleware'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

export async function middleware(request: NextRequest) {
  // 跳过公开路由
  if (request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // API路由自动权限检查
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // 从URL路径提取资源和操作
    const [, , resourceName, ...rest] = request.nextUrl.pathname.split('/')
    const method = request.method

    // 映射HTTP方法到操作
    const actionMap: Record<string, keyof typeof ACTIONS> = {
      'GET': 'view',
      'POST': 'create',
      'PUT': 'edit',
      'DELETE': 'delete',
    }

    const action = actionMap[method]
    const resource = RESOURCES[resourceName as keyof typeof RESOURCES]

    if (resource && action) {
      const { hasPermission } = await verifyPermission(request, resource, action)

      if (!hasPermission) {
        return NextResponse.json(
          { error: '权限不足' },
          { status: 403 }
        )
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

**优点**：完全自动化，所有API自动受保护
**缺点**：所有API使用相同的权限规则（GET=view, POST=create等），不够灵活

---

## 方案三：配置化权限（最灵活）

### 创建权限配置文件

```typescript
// lib/api-permissions.config.ts
import { RESOURCES, ACTIONS } from './permissions'

export const API_PERMISSIONS = {
  // 线索API权限
  '/api/leads': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
    PUT: { resource: RESOURCES.leads, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.leads, action: ACTIONS.delete },
  },

  // 试听API权限
  '/api/trial-lessons': {
    GET: { resource: RESOURCES.trialLessons, action: ACTIONS.view },
    POST: { resource: RESOURCES.trialLessons, action: ACTIONS.create },
    PUT: { resource: RESOURCES.trialLessons, action: ACTIONS.edit },
    DELETE: { resource: RESOURCES.trialLessons, action: ACTIONS.delete },
  },

  // 更多API...
} as const
```

### 使用配置自动检查权限

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { API_PERMISSIONS } from '@/lib/api-permissions.config'
import { checkPermission } from '@/lib/middleware'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method

  // 查找匹配的权限配置
  const permissionConfig = Object.entries(API_PERMISSIONS).find(([path]) =>
    pathname.startsWith(path)
  )

  if (permissionConfig) {
    const [, pathConfig] = permissionConfig
    const methodConfig = pathConfig[method as keyof typeof pathConfig]

    if (methodConfig) {
      // 检查权限
      return checkPermission(request, methodConfig.resource, methodConfig.action, async () => {
        return NextResponse.next()
      })
    }
  }

  return NextResponse.next()
}
```

**优点**：集中配置，易于管理
**缺点**：需要维护配置文件

---

## 推荐方案

### 👍 方案一（API路由包装）- 最推荐

**理由**：
1. **简单直观**：每个API明确声明所需权限
2. **类型安全**：TypeScript编译时检查
3. **灵活**：不同API可以有不同权限
4. **不侵入**：业务逻辑和权限分离

### 使用步骤

1. 创建 `lib/api-wrapper.ts`
2. 在每个API路由文件中使用 `apiRoute()` 包装导出函数
3. 完成！所有API自动受保护

**示例**：
```typescript
// 一行代码就能保护API
export const POST = apiRoute('leads', 'create')(async (request) => {
  // 你的业务逻辑
})
```

这样你只需要：
1. 在创建新API时用 `apiRoute()` 包装
2. 不需要手动写权限检查代码
3. 所有权限自动生效

需要我帮你实现这个方案吗？
