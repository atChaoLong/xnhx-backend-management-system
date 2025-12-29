# 在线数据库字段映射说明

## 重要变更

根据在线 Supabase 数据库的实际结构，已更新所有字段命名以保持一致。

## 字段映射对照表

| 旧字段名（本地） | 新字段名（在线） | 说明 |
|----------------|----------------|------|
| `order_serial` | `report_number` | 报单序号 |
| `source_account` | `xhs_source` | 小红书账号来源 |
| `operator_name` | `operator_id` | 运营人员ID |
| `grade` | `grade_code` | 年级代码 |
| `subjects` | `subject_codes` | 学科代码数组 |
| `feedback_status` | `add_status` | 添加状态 |
| `notes` | `remark` | 备注 |

## 新增字段（在线数据库独有）

以下字段在在线数据库中存在，本地之前没有：

- `duplicate_mark` (boolean) - 重复标记
- `collision_operator` (text) - 冲突运营人员
- `grab_user_id` (text) - 抢单用户ID
- `add_feedback` (text) - 添加反馈
- `feedback_time` (timestamptz) - 反馈时间
- `conversion_status` (text) - 转化状态

## 完整的 Lead 数据结构

```typescript
interface Lead {
  // 系统字段
  id: string
  created_at: string
  updated_at: string

  // 必填字段
  report_number: string           // 报单序号
  entry_date: string              // 录单日期 (YYYY-MM-DD)
  xhs_source: string              // 小红书账号来源
  grade_code: string              // 年级代码
  add_method_code: string         // 添加方式代码
  operator_id: string             // 运营人员ID

  // 可选字段
  subject_codes?: string[]        // 学科代码数组
  region_ip?: string              // 地域IP
  parent_wechat?: string          // 家长微信号
  chat_screenshots?: string       // 聊天截图URL

  // 业务字段
  duplicate_mark?: boolean        // 重复标记
  collision_operator?: string     // 冲突运营人员
  grab_wechat?: string            // 抢单微信号
  grab_user_id?: string           // 抢单用户ID
  add_feedback?: string           // 添加反馈
  feedback_time?: string          // 反馈时间
  add_status?: string             // 添加状态 (added/not_added)
  conversion_status?: string      // 转化状态
  remark?: string                 // 备注
}
```

## API 使用示例

### 创建线索（使用新字段名）

```typescript
import { LeadsService } from '@/lib/services/leads'

const newLead = await LeadsService.createLead({
  report_number: 'BX20250124001',
  entry_date: '2025-12-24',
  xhs_source: '小红书官方账号',
  grade_code: '高一',
  add_method_code: '主动添加',
  operator_id: 'user_123',
  subject_codes: ['数学', '物理'],
  region_ip: '北京',
  parent_wechat: 'parent_wx123',
  grab_wechat: 'grab_wx456',
  add_status: 'pending',
})
```

### 查询线索

```typescript
// GET /api/leads - 获取所有线索
const leads = await LeadsService.getLeads()

// GET /api/leads/{id} - 获取单个线索
const lead = await LeadsService.getLeadById('uuid-here')
```

### 更新线索

```typescript
const updated = await LeadsService.updateLead({
  id: 'uuid-here',
  add_status: 'added',
  conversion_status: 'contacted',
  remark: '已联系家长，有意向',
  feedback_time: new Date().toISOString(),
})
```

## 数据库迁移

在 Supabase 控制台的 SQL Editor 中执行：

```sql
-- 查看现有表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 查看示例数据
SELECT * FROM public.leads LIMIT 5;
```

## 前端字段访问

在 React 组件中访问字段：

```typescript
// ✅ 正确 - 使用新字段名
<TableCell>{lead.report_number}</TableCell>
<TableCell>{lead.xhs_source}</TableCell>
<TableCell>{lead.grade_code}</TableCell>
<TableCell>{lead.add_status}</TableCell>

// ❌ 错误 - 旧字段名不再存在
<TableCell>{lead.order_serial}</TableCell>  // 不存在
<TableCell>{lead.source_account}</TableCell> // 不存在
<TableCell>{lead.operator_name}</TableCell>  // 不存在
```

## 注意事项

1. **向后兼容性**: 旧字段名已完全移除，必须使用新字段名
2. **API 调用**: 所有 API 请求必须使用新字段名
3. **数据库同步**: 确保 Supabase 数据库结构与新的迁移文件一致
4. **测试**: 在生产环境部署前先在开发环境测试

## 更新文件列表

以下文件已更新以使用新的字段名：

- ✅ `supabase/migrations/001_create_leads_table.sql` - 数据库表结构
- ✅ `lib/services/leads.ts` - TypeScript 类型定义
- ✅ `app/dashboard/leads/page.tsx` - 前端列表页面
- ⏳ `app/dashboard/leads/new/page.tsx` - 新增页面（待更新）
- ⏳ `app/dashboard/leads/[id]/edit/page.tsx` - 编辑页面（待更新）

## 测试清单

部署前请确保测试：

- [ ] 线索列表正确显示
- [ ] 创建新线索成功
- [ ] 编辑现有线索成功
- [ ] 删除线索成功
- [ ] 所有字段正确映射
- [ ] 无控制台错误
