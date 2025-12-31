# 线索管理权限修复总结

**修复时间**: 2025-01-01
**修复范围**: 权限矩阵、按钮显示逻辑

---

## ✅ 修复完成的问题

### 1. 销售编辑权限问题 ✅ 已修复

**问题**: 销售有 `edit` 权限，不应该能编辑线索基本信息

**修复位置**: `lib/permissions.ts:92`

**修复前**:
```typescript
sales: {
  leads: ['view', 'edit', 'feedback', 'convert'],
}
```

**修复后**:
```typescript
sales: {
  leads: ['view', 'feedback', 'convert'], // 移除 edit - 销售只能反馈状态
}
```

**影响**:
- ✅ 销售不再显示"编辑"按钮
- ✅ 销售只能通过"反馈"按钮修改 `add_status`
- ✅ 防止销售修改 `report_number`, `entry_date` 等关键字段

---

### 2. 班主任创建试听权限问题 ✅ 已修复

**问题**: 班主任缺少 `convert` 权限，无法创建试听

**修复位置**: `lib/permissions.ts:105`

**修复前**:
```typescript
head_teacher: {
  leads: ['view'],
}
```

**修复后**:
```typescript
head_teacher: {
  leads: ['view', 'convert'], // 添加 convert - 班主任可以创建试听
}
```

**影响**:
- ✅ 班主任现在可以看到"创建试听"按钮
- ✅ 符合文档要求 (system-menu.md:129)

---

### 3. 反馈按钮显示逻辑问题 ✅ 已修复

**问题**: 所有销售的反馈按钮都显示，不管线索是否派给自己

**修复位置**: `app/dashboard/leads/page.tsx:307`

**修复前**:
```typescript
{leadsPerm.feedback() && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>
    反馈
  </Button>
)}
```

**修复后**:
```typescript
{leadsPerm.feedback() && lead.grab_user_id === user?.id && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>
    反馈
  </Button>
)}
```

**影响**:
- ✅ 反馈按钮只对派给自己的线索显示
- ✅ 防止销售反馈其他销售的线索
- ✅ 更清晰的职责划分

---

## 📊 修复后的权限矩阵

### 运营人员 (operator)
```typescript
{
  leads: ['view', 'create', 'edit', 'delete'],
}
```

**可见操作**:
- ✅ 新增线索按钮
- ✅ 编辑按钮（所有线索）
- ✅ 删除按钮（所有线索）
- ❌ 反馈按钮（不显示）
- ❌ 创建试听按钮（不显示）

---

### 销售顾问 (sales)
```typescript
{
  leads: ['view', 'feedback', 'convert'],
}
```

**可见操作**:
- ❌ 新增线索按钮（不显示）
- ❌ 编辑按钮（不显示）
- ❌ 删除按钮（不显示）
- ✅ 反馈按钮（只对派给自己的线索显示）
- ✅ 创建试听按钮（所有线索显示）

**使用场景**:
1. 查看所有线索列表
2. 找到派给自己的线索（`grab_user_id == 自己的ID`）
3. 点击"反馈"按钮标记已添加/未添加
4. 点击"创建试听"按钮创建试听课程

---

### 班主任 (head_teacher)
```typescript
{
  leads: ['view', 'convert'],
}
```

**可见操作**:
- ❌ 新增线索按钮（不显示）
- ❌ 编辑按钮（不显示）
- ❌ 删除按钮（不显示）
- ❌ 反馈按钮（不显示）
- ✅ 创建试听按钮（所有线索显示）

**使用场景**:
1. 查看所有线索列表
2. 点击"创建试听"按钮为有需求的线索创建试听

---

### 管理员 (admin)
```typescript
{
  leads: ['view', 'create', 'edit', 'delete', 'feedback'],
}
```

**可见操作**:
- ✅ 所有按钮都显示
- ✅ 可以执行所有操作

---

## 🔍 权限验证清单

### 场景1: 运营录入线索并派单

**操作流程**:
1. 运营登录 → 访问 `/dashboard/leads/new`
2. 填写线索信息 → 选择"抢单微信号" → 提交
3. 访问 `/dashboard/leads` → 查看刚创建的线索
4. 点击"编辑" → 修改"抢单微信号"为销售A的微信
5. 保存

**验证点**:
- ✅ 运营可以录入线索
- ✅ 运营可以编辑线索
- ✅ 线索状态显示"运营未派单"（如果 `grab_wechat` 为空）

---

### 场景2: 销售反馈线索

**操作流程**:
1. 销售A登录 → 访问 `/dashboard/leads`
2. 查看列表 → 只有派给销售A的线索显示"反馈"按钮
3. 点击"反馈" → 状态变为"已添加"

**验证点**:
- ✅ 销售A看不到"编辑"按钮
- ✅ 销售A只对自己负责的线索看到"反馈"按钮
- ✅ 销售B看不到销售A线索的"反馈"按钮
- ✅ 反馈后状态变为"已添加"

---

### 场景3: 班主任创建试听

