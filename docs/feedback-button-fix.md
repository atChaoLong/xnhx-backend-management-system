# 反馈按钮不显示 - 问题排查与修复

**问题**: 反馈按钮没有显示出来
**修复时间**: 2025-01-01

---

## 🔍 问题原因

### 根本原因
```typescript
// 原来的代码
{leadsPerm.feedback() && lead.grab_user_id === user?.id && (
  <Button>反馈</Button>
)}
```

**问题**: `grab_user_id` 字段在数据库中可能为空
- 运营录入线索时，只填写了 `grab_wechat`（抢单微信号，如"销售李四"）
- 没有填写 `grab_user_id`（对应的用户ID，如UUID）
- 导致 `lead.grab_user_id === user?.id` 判断失败

---

## ✅ 修复方案

### 临时兼容方案（已实施）

**文件**: `app/dashboard/leads/page.tsx:308-311`

```typescript
{leadsPerm.feedback() && (
  (lead.grab_user_id === user?.id ||
   (lead.grab_wechat && user?.name && lead.grab_wechat.includes(user?.name))
  ) && (
  <Button>反馈</Button>
)}
```

**双重匹配机制**:
1. **优先检查**: `lead.grab_user_id === user?.id`
   - 最准确的匹配方式
   - 适用于 `grab_user_id` 有值的情况

2. **后备检查**: `lead.grab_wechat.includes(user?.name)`
   - 如果 `grab_user_id` 为空，使用 `grab_wechat` 字段
   - 检查抢单微信号是否包含当前用户姓名
   - 例如：`grab_wechat = "销售李四"` 匹配 `user.name = "李四"`

---

## 🔧 完整的解决方案

### 方案A: 数据迁移 - 填充 grab_user_id（推荐）

创建迁移脚本，将 `grab_wechat` 对应的用户ID填入 `grab_user_id`：

```sql
-- supabase/migrations/007_fill_grab_user_id.sql

-- 更新 grab_user_id 字段
UPDATE leads l
SET grab_user_id = up.id
FROM user_profiles up
WHERE l.grab_wechat IS NOT NULL
  AND l.grab_wechat != ''
  AND (
    -- 匹配方式1: grab_wechat 包含用户姓名
    l.grab_wechat LIKE '%' || up.name || '%'
    OR
    -- 匹配方式2: grab_wechat 等于用户名
    l.grab_wechat = up.name
  )
  AND l.grab_user_id IS NULL;  -- 只更新空的
```

**优点**:
- ✅ 数据完整性更好
- ✅ 基于ID匹配更准确
- ✅ 避免姓名重复问题

**缺点**:
- ⚠️ 需要运行迁移
- ⚠️ 如果同名用户可能匹配错误

---

### 方案B: 优化匹配逻辑（当前方案）

保持当前的双重检查逻辑：

```typescript
lead.grab_user_id === user?.id ||  // 优先：ID匹配
(lead.grab_wechat && user?.name && lead.grab_wechat.includes(user?.name))  // 后备：姓名匹配
```

**优点**:
- ✅ 不需要修改数据库
- ✅ 立即生效
- ✅ 向后兼容

**缺点**:
- ⚠️ 姓名匹配可能不准确（如果有同名用户）

---

## 🧪 调试方法

### 1. 浏览器控制台调试

打开线索列表页，按F12打开控制台，运行：

```javascript
// 检查用户信息
console.log('用户ID:', user?.id)
console.log('用户姓名:', user?.name)
console.log('用户角色:', user?.role)

// 检查线索数据
leads.forEach(lead => {
  console.log('线索:', {
    id: lead.id,
    grab_user_id: lead.grab_user_id,
    grab_wechat: lead.grab_wechat,
    add_status: lead.add_status
  })
})

// 检查权限
console.log('有feedback权限:', leadsPerm.feedback())
console.log('有convert权限:', leadsPerm.convert())
```

### 2. 在代码中添加调试日志

