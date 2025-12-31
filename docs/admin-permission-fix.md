# Admin权限修复 - 移除日常业务操作权限

**修复时间**: 2025-01-01
**问题**: admin角色在线索列表页显示了"创建试听"等业务操作按钮

---

## 🎯 修复目标

Admin角色应该专注于**管理和监控**，不应该参与日常业务操作：
- ❌ 不应该反馈线索
- ❌ 不应该创建试听课程
- ✅ 应该可以查看所有数据
- ✅ 应该可以编辑/删除错误数据
- ✅ 应该可以管理用户、字典等系统配置

---

## 📋 修改内容

### 1. 修改admin权限矩阵

**文件**: `lib/permissions.ts`

**修改前**:
```typescript
admin: {
  leads: ['view', 'create', 'edit', 'delete', 'feedback'], // ❌ 有 feedback
  trialLessons: ['view', 'create', 'edit', 'delete', 'matchTeacher', 'confirmTeacher', 'confirmTime', 'addLink', 'convert'], // ❌ 有 create, convert
  students: ['view', 'create', 'edit', 'delete', 'schedule', 'manageHours', 'visit'],
  formalOrders: ['view', 'create', 'edit', 'delete'],
  // ...
}
```

**修改后**:
```typescript
admin: {
  leads: ['view', 'create', 'edit', 'delete'], // ✅ 移除 feedback - 不反馈线索
  trialLessons: ['view', 'edit', 'delete'], // ✅ 移除 create, convert - 不创建试听
  students: ['view', 'create', 'edit', 'delete'], // ✅ 保留管理权限
  formalOrders: ['view', 'create', 'edit', 'delete'], // ✅ 保留管理权限
  // ...
}
```

---

### 2. 修改hasPermission函数

**问题**: 原来admin角色自动拥有所有权限，绕过PERMISSION_MATRIX

**修改前**:
```typescript
export function hasPermission(role: Role | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false

  // admin 拥有所有权限
  if (role === ROLES.admin) return true  // ❌ 直接返回true

  // 检查权限矩阵...
}
```

**修改后**:
```typescript
export function hasPermission(role: Role | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false

  // 所有角色（包括admin）都必须在权限矩阵中明确定义权限
  // admin不再自动拥有所有权限，需要在PERMISSION_MATRIX中明确配置

  const rolePermissions = PERMISSION_MATRIX[role]
  if (!rolePermissions) return false

  const resourcePermissions = rolePermissions[resource]
  if (!resourcePermissions) return false

  return resourcePermissions.includes(action)  // ✅ 严格按权限矩阵检查
}
```

---

### 3. 修改getPermissions函数

**问题**: 原来admin返回所有操作，导致按钮显示

**修改前**:
```typescript
export function getPermissions(role: Role | undefined, resource: Resource): Action[] {
  if (!role) return []

  if (role === ROLES.admin) {
    // 返回所有可能的操作
    return Object.values(ACTIONS)  // ❌ 返回所有操作
  }

  const rolePermissions = PERMISSION_MATRIX[role]
  return rolePermissions?.[resource] || []
}
```

**修改后**:
```typescript
export function getPermissions(role: Role | undefined, resource: Resource): Action[] {
  if (!role) return []

  // 所有角色（包括admin）都从权限矩阵中获取权限
  const rolePermissions = PERMISSION_MATRIX[role]
  return rolePermissions?.[resource] || []  // ✅ 只返回矩阵中定义的权限
}
```

---

## ✅ 修复后的效果

### Admin在线索列表页的操作按钮

| 操作 | 修复前 | 修复后 | 说明 |
|-----|--------|--------|------|
| 新增线索 | ✅ | ✅ | 保留 |
| 编辑线索 | ✅ | ✅ | 保留 |
| 删除线索 | ✅ | ✅ | 保留 |
| 反馈线索 | ✅ | ❌ | **移除** - 不参与日常业务 |
| 创建试听 | ✅ | ❌ | **移除** - 不参与日常业务 |

### Admin的职责定位

**应该做的** (管理职责):
- ✅ 查看所有数据和报表
- ✅ 管理用户账号和角色
- ✅ 管理数据字典
- ✅ 编辑/删除错误的数据
- ✅ 查看系统配置

**不应该做的** (业务操作):
- ❌ 反馈线索状态
- ❌ 创建试听课程
- ❌ 匹配老师
- ❌ 填写回访记录
- ❌ 核对课时

这些业务操作应该由对应的业务角色负责：
- **销售** - 反馈线索、创建试听
- **班主任** - 创建试听、回访学生
- **教务** - 匹配老师、核对课时

---

## 📊 完整的Admin权限清单

