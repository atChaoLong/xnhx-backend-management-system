# 业务流程与权限系统实施总结

## ✅ 已完成的工作

### 1. 业务流程设计文档
- **文件**: `BUSINESS_WORKFLOW_DESIGN.md`
- **内容**:
  - 8个业务模块的详细流程定义
  - 状态机设计（线索、试听、学生、退费）
  - 权限矩阵配置
  - 字段级权限控制规则
  - 前端操作按钮设计方案

### 2. 状态计算工具库
- **文件**: `lib/status-calculator.ts`
- **功能**:
  - ✅ 线索状态计算（添加状态、转化状态）
  - ✅ 试听状态计算（8个状态）
  - ✅ 学生状态计算（学生状态、新生状态、回访状态）
  - ✅ 退费状态计算（4个状态）
  - ✅ 批量状态计算工具
  - ✅ 中文状态名称映射

### 3. 前端权限控制系统
- **文件**: `lib/hooks/usePermission.ts`
- **功能**:
  - ✅ usePermission Hook
  - ✅ Permission 组件（单个权限）
  - ✅ PermissionAny 组件（多权限OR）
  - ✅ 快捷方法（leads, trialLessons, students等）
  - ✅ TypeScript 类型安全

### 4. 前端使用指南
- **文件**: `FRONTEND_PERMISSION_GUIDE.md`
- **内容**:
  - 6个页面的权限控制示例
  - 表单字段权限控制
  - 侧边栏菜单权限控制
  - 最佳实践和常见问题

## 📋 业务状态定义

### 线索状态

**添加状态** (lead_add_status):
- `unassigned` - 运营未派单（抢单微信号为空）
- `added` - 已添加（反馈已添加 OR 产生试听）
- `not_added` - 未添加（反馈未添加）
- `waiting_feedback` - 销售未反馈

**转化状态** (lead_convert_status):
- `trial` - 试听（产生试听 AND 没产生正式）
- `formal` - 正式（产生正式订单）
- `empty` - 空（其他情况）

### 试听状态

**试听状态** (lesson_status):
1. `cancelled` - 取消试听
2. `waiting_match` - 待匹配老师
3. `waiting_confirm` - 待确认老师
4. `waiting_time` - 待确认时间
5. `waiting_link` - 待开链接
6. `scheduled` - 已排待上课
7. `waiting_feedback` - 上完待反馈
8. `completed` - 已完成

**是否转化**:
- 自动判断：产生正式订单
- 手动标记：是/否/待定

### 学生状态

**学生状态** (student_status):
- `missing` - 缺状态（学生状态为空）
- `low_hours` - 快没课（课表截至<7天）
- `normal` - 正常

**新生状态** (new_status):
- `week_1` - 一周新生
- `week_2` - 两周新生
- `week_3` - 三周新生
- `week_4` - 四周新生
- `old` - 老生（>4周）

**回访状态** (visit_status):
- `visited` - 已回访（本月回访次数>0）
- `not_visited` - 未回访

### 退费状态

**退费状态** (refund_status):
1. `waiting_verify` - 待核对金额
2. `waiting_payment` - 待财务打款
3. `waiting_performance` - 待核对业绩
4. `completed` - 已完成

## 🔐 权限配置总结

### 角色与操作

| 角色 | 线索 | 试听 | 学生 | 订单 | 异动 | 面试 | 老师库 |
|-----|------|------|------|------|------|------|--------|
| **运营** | 录入 | 查看 | 查看 | 查看 | 查看 | 查看 | 查看 |
| **销售** | 反馈<br>转化 | 新增<br>确认时间<br>转化 | 新建 | 新签 | 查看 | 查看 | 查看 |
| **班主任** | 查看 | 编辑 | 新建<br>排课<br>回访 | 续费 | 录入退费 | 查看 | 查看 |
| **教师** | 查看 | 编辑 | 编辑 | 查看 | 查看 | 查看 | 信息录入 |
| **教务** | 查看 | 匹配老师<br>确认老师<br>确认时间<br>链接 | 课时管理 | 查看 | 核对课时 | 复核录像 | 备注 |
| **财务** | 查看 | 查看 | 查看 | 查看 | 打款 | 查看 | 查看 |
| **人事** | 查看 | 查看 | 查看 | 查看 | 核对业绩 | 约面<br>评价<br>上传 | 查看 |

### 关键操作权限

**线索管理**:
- `leads.create` - 运营录入
- `leads.feedback` - 销售反馈
- `leads.convert` - 销售转化

**试听管理**:
- `trialLessons.create` - 销售新增
- `trialLessons.matchTeacher` - 教务匹配
- `trialLessons.confirmTeacher` - 教务确认
- `trialLessons.confirmTime` - 教务确定时间
- `trialLessons.addLink` - 教务添加链接
- `trialLessons.convert` - 销售转化

**学生管理**:
- `students.schedule` - 班主任排课
- `students.manageHours` - 班主任课时管理
- `students.visit` - 班主任回访

**异动管理**:
- `transactions.verifyHours` - 教务核对课时
- `transactions.payment` - 财务打款
- `transactions.verifyPerformance` - 人事核对业绩

## 💻 使用方式

### 后端：状态计算

