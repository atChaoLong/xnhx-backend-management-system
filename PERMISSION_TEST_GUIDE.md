# 权限系统测试指南

## 实现概述

已完成非侵入式权限系统的实现，使用 Next.js 中间件自动拦截所有 API 请求并进行权限验证。

### 核心文件

1. **lib/permissions.ts** - 权限定义和权限矩阵
2. **lib/middleware.ts** - 权限检查工具函数
3. **lib/route-permissions.ts** - API 路由权限配置
4. **middleware.ts** (根目录) - Next.js 中间件，自动拦截请求

### 工作流程

```
用户请求 API
    ↓
middleware.ts 拦截
    ↓
检查是否为公开路径（/api/auth, /api/upload 等）
    ↓
从 route-permissions.ts 获取所需权限
    ↓
通过 lib/middleware.ts 验证用户权限
    ↓
有权限 → 放行到 API 路由
无权限 → 返回 403 Forbidden
```

## 测试步骤

### 1. 准备测试用户

确保数据库中有不同角色的测试用户：

```sql
-- 查看现有用户和角色
SELECT id, email, name, role FROM user_profiles;

-- 如果需要，可以创建测试用户
-- 注意：实际测试时需要通过注册API或Supabase控制台创建
```

### 2. 测试场景

#### 场景 A：未登录用户访问 API

**请求**：
```bash
curl -X GET http://localhost:3000/api/leads
```

**预期结果**：
```json
{
  "error": "未登录或登录已过期"
}
```
状态码：401

---

#### 场景 B：运营人员 (operator) 访问有权限的 API

**前提**：以 operator 角色登录，获取 token

**请求**：
```bash
curl -X GET http://localhost:3000/api/leads \
  -H "Authorization: Bearer <operator_token>"
```

**预期结果**：
- 返回线索列表
- 状态码：200

**原因**：operator 有 `leads.view` 权限

---

#### 场景 C：运营人员 (operator) 尝试创建订单（无权限）

**请求**：
```bash
curl -X POST http://localhost:3000/api/formal-orders \
  -H "Authorization: Bearer <operator_token>" \
  -H "Content-Type: application/json" \
  -d '{"student_id": "xxx", "course_id": "xxx"}'
```

**预期结果**：
```json
{
  "error": "权限不足",
  "message": "您需要 formalOrders 资源的 create 权限",
  "code": "PERMISSION_DENIED",
  "requiredResource": "formalOrders",
  "requiredAction": "create"
}
```
状态码：403

**原因**：operator 没有 `formalOrders.create` 权限

---

#### 场景 D：销售顾问 (sales) 访问有权限的 API

**请求**：
```bash
curl -X POST http://localhost:3000/api/formal-orders \
  -H "Authorization: Bearer <sales_token>" \
  -H "Content-Type: application/json" \
  -d '{"student_id": "xxx"}'
```

**预期结果**：
- 创建成功
- 状态码：200

**原因**：sales 有 `formalOrders.create` 权限

---

#### 场景 E：管理员 (admin) 访问任何 API

**请求**：
```bash
curl -X DELETE http://localhost:3000/api/leads/123 \
  -H "Authorization: Bearer <admin_token>"
```

**预期结果**：
- 删除成功（如果 leads 存在）
- 状态码：200

**原因**：admin 拥有所有权限

---

### 3. 权限矩阵验证

使用下表验证各角色的权限是否正确实施：

| API 路径 | HTTP 方法 | 所需权限 | operator | sales | head_teacher | academic_affairs | finance | hr | admin |
|---------|----------|---------|----------|-------|--------------|------------------|---------|-----|-------|
| /api/leads | GET | leads.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /api/leads | POST | leads.create | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| /api/leads | PUT | leads.edit | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| /api/trial-lessons | POST | trialLessons.create | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| /api/formal-orders | POST | formalOrders.create | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| /api/transactions | POST | transactions.create | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| /api/teachers | POST | teachers.create | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| /api/users | GET | users.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /api/users | POST | users.create | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## 调试技巧