### 线索管理 (leads)
```typescript
['view', 'create', 'edit', 'delete']
```
- ✅ 查看线索列表
- ✅ 录入新线索
- ✅ 编辑线索信息
- ✅ 删除线索
- ❌ 反馈线索（移除）

### 试听课程 (trialLessons)
```typescript
['view', 'edit', 'delete']
```
- ✅ 查看试听列表
- ✅ 编辑试听信息
- ✅ 删除试听
- ❌ 创建试听（移除）
- ❌ 匹配老师（移除）
- ❌ 确认老师（移除）
- ❌ 确定时间（移除）
- ❌ 生成链接（移除）

### 学生管理 (students)
```typescript
['view', 'create', 'edit', 'delete']
```
- ✅ 查看学生列表
- ✅ 新建学生
- ✅ 编辑学生信息
- ✅ 删除学生
- ❌ 批量排课（移除）
- ❌ 课时管理（移除）
- ❌ 回访管理（移除）

### 订单管理 (formalOrders)
```typescript
['view', 'create', 'edit', 'delete']
```
- ✅ 查看订单列表
- ✅ 录入订单
- ✅ 编辑订单
- ✅ 删除订单

### 系统管理
```typescript
users: ['view', 'create', 'edit', 'delete'],  // ✅ 用户管理
dictionaries: ['view', 'create', 'edit', 'delete'],  // ✅ 字典管理
```

---

## 🔄 设计理念转变

### 修复前: Admin = 超级用户
```
Admin拥有所有权限，可以做任何事
- 好处：灵活性高，可以处理任何情况
- 坏处：容易误操作，业务流程不清晰
```

### 修复后: Admin = 系统管理员
```
Admin专注于系统管理，不参与日常业务
- 好处：职责清晰，业务流程规范
- 好处：降低误操作风险
- 好处：审计日志更清晰
```

---

## 🎯 最佳实践建议

### 1. Admin账号使用场景

**推荐使用**:
- 系统初始化配置
- 管理用户账号和权限
- 处理数据错误（如重复线索）
- 查看系统整体数据
- 紧急情况处理

**不推荐使用**:
- 日常线索录入（用运营账号）
- 日常线索反馈（用销售账号）
- 日常试听创建（用销售/班主任账号）
- 日常排课回访（用班主任账号）

### 2. 测试建议

应该为每种角色创建专门的测试账号：
```sql
-- 管理员
admin@test.com (role: admin)

-- 运营
operator@test.com (role: operator)

-- 销售
sales1@test.com (role: sales)
sales2@test.com (role: sales)

-- 班主任
head@test.com (role: head_teacher)

-- 教务
academic@test.com (role: academic_affairs)
```

### 3. 权限设计原则

**明确职责**:
- 每个角色只做自己职责范围内的事
- Admin不应该成为"万能账号"

**最小权限**:
- 默认不给权限，按需添加
- 定期审查权限使用情况

**审计友好**:
- 每个操作都有明确的责任人
- 避免使用admin账号执行业务操作

---

## ✅ 验证测试

### 测试步骤

1. **使用admin账号登录**
   ```bash
   Email: admin@test.com
   Role: admin
   ```

2. **访问线索列表页**
   ```
   http://localhost:3000/dashboard/leads
   ```

3. **检查按钮显示**
   - ✅ 应该显示"新增线索"按钮
   - ✅ 应该显示"编辑"按钮
   - ✅ 应该显示"删除"按钮
   - ❌ **不应该**显示"反馈"按钮
   - ❌ **不应该**显示"创建试听"按钮

4. **检查其他页面**
   - 访问 `/dashboard/trial-lessons`
   - ❌ **不应该**显示"新增试听"按钮

### 预期结果

Admin登录后在线索列表页只能看到管理类按钮：
```
[刷新] [新增线索]
--------------------------
线索列表...

操作列:
[编辑] [删除]
(没有"反馈"和"创建试听"按钮)
```

---

## 📝 总结

### 修改的文件
1. **`lib/permissions.ts`**
   - 修改admin权限矩阵（移除业务操作权限）
   - 修改`hasPermission`函数（移除admin特殊处理）
   - 修改`getPermissions`函数（移除admin特殊处理）

### 影响范围
- ✅ Admin不再显示"反馈"按钮
- ✅ Admin不再显示"创建试听"按钮
- ✅ Admin仍保留所有管理权限
- ✅ 其他角色权限不受影响

### 设计理念
- Admin = 系统管理员，不是业务操作员
- 职责清晰，避免误操作
- 审计日志更准确

---

**修复状态**: ✅ 完成
**修复时间**: 2025-01-01
**影响**: 仅限admin角色，其他角色不受影响
