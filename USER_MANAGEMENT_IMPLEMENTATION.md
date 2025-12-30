# 用户角色管理系统

## 功能概述

实现了完整的用户角色管理系统，允许超级管理员创建和管理不同角色的用户账号。

## 核心功能

### 1. 角色类型

- **admin** - 超级管理员，拥有所有权限
- **sales** - 销售顾问，负责线索跟进和转化
- **operations** - 运营人员，负责日常运营管理
- **academic** - 教务管理，负责教务安排和教师管理
- **finance** - 财务人员，负责财务管理

### 2. API 接口

#### 初始化超级管理员
```
POST /api/init-admin
```
- 系统第一次使用时创建超级管理员
- 只能在没有 admin 用户时调用
- 自动检查并清理可能冲突的 profile

#### 用户管理
```
GET    /api/users     - 获取用户列表（需要 admin 权限）
POST   /api/users     - 创建新用户（需要 admin 权限）
PUT    /api/users     - 更新用户信息（需要 admin 权限）
DELETE /api/users?id= - 删除用户（需要 admin 权限）
```

#### 清理工具
```
POST /api/cleanup-all-admins
```
- 删除所有 admin 角色
- 用于重置系统

### 3. 前端页面

- `/dashboard/accounts` - 用户列表页面
- `/dashboard/accounts/new` - 创建用户页面
- `/dashboard/accounts/[id]/edit` - 编辑用户页面

## 技术实现

### 数据库设计

#### user_profiles 表结构
```sql
- id              UUID  (主键，直接对应 auth.users.id)
- username        TEXT  (用户名，必填)
- name            TEXT  (姓名)
- email           TEXT  (邮箱)
- role            TEXT  (角色：admin, sales, operations, academic, finance)
- phone           TEXT  (手机号)
- wechat          TEXT  (微信号)
- team_name       TEXT  (团队名称)
- is_active       BOOLEAN (是否启用)
- created_at      TIMESTAMPTZ
- updated_at      TIMESTAMPTZ
```

**设计特点**：
- `id` 直接等于 `auth.users.id`，无需额外的 `user_id` 字段
- 简化了 JOIN 查询，提高性能
- 使用 `role` 字段而非独立的角色表，简化设计

### 关键修复

#### RLS (Row Level Security) 问题

**问题**：创建用户时，新用户还没有 profile，RLS 策略会拒绝插入 user_profiles

**解决方案**：
1. 先尝试使用 `supabaseServer` 插入
2. 如果失败（RLS 拒绝），自动回退到 `supabaseAdmin`（绕过 RLS）
3. 插入前先检查并删除可能存在的旧 profile

**代码示例**：
```typescript
// 1. 检查并清理可能存在的旧 profile
const { data: existingProfile } = await supabaseAdmin
  .from('user_profiles')
  .select('id')
  .eq('id', user.id)
  .single()

if (existingProfile) {
  await supabaseAdmin.from('user_profiles').delete().eq('id', user.id)
}

// 2. 使用 supabaseAdmin 创建 profile（绕过 RLS）
const { error } = await supabaseAdmin
  .from('user_profiles')
  .insert({ id: user.id, ... })
```

### 文件结构

#### API 层
```
app/api/
├── init-admin/route.ts           # 初始化超级管理员
├── users/route.ts                # 用户 CRUD 操作
└── cleanup-all-admins/route.ts   # 清理所有 admin（工具）
```

#### 服务层
```
lib/services/users.ts             # 用户服务和类型定义
```

#### 类型定义
```typescript
interface UserProfile {
  id: string
  username: string
  name: string
  role: string
  email?: string
  phone?: string
  wechat?: string
  team_name?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
```

#### 页面
```
app/dashboard/accounts/
├── page.tsx           # 用户列表
├── new/page.tsx       # 创建用户
└── [id]/edit/page.tsx # 编辑用户
```

#### 数据库迁移
```
supabase/migrations/
└── 028_fix_user_profiles_rls.sql  # RLS 策略修复
```

## 使用说明

### 1. 初始化超级管理员

```bash
curl -X POST http://localhost:3000/api/init-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123456",
    "full_name": "超级管理员"
  }'
```

### 2. 创建普通用户

通过 `/dashboard/accounts/new` 页面或调用 API：

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "sales@example.com",
    "password": "password123",
    "role": "sales",
    "name": "销售顾问"
  }'
```

### 3. 查看用户列表

访问 `/dashboard/accounts` 页面（需要 admin 权限）

## 安全注意事项

1. ✅ **RLS 策略**：已配置正确的 Row Level Security
   - 所有认证用户可查看用户列表
   - 只有 admin 可以创建/更新/删除用户

2. ✅ **权限验证**：所有修改操作都验证 admin 权限

3. ⚠️ **初始化接口**：`/api/init-admin` 应在使用后删除或禁用

4. ⚠️ **清理接口**：`/api/cleanup-all-admins` 仅用于开发/重置

## 常见问题

### Q: 为什么 user_profiles 的 id 直接等于 auth.users.id？
A: 这样设计简化了查询，无需额外的 JOIN，提高性能。这是 Supabase 推荐的最佳实践。

### Q: 创建用户时为什么会失败？
A: 可能的原因：
1. 邮箱已被注册
2. RLS 策略配置不当
3. 数据库约束冲突

代码已自动处理 RLS 问题，会自动回退到 `supabaseAdmin`。

### Q: 如何重置系统？
A: 调用 `/api/cleanup-all-admins` 删除所有 admin，然后重新初始化。

## 开发日志

### 已解决的问题

1. ✅ Module import error - 替换为 `@/lib/supabase`
2. ✅ Foreign key constraint error - 适配线上表结构
3. ✅ Username NOT NULL constraint - 添加 `username` 字段
4. ✅ RLS 权限问题 - 使用 `supabaseAdmin` 绕过
5. ✅ 主键冲突 - 插入前清理旧记录

### 数据库适配

- ✅ 线上表使用 `id = auth.users.id` 设计
- ✅ 无需修改线上表结构
- ✅ 代码完全适配线上环境

## 相关文档

- Supabase Auth: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