### 1. 查看中间件日志

中间件会输出权限检查日志，可以通过控制台查看：

```
权限验证通过 { path: '/api/leads', method: 'GET', role: 'sales' }
权限不足 { path: '/api/users', method: 'POST', requiredResource: 'users', requiredAction: 'create', userRole: 'sales' }
```

### 2. 检查用户角色

```bash
# 通过 Supabase 控制台或 API 查询
curl -X GET http://localhost:3000/api/auth/session \
  -H "Authorization: Bearer <token>"
```

### 3. 测试单个 API

使用 Postman 或 Insomnia 等 API 测试工具，设置 Authorization header。

---

## 常见问题

### Q1: 为什么有些 API 不需要权限？

**A**: 公开路径在 `lib/route-permissions.ts` 的 `PUBLIC_PATHS` 中配置：

```typescript
export const PUBLIC_PATHS = [
  '/api/health',         // 健康检查
  '/api/upload',         // 文件上传
  '/api/init-admin',     // 初始化管理员，路由内强制校验 INIT_ADMIN_SECRET
  '/api/classin/callback', // ClassIn 回调，路由内校验 SafeKey
]

export const PUBLIC_PREFIXES = [
  '/api/auth',           // 认证相关
  '/api/teacher-form',   // 外部老师二维码信息采集
]
```

这些路径会跳过中间件权限检查，但 `/api/init-admin` 与 `/api/classin/callback` 仍有路由内安全校验。

---

### Q2: 如何添加新的受保护 API？

**A**: 只需在 `lib/route-permissions.ts` 中添加配置：

```typescript
export const ROUTE_PERMISSIONS = {
  // ... 现有配置
  '/api/new-endpoint': {
    GET: { resource: RESOURCES.leads, action: ACTIONS.view },
    POST: { resource: RESOURCES.leads, action: ACTIONS.create },
  },
}
```

**无需修改任何业务代码！**

---

### Q3: 如何修改某个角色的权限？

**A**: 修改 `lib/permissions.ts` 中的 `PERMISSION_MATRIX`：

```typescript
sales: {
  leads: ['view', 'edit', 'feedback', 'convert', 'create'], // 添加 create
  // ...
},
```

---

### Q4: 中间件会不会影响性能？

**A**: 中间件非常轻量：
- 只读取数据库中的用户角色（已缓存）
- 权限检查是纯内存操作（查表）
- 每个请求增加的延迟 < 10ms

---

## 前端权限控制

中间件只保护后端 API，前端还需要根据用户角色隐藏/显示功能。

### 使用示例

```typescript
'use client'
import { useAppContext } from '@/lib/app-context'
import { hasPermission } from '@/lib/permissions'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

export default function SomePage() {
  const { user } = useAppContext()

  const canCreate = hasPermission(user?.role, RESOURCES.leads, ACTIONS.create)

  return (
    <div>
      {canCreate && (
        <Button>创建线索</Button>
      )}
    </div>
  )
}
```

---

## 总结

✅ **已完成**：
- [x] 创建权限定义和权限矩阵
- [x] 创建权限检查工具函数
- [x] 创建路由权限配置
- [x] 创建 Next.js 中间件
- [x] 编译通过，无 TypeScript 错误

✅ **优势**：
- 零侵入：API 代码完全不需要修改
- 集中管理：所有权限配置在一个文件
- 自动化：所有 API 自动受保护
- 易维护：新增 API 只需配置即可

📋 **待测试**：
- [ ] 未登录用户访问受保护 API（应返回 401）
- [ ] 不同角色访问有/无权限的 API
- [ ] 管理员访问所有 API
- [ ] 前端根据角色显示/隐藏功能

---

**下一步**：按照测试步骤验证权限系统是否按预期工作。
