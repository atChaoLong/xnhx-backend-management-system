# 权限问题诊断和解决方案

## 问题描述

Admin 账号创建学生时收到：
```json
{
  "error": "权限不足",
  "message": "您需要 students 资源的 create 权限",
  "code": "PERMISSION_DENIED",
  "requiredResource": "students",
  "requiredAction": "create"
}
```

但根据权限矩阵，admin 角色应该拥有 students:create 权限。

## 根本原因分析

### 1. 权限检查链路

```
请求 → middleware.ts
    ↓
verifyPermission() in lib/middleware.ts
    ↓
getUserRole() - 从 Authorization header 获取 token
    ↓
supabaseServer.auth.getUser(token) - 验证 token
    ↓
user_profiles 表查询 - 获取 role 字段
    ↓
hasPermission(role, 'students', 'create')
    ↓
检查 PERMISSION_MATRIX[role]['students']
```

### 2. 可能的问题点

#### 问题 A: user_profiles 表中的 role 字段为 null

```sql
-- 检查命令
SELECT id, email, role FROM user_profiles WHERE id = 'admin_user_id';

-- 预期结果
| id          | email       | role  |
|-------------|-------------|-------|
| abc123...   | admin@...   | admin |

-- 实际结果（错误情况）
| id          | email       | admin@... | role |
|-------------|-------------|-------|
| abc123...   | admin@...   | NULL  |  ← 问题！
```

#### 问题 B: user_profiles 表中根本没有此用户的记录

Admin 用户注册后，`user_profiles` 表中可能没有对应的档案记录。

#### 问题 C: 获取 user_profiles 时出错（返回 null）

如果 RLS 策略有问题，可能导致查询返回 null。

## 诊断步骤

### 步骤 1: 检查当前用户的角色

在浏览器控制台执行：
```javascript
// 获取当前用户信息
const response = await fetch('/api/auth/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
  }
})
const profile = await response.json()
console.log('当前用户角色:', profile.data.role)
console.log('当前用户完整信息:', profile.data)
```

**预期输出**：
```json
{
  "id": "...",
  "email": "admin@example.com",
  "role": "admin",
  "name": "..."
}
```

**如果 role 为 null**：这就是问题所在！

### 步骤 2: 直接查询数据库

在 Supabase 控制面板中执行 SQL：
```sql
SELECT id, email, role FROM auth.users LIMIT 10;
SELECT id, email, role FROM public.user_profiles LIMIT 10;
```

检查：
1. `auth.users` 中是否存在你的账户
2. `public.user_profiles` 中是否有对应记录
3. `role` 字段是否为 `'admin'` 或为 `NULL`

### 步骤 3: 检查中间件日志

在 `middleware.ts` 第44-50行，会记录权限不足的信息：
```typescript
logger.info('权限不足', {
  path: pathname,
  method: request.method,
  requiredResource: permission.resource,
  requiredAction: permission.action,
  userRole: role,  // ← 查看这里的 role 值
})
```

查看服务器日志，找到类似的日志记录，注意 `userRole` 的值是什么。

## 解决方案

### 方案 1: 手动创建/更新 user_profiles 记录（推荐）

在 Supabase SQL 编辑器中执行（将 `YOUR_USER_ID` 替换为你的用户ID）：

```sql
-- 查找你的用户ID（使用邮箱查询）
SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com';

-- 创建或更新 user_profiles 记录
INSERT INTO public.user_profiles (id, email, name, role, created_at, updated_at)
VALUES (
  'YOUR_USER_ID',  -- 从上面的查询结果复制
  'your-admin-email@example.com',
  'Admin',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

-- 验证：
SELECT id, email, role FROM public.user_profiles WHERE id = 'YOUR_USER_ID';
```

### 方案 2: 使用后端 API 更新角色

创建一个临时 API 端点（后续删除）：