临时在页面中添加：

```typescript
{leadsPerm.feedback() && (() => {
  console.log('检查反馈按钮显示条件:', {
    hasPermission: true,
    grab_user_id: lead.grab_user_id,
    currentUserId: user?.id,
    grab_wechat: lead.grab_wechat,
    userName: user?.name,
    userMatch: lead.grab_user_id === user?.id,
    nameMatch: lead.grab_wechat?.includes(user?.name || '')
  })
  return false
})() && <Button>反馈</Button>}
```

---

## 📊 数据示例

### 场景1: grab_user_id 有值

```javascript
// 数据库
{
  id: 'uuid-123',
  grab_wechat: '销售李四',
  grab_user_id: 'user-sales-1'  // ✅ 有值
}

// 用户
{
  id: 'user-sales-1',
  name: '李四',
  role: 'sales'
}

// 检查
lead.grab_user_id === user?.id  // 'user-sales-1' === 'user-sales-1' → true ✅
```

### 场景2: grab_user_id 为空（修复前）

```javascript
// 数据库
{
  id: 'uuid-456',
  grab_wechat: '销售王五',  // ✅ 有值
  grab_user_id: null  // ❌ 为空
}

// 用户
{
  id: 'user-sales-2',
  name: '王五',
  role: 'sales'
}

// 检查（修复前）
lead.grab_user_id === user?.id  // null === 'user-sales-2' → false ❌

// 检查（修复后）
lead.grab_user_id === user?.id  // null === 'user-sales-2' → false
lead.grab_wechat.includes(user?.name)  // '销售王五'.includes('王五') → true ✅
```

---

## 🎯 测试验证

### 测试步骤

1. **销售A登录**
   ```
   用户姓名: 李四
   用户角色: sales
   ```

2. **查看线索列表**
   - 线索A: `grab_wechat = "销售李四"`, `grab_user_id = null`
   - 线索B: `grab_wechat = "销售王五"`, `grab_user_id = null`

3. **预期结果**
   - ✅ 线索A显示"反馈"按钮（通过姓名匹配）
   - ❌ 线索B不显示"反馈"按钮（不属于李四）

---

## 📝 长期建议

### 1. 数据规范化

**录入线索时自动填充 grab_user_id**:

```typescript
// 线索录入表单
const handleCreateLead = async (data: NewLead) => {
  // 1. 根据选择的微信号查询用户ID
  const { data: userData } = await supabaseServer
    .from('user_profiles')
    .select('id')
    .eq('name', data.grab_wechat)
    .single()

  // 2. 自动填充 grab_user_id
  const leadData = {
    ...data,
    grab_user_id: userData?.id  // 自动关联用户ID
  }

  await LeadsService.createLead(leadData)
}
```

### 2. 添加用户选择器

**改进录入表单**:
```tsx
// 不再手动输入微信号，改为下拉选择
<Select value={grab_wechat} onValueChange={setGrabWechat}>
  <SelectValue placeholder="选择销售" />
  <SelectContent>
    {salesUsers.map(user => (
      <SelectItem key={user.id} value={user.name}>
        {user.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// 自动填充两个字段
const handleChange = (userName: string) => {
  const selectedUser = salesUsers.find(u => u.name === userName)
  setGrabWechat(userName)
  setGrabUserId(selectedUser?.id)  // ✅ 同时填充ID
}
```

---

## ✅ 修复验证清单

- [x] 修改反馈按钮显示逻辑
- [x] 添加 grab_wechat 姓名匹配
- [ ] 测试销售A能否看到自己的线索
- [ ] 测试销售A能否看到销售B的线索（应该不能）
- [ ] 测试其他角色是否不显示反馈按钮
- [ ] 考虑创建迁移填充 grab_user_id

---

**修复状态**: ✅ 临时修复完成
**长期方案**: 数据迁移填充 grab_user_id
**优先级**: P1 - 建议本周完成
