# 修复 `user is not defined` 错误

**错误时间**: 2025-01-01
**错误位置**: `app/dashboard/leads/page.tsx:307`

---

## ❌ 错误信息

```
user is not defined
app/dashboard/leads/page.tsx (307:76)
```

## 🔍 错误原因

在添加权限检查时使用了 `user?.id`，但没有从 `usePermission` hook中解构 `user` 变量。

**错误代码** (line 28):
```typescript
const { leads: leadsPerm } = usePermission()  // ❌ 缺少 user
```

**使用位置** (line 307):
```typescript
{leadsPerm.feedback() && lead.grab_user_id === user?.id && (
  // ❌ user 未定义
)}
```

---

## ✅ 修复方案

从 `usePermission` hook中解构 `user` 对象。

**修复代码** (line 28):
```typescript
const { leads: leadsPerm, user } = usePermission()  // ✅ 添加 user
```

---

## 📝 说明

`usePermission` hook 返回对象包含：
```typescript
return {
  user,          // ✅ 当前用户信息
  role,          // 用户角色
  isLoading,     // 加载状态
  checkPermission,
  checkAnyPermission,
  getResourcePermissions,
  // ... 其他权限方法
}
```

其中 `user` 对象包含：
```typescript
{
  id: string,           // 用户ID
  name: string,         // 用户姓名
  email: string,        // 用户邮箱
  role: string,         // 用户角色
  // ... 其他字段
}
```

---

## 🔧 完整修复

**文件**: `app/dashboard/leads/page.tsx`

**修改前** (line 26-35):
```typescript
export default function LeadsPage() {
  const router = useRouter()
  const { leads: leadsPerm } = usePermission()  // ❌
  const [leads, setLeads] = useState<Lead[]>([])
  // ...
}
```

**修改后** (line 26-35):
```typescript
export default function LeadsPage() {
  const router = useRouter()
  const { leads: leadsPerm, user } = usePermission()  // ✅
  const [leads, setLeads] = useState<Lead[]>([])
  // ...
}
```

---

## ✅ 验证

现在 `user` 变量已正确定义，可以在组件中使用：

```typescript
// 1. 检查用户是否登录
{user && (
  <div>欢迎, {user.name}</div>
)}

// 2. 检查线索是否派给当前用户
{lead.grab_user_id === user?.id && (
  <Button>反馈</Button>
)}

// 3. 检查用户角色
{user?.role === 'admin' && (
  <Button>删除</Button>
)}
```

---

**修复状态**: ✅ 完成
**修复时间**: 2025-01-01
