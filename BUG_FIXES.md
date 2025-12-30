# 编译错误修复总结

## 问题描述

在集成权限系统时遇到了两个编译错误：

### 错误 1: JSX 解析错误
```
Parsing ecmascript source code failed
./lib/hooks/usePermission.ts (183:13)

return <>{children}</>
       ^
```

**原因**：在 `.ts` 文件中使用 JSX 语法，TypeScript 无法解析。

### 错误 2: 导入错误
```
Export useAppContext doesn't exist in target module
./lib/hooks/usePermission.ts (8:1)

import { useAppContext } from '@/lib/app-context'
```

**原因**：`app-context.tsx` 导出的是 `useApp`，不是 `useAppContext`。

## 解决方案

### 修复 1: 分离组件到独立文件

**问题**：
- `lib/hooks/usePermission.ts` 包含 Hook 和组件
- 组件使用 JSX 语法
- `.ts` 文件不支持 JSX

**解决**：
1. 创建新文件 `lib/components/Permission.tsx`
2. 将 `Permission` 和 `PermissionAny` 组件移到新文件
3. 使用 `.tsx` 扩展名以支持 JSX
4. `lib/hooks/usePermission.ts` 只保留 Hook 逻辑

**文件结构**：
```
lib/
├── hooks/
│   └── usePermission.ts        # Hook only (.ts)
├── components/
│   └── Permission.tsx          # Components (.tsx)
```

**导入方式**：
```typescript
// Hook
import { usePermission } from '@/lib/hooks/usePermission'

// 组件
import { Permission, PermissionAny } from '@/lib/components/Permission'
```

### 修复 2: 使用正确的 Hook 名称

**问题**：
- `app-context.tsx` 导出 `useApp`
- `usePermission.ts` 错误地导入 `useAppContext`

**解决**：
```typescript
// 错误
import { useAppContext } from '@/lib/app-context'
const { user } = useAppContext()

// 正确
import { useApp } from '@/lib/app-context'
const { user } = useApp()
```

## 提交记录

1. **db678ea** - 修复 usePermission.ts 缺少 React import
   - 添加 `import React from 'react'`
   - 但这没有解决根本问题

2. **7c792b3** - 修复权限组件编译错误，分离Hook和组件 ✅
   - 创建 `lib/components/Permission.tsx`
   - 移除组件从 Hook 文件
   - 更新文档中的导入路径

3. **89ab0f6** - 修复 useAppContext 导入错误，改为 useApp ✅
   - 修改导入名称
   - 更新函数调用

## 技术要点

### .ts vs .tsx 文件

| 文件类型 | 支持 JSX | 用途 |
|---------|---------|------|
| `.ts` | ❌ | 纯 TypeScript 逻辑 |
| `.tsx` | ✅ | 包含 React 组件的 TypeScript |

**规则**：
- Hook 和工具函数 → `.ts`
- React 组件 → `.tsx`

### Next.js 文件约定

**客户端组件**：
```typescript
'use client'  // 必须在第一行

import { useApp } from '@/lib/app-context'

export function MyComponent() {
  // ...
}
```

**导入顺序**：
1. React 相关
2. 第三方库
3. 项目内部导入（@/ 别名）

## 最终代码结构

### lib/hooks/usePermission.ts
```typescript
'use client'

import { useApp } from '@/lib/app-context'
import { hasPermission, hasAnyPermission, getPermissions } from '@/lib/permissions'
import { RESOURCES, ACTIONS, Role, Resource, Action } from '@/lib/permissions'

export function usePermission() {
  const { user } = useApp()
  const role = user?.role as Role | undefined

  const checkPermission = (resource: Resource, action: Action): boolean => {
    return hasPermission(role, resource, action)
  }

  // ... 其他方法

  return {
    user,
    role,
    checkPermission,
    // ... 快捷方法
  }
}
```

### lib/components/Permission.tsx
```typescript
'use client'

import React from 'react'
import { usePermission } from '@/lib/hooks/usePermission'
import { Resource, Action } from '@/lib/permissions'

export function Permission({ resource, action, fallback, children }: PermissionProps) {
  const { checkPermission } = usePermission()

  if (checkPermission(resource, action)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
```

## 使用示例

### 在页面中使用 Hook

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'

export default function LeadsPage() {
  const { leads } = usePermission()

  return (
    <div>
      {leads.create() && <Button>新增线索</Button>}
    </div>
  )
}
```

### 在页面中使用组件

```typescript
'use client'
import { Permission } from '@/lib/components/Permission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

export default function LeadsPage() {
  return (
    <div>
      <Permission resource={RESOURCES.leads} action={ACTIONS.create}>
        <Button>新增线索</Button>
      </Permission>
    </div>
  )
}
```

## 验证方法

### 1. 检查编译
```bash
npm run build
```

### 2. 检查类型检查
```bash
npx tsc --noEmit
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 访问页面测试
```
http://localhost:3000/dashboard/leads
```

## 经验总结

### ✅ 正确做法

1. **分离关注点**
   - Hook 放在 `.ts` 文件
   - 组件放在 `.tsx` 文件

2. **使用正确的导入**
   - 检查源文件导出的名称
   - 不要假设导入名称

3. **遵循约定**
   - 客户端组件需要 `'use client'` 指令
   - 使用项目别名 `@/` 导入

### ❌ 避免的错误

1. **在 .ts 文件中使用 JSX**
   ```typescript
   // ❌ 错误：lib/utils.ts
   export function Component() {
     return <div>Hello</div>
   }

   // ✅ 正确：lib/utils.tsx
   export function Component() {
     return <div>Hello</div>
   }
   ```

2. **错误的导入名称**
   ```typescript
   // ❌ 错误
   import { useAppContext } from '@/lib/app-context'

   // ✅ 正确
   import { useApp } from '@/lib/app-context'
   ```

3. **忘记 'use client' 指令**
   ```typescript
   // ❌ 错误：缺少指令
   import { useApp } from '@/lib/app-context'

   // ✅ 正确：添加指令
   'use client'
   import { useApp } from '@/lib/app-context'
   ```

## 相关文档

- Next.js 文档：https://nextjs.org/docs/app/building-your-application/rendering/client-components
- TypeScript JSX：https://www.typescriptlang.org/docs/handbook/jsx.html
- 项目结构：`INTEGRATION_PROGRESS.md`

---

**修复时间**：2025-12-30
**影响范围**：权限控制系统
**状态**：✅ 已完全修复
**最后提交**：89ab0f6