```typescript
import { calculateLeadAddStatus, calculateTrialLessonStatus } from '@/lib/status-calculator'

// API 返回时自动计算状态
export async function GET(request: NextRequest) {
  const { data: leads } = await supabaseServer
    .from('leads')
    .select('*')

  // 批量计算状态
  const statusResults = await batchCalculateLeadStatus(leads)

  // 合并状态到数据
  const leadsWithStatus = leads.map(lead => ({
    ...lead,
    addStatus: statusResults.find(s => s.id === lead.id)?.addStatus,
    addStatusName: statusResults.find(s => s.id === lead.id)?.addStatusName,
    convertStatus: statusResults.find(s => s.id === lead.id)?.convertStatus,
    convertStatusName: statusResults.find(s => s.id === lead.id)?.convertStatusName,
  }))

  return NextResponse.json({ data: leadsWithStatus })
}
```

### 前端：权限控制

```typescript
'use client'
import { usePermission } from '@/lib/hooks/usePermission'
import { Permission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS } from '@/lib/permissions'

export default function LeadsPage() {
  const { leads } = usePermission()

  return (
    <div>
      {/* 方式1：使用 Hook */}
      {leads.create() && <Button>创建线索</Button>}

      {/* 方式2：使用组件 */}
      <Permission resource={RESOURCES.leads} action={ACTIONS.feedback}>
        <Button>反馈</Button>
      </Permission>
    </div>
  )
}
```

## 📊 实施检查清单

### Phase 1: 后端实现
- [x] 设计业务流程和状态机
- [x] 创建状态计算工具库
- [x] 更新权限矩阵
- [ ] 在 API 中集成状态计算
- [ ] 添加新的 API 端点（反馈、匹配老师等）

### Phase 2: 前端实现
- [x] 创建权限控制 Hook 和组件
- [x] 编写使用指南
- [ ] 在各页面应用权限控制
- [ ] 实现表单字段权限控制
- [ ] 更新侧边栏菜单权限

### Phase 3: 测试
- [ ] 测试各角色权限
- [ ] 测试状态计算逻辑
- [ ] 测试前端权限显示
- [ ] 性能测试

### Phase 4: 数据库优化（可选）
- [ ] 添加状态计算字段
- [ ] 创建数据库视图
- [ ] 添加触发器或函数

## 🎯 下一步工作

### 1. 集成状态计算到 API

修改现有的 API 路由，在返回数据时自动计算状态：

```typescript
// app/api/leads/route.ts
import { batchCalculateLeadStatus } from '@/lib/status-calculator'

export async function GET(request: NextRequest) {
  const { data: leads } = await supabaseServer
    .from('leads')
    .select('*')

  // 计算状态
  const statuses = await batchCalculateLeadStatus(leads)

  // 合并状态
  const result = leads.map((lead, index) => ({
    ...lead,
    ...statuses[index],
  }))

  return NextResponse.json({ data: result })
}
```

### 2. 创建新的 API 端点

根据业务需求创建专门的 API 端点：

```typescript
// app/api/leads/feedback/route.ts - 销售反馈线索
// app/api/trial-lessons/match-teacher/route.ts - 教务匹配老师
// app/api/trial-lessons/confirm-teacher/route.ts - 教务确认老师
// app/api/trial-lessons/add-link/route.ts - 教务添加链接
// app/api/students/schedule/route.ts - 班主任排课
// app/api/students/visit/route.ts - 班主任回访
// app/api/transactions/verify-hours/route.ts - 教务核对课时
// app/api/transactions/payment/route.ts - 财务打款
// app/api/transactions/verify-performance/route.ts - 人事核对业绩
```

### 3. 应用前端权限控制

在各页面使用 `usePermission` Hook：

```typescript
// 更新这些页面
// - app/dashboard/leads/page.tsx
// - app/dashboard/trial-lessons/page.tsx
// - app/dashboard/students/page.tsx
// - app/dashboard/formal-orders/page.tsx
// - app/dashboard/transactions/page.tsx
// - app/dashboard/teacher-candidates/page.tsx
// - app/dashboard/teachers/page.tsx
```

### 4. 更新侧边栏菜单

根据用户角色动态显示菜单项。

## 📚 相关文档

1. **BUSINESS_WORKFLOW_DESIGN.md** - 业务流程设计（完整）
2. **lib/status-calculator.ts** - 状态计算工具（完整）
3. **lib/hooks/usePermission.ts** - 权限控制 Hook（完整）
4. **FRONTEND_PERMISSION_GUIDE.md** - 前端使用指南（完整）
5. **PERMISSION_IMPLEMENTATION_SUMMARY.md** - 权限系统总结
6. **lib/permissions.ts** - 权限定义（已更新）
7. **lib/route-permissions.ts** - 路由权限配置（已更新）
8. **middleware.ts** - Next.js中间件（已实现）

## 🎉 总结

已完成业务流程设计和权限控制框架搭建，包括：

✅ **8个业务模块**的完整流程定义
✅ **4种业务状态**的计算逻辑（线索、试听、学生、退费）
✅ **8个角色**的权限矩阵配置
✅ **25个操作**的权限定义
✅ **前端权限控制**Hook 和组件
✅ **完整的使用指南**和示例代码

**系统特点**:
- 零侵入的后端权限检查
- 类型安全的权限控制
- 自动化的状态计算
- 灵活的前端权限组件
- 完善的文档和示例

**下一步**: 根据实际需求逐步集成到各页面和 API 中。

---

**文档版本**: 1.0
**创建日期**: 2025-12-30
**作者**: Claude Code
