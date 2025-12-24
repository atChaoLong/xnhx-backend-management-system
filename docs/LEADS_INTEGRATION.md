# 线索管理接口集成说明

## 已完成的工作

### 1. 数据库表结构 ✅
- **文件**: `supabase/migrations/001_create_leads_table.sql`
- 包含 `leads` 和 `daily_leads` 两张表
- 完整的索引和 RLS 策略
- 自动更新时间戳触发器

### 2. API 接口 ✅
- **GET** `/api/leads` - 获取所有线索
- **POST** `/api/leads` - 创建新线索
- **PUT** `/api/leads` - 更新线索
- **GET** `/api/leads/[id]` - 获取单个线索
- **DELETE** `/api/leads/[id]` - 删除线索

### 3. 服务层 ✅
- **文件**: `lib/services/leads.ts`
- 提供 `LeadsService` 对象
- 包含完整的 CRUD 方法
- 统一的错误处理

### 4. 前端更新 ✅
- **文件**: `app/dashboard/leads/page.tsx`
- 使用真实 API 替代内存状态
- 添加加载状态和错误处理
- 集成 Toast 通知

### 5. 工具和Hook ✅
- **文件**: `hooks/use-toast.ts`
- 简单的 Toast 通知系统
- 自动消失功能

## 部署步骤

### 步骤 1: 在 Supabase 中执行 SQL

1. 登录 Supabase 控制台
2. 进入 SQL Editor
3. 复制并执行 `supabase/migrations/001_create_leads_table.sql` 的内容

### 步骤 2: 启动开发服务器

```bash
npm run dev
```

### 步骤 3: 测试 API

访问以下端点测试：

**获取所有线索**:
```bash
curl http://localhost:3000/api/leads
```

**创建新线索**:
```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "order_serial": "TEST001",
    "entry_date": "2025-12-24",
    "source_account": "小红书官方账号",
    "add_method_code": "主动添加",
    "operator_name": "测试用户"
  }'
```

### 步骤 4: 测试前端界面

1. 访问 http://localhost:3000/dashboard/leads
2. 点击"新增线索"测试创建功能
3. 测试编辑和删除功能

## 数据模型

### Lead 接口

```typescript
interface Lead {
  id: string                       // UUID (自动生成)
  created_at: string               // 创建时间
  updated_at: string               // 更新时间

  // 必填字段
  order_serial: string             // 报单序号
  entry_date: string               // 录单日期 (YYYY-MM-DD)
  source_account: string           // 小红书账号来源
  add_method_code: string          // 添加方式
  operator_name: string            // 运营人员

  // 可选字段
  grade?: string                   // 年级
  subjects?: string[]              // 咨询学科 (数组)
  region_ip?: string               // 地域 IP
  parent_wechat?: string           // 家长微信号
  chat_screenshots?: string        // 聊天截图 URL
  grab_wechat?: string             // 抢单微信号
  feedback_status?: string         // 反馈状态 (added/not_added)
  consultant?: string              // 顾问
  notes?: string                   // 备注
}
```

## API 使用示例

### 获取所有线索

```typescript
import { LeadsService } from '@/lib/services/leads'

const leads = await LeadsService.getLeads()
console.log(leads)
```

### 创建新线索

```typescript
const newLead = await LeadsService.createLead({
  order_serial: 'TEST001',
  entry_date: '2025-12-24',
  source_account: '小红书官方账号',
  add_method_code: '主动添加',
  operator_name: '张三',
  grade: '高一',
  subjects: ['数学', '物理'],
  region_ip: '北京',
  parent_wechat: 'parent_wx',
  grab_wechat: 'grab_wx',
})
```

### 更新线索

```typescript
const updated = await LeadsService.updateLead({
  id: 'uuid-here',
  feedback_status: 'added',
  notes: '已联系家长',
})
```

### 删除线索

```typescript
await LeadsService.deleteLead('uuid-here')
```

## 反馈状态说明

- `added` - 已添加（绿色标签）
- `not_added` - 未添加（红色标签）
- 空值或其他 - 未反馈（灰色标签）

## 待完成的功能

### 1. 新增线索页面更新
- [ ] 更新 `app/dashboard/leads/new/page.tsx`
- [ ] 使用真实 API 调用
- [ ] 添加表单验证

### 2. 编辑线索页面更新
- [ ] 更新 `app/dashboard/leads/[id]/edit/page.tsx`
- [ ] 加载现有数据
- [ ] 保存更改

### 3. 高级功能
- [ ] 搜索和筛选
- [ ] 批量操作
- [ ] 导出功能
- [ ] 文件上传（聊天截图）

### 4. 每日线索功能
- [ ] 创建每日线索 API
- [ ] 创建每日线索页面
- [ ] 实现简历上传功能

## 注意事项

1. **环境变量**: 确保 `.env.local` 中配置了正确的 Supabase 凭证
2. **RLS 策略**: 当前允许所有认证用户访问，生产环境可能需要更严格的策略
3. **字段命名**: 数据库使用蛇形命名（order_serial），前端也保持一致
4. **日期格式**: 确保日期使用 ISO 8601 格式（YYYY-MM-DD）

## 故障排查

### 问题: API 返回 401
- **原因**: 未登录或 token 无效
- **解决**: 先访问 /login 登录

### 问题: API 返回 400
- **原因**: 数据验证失败或数据库错误
- **解决**: 检查请求数据格式，查看服务器日志

### 问题: 数据未保存
- **原因**: 表未创建或权限问题
- **解决**: 在 Supabase 控制台检查表是否存在

## 下一步

1. 在 Supabase 中执行 SQL 脚本
2. 测试 API 接口
3. 完成新增和编辑页面
4. 添加更多高级功能