**操作流程**:
1. 班主任登录 → 访问 `/dashboard/leads`
2. 选择一个线索 → 点击"创建试听"
3. 跳转到试听创建页面 → 填写信息 → 提交

**验证点**:
- ✅ 班主任可以看到"创建试听"按钮
- ✅ 班主任看不到"反馈"按钮
- ✅ 创建试听后线索转化状态变为"试听"

---

### 场景4: 权限隔离

**测试用例**:

| 用户角色 | 录入线索 | 编辑线索 | 反馈线索 | 创建试听 | 删除线索 |
|---------|---------|---------|---------|---------|---------|
| 运营     | ✅       | ✅       | ❌       | ❌       | ✅       |
| 销售A    | ❌       | ❌       | ✅*      | ✅       | ❌       |
| 班主任   | ❌       | ❌       | ❌       | ✅       | ❌       |
| 管理员   | ✅       | ✅       | ✅       | ✅       | ✅       |

*注：销售A只能反馈派给自己的线索

---

## 🎯 下一步建议

### P0 - 必须立即添加的功能
1. ✅ **权限修复**（已完成）
2. ⏳ **筛选功能** - 提升用户体验
   - "只看我的线索" 筛选
   - 按添加状态筛选
   - 按转化状态筛选

### P1 - 应该添加的功能
3. ⏳ **批量操作**
   - 批量反馈
   - 批量创建试听
4. ⏳ **线索详情页**
   - 查看完整信息
   - 查看操作历史
5. ⏳ **数据统计**
   - 今日新增线索数
   - 待反馈线索数
   - 转化率统计

### P2 - 可以后续优化
6. ⏳ **导出功能**
   - 导出Excel
7. ⏳ **高级搜索**
   - 按时间范围
   - 按运营人员
8. ⏳ **实时通知**
   - 新线索通知
   - 派单通知

---

## 📁 修改的文件

1. **`lib/permissions.ts`** - 权限矩阵
   - 移除 `sales.leads.edit` 权限
   - 添加 `head_teacher.leads.convert` 权限

2. **`app/dashboard/leads/page.tsx`** - 线索列表页
   - 修改反馈按钮显示条件（检查 `grab_user_id`）
   - 添加注释说明按钮用途

---

## ✅ 修复验证

### 开发环境测试步骤

```bash
# 1. 启动开发服务器
npm run dev

# 2. 访问线索列表页
http://localhost:3000/dashboard/leads

# 3. 测试不同角色
# 使用不同的测试账号登录
```

### 测试账号（需要在数据库中创建）

```sql
-- 运营人员
INSERT INTO user_profiles (id, name, role, email)
VALUES ('user-operator-1', '运营张三', 'operator', 'operator@test.com');

-- 销售A
INSERT INTO user_profiles (id, name, role, email)
VALUES ('user-sales-1', '销售李四', 'sales', 'sales1@test.com');

-- 销售B
INSERT INTO user_profiles (id, name, role, email)
VALUES ('user-sales-2', '销售王五', 'sales', 'sales2@test.com');

-- 班主任
INSERT INTO user_profiles (id, name, role, email)
VALUES ('user-head-1', '班主任赵六', 'head_teacher', 'head@test.com');

-- 测试线索数据
INSERT INTO leads (report_number, entry_date, xhs_source, grade_code, add_method_code, operator_id, grab_wechat, grab_user_id)
VALUES
  -- 派给销售A的线索
  ('RPT001', '2025-01-01', '小红书账号1', 'grade_10', 'add_1', 'user-operator-1', 'sales1_wechat', 'user-sales-1'),
  -- 派给销售B的线索
  ('RPT002', '2025-01-01', '小红书账号2', 'grade_11', 'add_1', 'user-operator-1', 'sales2_wechat', 'user-sales-2'),
  -- 未派单的线索
  ('RPT003', '2025-01-01', '小红书账号3', 'grade_9', 'add_2', 'user-operator-1', NULL, NULL);
```

### 预期结果

**运营登录**:
- ✅ 显示3条线索
- ✅ 所有线索都有"编辑"和"删除"按钮
- ❌ 不显示"反馈"和"创建试听"按钮

**销售A登录**:
- ✅ 显示3条线索
- ✅ RPT001显示"反馈"按钮
- ❌ RPT002和RPT003不显示"反馈"按钮
- ✅ 所有线索都显示"创建试听"按钮
- ❌ 不显示"编辑"和"删除"按钮

**销售B登录**:
- ✅ 显示3条线索
- ✅ RPT002显示"反馈"按钮
- ❌ RPT001和RPT003不显示"反馈"按钮
- ✅ 所有线索都显示"创建试听"按钮
- ❌ 不显示"编辑"和"删除"按钮

**班主任登录**:
- ✅ 显示3条线索
- ❌ 所有线索都不显示"反馈"按钮
- ✅ 所有线索都显示"创建试听"按钮
- ❌ 不显示"编辑"和"删除"按钮

---

**修复完成时间**: 2025-01-01
**修复人员**: Claude AI
**状态**: ✅ 完成
**验证**: ⏳ 待测试