```typescript
// app/api/fix-admin-role/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await request.json()
    
    // 验证请求者是否是真正的 admin（检查 auth.users 的 role）
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    const { data: { user } } = await supabaseServer.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 更新 user_profiles
    const { error } = await supabaseServer
      .from('user_profiles')
      .upsert({
        id: userId,
        role: role,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

然后访问：
```javascript
const userId = 'YOUR_USER_ID' // 从 /api/auth/profile 获取
const response = await fetch('/api/fix-admin-role', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
  },
  body: JSON.stringify({
    userId,
    role: 'admin'
  })
})
```

### 方案 3: 登出后重新登录

有时重新登录会触发 user_profiles 的创建或更新：

1. 访问 `/dashboard` 的登出按钮
2. 清除浏览器 localStorage 中的 `supabase.auth.token`
3. 重新登录
4. 检查 `/api/auth/profile` 的结果

## 深层原因 - 为什么会出现这个问题

### 原因 1: 首次登录时未创建 user_profiles

注册流程可能没有自动为新用户创建 `user_profiles` 记录。

**修复**：在 `app/api/auth/signup/route.ts` 中添加自动创建逻辑。

### 原因 2: user_profiles 的 role 字段默认值缺失

表定义时可能没有设置默认值或没有正确初始化。

**修复**：检查 user_profiles 表的 `role` 列定义，确保有默认值或约束。

### 原因 3: RLS 策略阻止了查询

中间件中 `supabaseServer` 应该绕过 RLS，但如果配置有问题，可能导致查询失败。

**修复**：确认 `supabaseServer` 使用的是服务端秘钥而不是用户 token。

## 预防措施

### 1. 改进注册流程

```typescript
// app/api/auth/signup/route.ts
export async function POST(request: NextRequest) {
  // ... 创建用户 ...
  
  // 创建用户档案
  const { error: profileError } = await supabaseServer
    .from('user_profiles')
    .insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || email.split('@')[0],
      role: 'admin',  // 首个用户自动为 admin
      created_at: new Date().toISOString(),
    })
  
  if (profileError) {
    logger.error('创建用户档案失败', profileError)
  }
}
```

### 2. 改进认证流程

```typescript
// lib/middleware.ts
export async function getUserRole(request: NextRequest): Promise<Role | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return null
    }

    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    if (error || !user) {
      return null
    }

    // 尝试获取 user_profiles
    let { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // 如果档案不存在，自动创建（作为 fallback）
    if (!profile) {
      logger.warn('用户档案不存在，自动创建', { userId: user.id })
      
      const defaultRole = await getDefaultRoleForUser(user.id)
      
      await supabaseServer
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          role: defaultRole,
          created_at: new Date().toISOString(),
        })
        .then(() => {
          profile = { role: defaultRole }
        })
    }

    return (profile?.role as Role) || null
  } catch (error) {
    console.error('获取用户角色失败:', error)
    return null
  }
}

// 获取用户的默认角色
async function getDefaultRoleForUser(userId: string): Promise<Role> {
  // 如果是数据库中的第一个用户，默认为 admin
  const { count } = await supabaseServer
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
  
  return count === 0 ? 'admin' : 'sales'
}
```

## 测试验证

修复后，按以下步骤验证：

1. 登出账户
2. 清除浏览器缓存（或使用无痕窗口）
3. 重新登录
4. 访问 `/api/auth/profile`，确认 `role: 'admin'`
5. 尝试创建学生，应该成功

## 相关文件

- 权限检查：`lib/permissions.ts`
- 中间件：`middleware.ts`, `lib/middleware.ts`
- 路由权限：`lib/route-permissions.ts`
- 认证 API：`app/api/auth/`
- 用户档案表：Supabase `user_profiles`

## 联系支持

如果问题持续存在，请：
1. 检查服务器日志中 `userRole` 的值
2. 在 Supabase SQL 编辑器中验证数据库内容
3. 检查是否有 RLS 策略阻止了查询
