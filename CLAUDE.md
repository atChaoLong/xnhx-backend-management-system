# Claude Code 配置文件

## 项目概述

小牛好学 - 教育管理系统，使用 Next.js + Supabase 构建。

## 环境变量配置

环境变量文件位置：项目根目录 `.env.local`

**重要**：
- `.env.local` 包含敏感信息，已添加到 `.gitignore`，不会提交到 Git
- 如需配置环境变量，请参考 `.env.local.example`（如果存在）或联系开发团队
- 主要配置项包括：Supabase URL、密钥、ClassIn SDK 配置等

## 技术栈

- **前端框架**: Next.js 16.0.10 (App Router)
- **UI 组件**: shadcn/ui
- **样式**: Tailwind CSS
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **日期处理**: date-fns
- **状态管理**: React Hooks (useState, useEffect)

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── dashboard/          # 仪表盘页面
│   ├── api/                # API 路由
│   └── layout.tsx          # 根布局
├── components/             # React 组件
│   ├── dashboard/          # 仪表盘组件
│   └── ui/                 # shadcn/ui 组件
├── lib/                    # 工具库和服务
│   ├── services/           # API 服务层
│   ├── hooks/              # 自定义 Hooks
│   └── types.ts            # TypeScript 类型定义
└── .env.local              # 环境变量（不提交到 Git）
```

## 核心功能模块

### 1. 业务管理
- **线索跟进** (`/dashboard/leads`) - 线索列表管理
- **客户回访** (`/dashboard/daily-leads`) - 每日线索记录
- **老师面试** (`/dashboard/teacher-candidates`) - 教师面试管理
- **老师库存管理** (`/dashboard/teachers`) - 教师资源管理
- **学生管理** (`/dashboard/students`) - 学生信息管理

### 2. 订单管理
- **试听课** (`/dashboard/trial-lessons`) - 试听课程管理
- **正式课** (`/dashboard/formal-orders`) - 正式订单管理

### 3. 教务管理
- **排课管理** (`/dashboard/schedule`) - 课程安排
- **课程日历** (`/dashboard/calendar`) - 日历视图

### 4. 待办事项
- **待办任务** (`/dashboard/tasks`) - 任务管理
- **异动记录** (`/dashboard/transactions`) - 变更记录

### 5. 系统管理
- **字典管理** (`/dashboard/dictionaries`) - 数据字典
- **用户管理** (`/dashboard/accounts`) - 账号管理
- **角色管理** (`/dashboard/roles`) - 权限角色
- **销售人员** (`/dashboard/wechat-accounts`) - 销售微信账号
- **数据同步** (`/dashboard/sync`) - 数据同步
- **ClassIn SDK** (`/dashboard/classin-sdk`) - ClassIn 集成

## 权限系统

### 角色定义
- `admin` - 管理员
- `operator` - 运营人员
- `sales` - 销售人员
- `head_teacher` - 主管教师
- `teacher` - 教师
- `academic_affairs` - 教务
- `finance` - 财务
- `hr` - 人事

### 权限检查
使用 `usePermission` Hook 进行权限检查：

```typescript
const { leads } = usePermission()

// 检查权限
if (leads.create()) {
  // 有创建权限
}
```

## 认证系统

### Token 机制
项目使用 Supabase 的双 Token 机制实现自动续期：

- **access_token**: 访问令牌，有效期 1 小时
- **refresh_token**: 刷新令牌，有效期 30 天

### 自动刷新流程

1. **登录时**：同时存储 access_token 和 refresh_token 到 localStorage
2. **后台定时检查**：每 30 秒检查一次 token 是否即将过期（剩余 < 5 分钟）
3. **自动刷新**：token 即将过期时，后台自动调用刷新 API 获取新 token
4. **401 错误处理**：API 请求返回 401 时，自动刷新 token 并重试原请求
5. **刷新失败**：重试 3 次（指数退避），失败后清除认证信息并跳转登录页

### 核心 API

**登录**：`POST /api/auth/signin`
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**响应**：
```json
{
  "data": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1706925600,
    "user": { ... }
  }
}
```

**刷新 Token**：`POST /api/auth/refresh`
```json
{
  "refresh_token": "refresh_token"
}
```

### 客户端使用

**自动刷新**（Dashboard 中自动启用）：
```typescript
import { useTokenRefresh } from "@/lib/hooks/useTokenRefresh"

function Dashboard() {
  // 启动 token 自动刷新
  useTokenRefresh()
  // ...
}
```

**手动刷新**：
```typescript
import { tokenRefreshManager } from "@/lib/tokenRefreshManager"

const session = await tokenRefreshManager.refreshToken()
```

**检查 Token 是否即将过期**：
```typescript
const isExpiringSoon = tokenRefreshManager.isTokenExpiringSoon(300) // 5 分钟
```

### 多标签页同步

使用 BroadcastChannel API 实现多标签页 token 同步：
- 一个标签页刷新 token 后，其他标签页自动更新
- 避免多个标签页同时刷新 token（并发控制）

### 存储结构

**localStorage**：
```json
{
  "supabase.auth.session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1706925600,
    "user": { ... }
  }
}
```

兼容旧格式：
```json
{
  "supabase.auth.token": "jwt_token"
}
```

## 数据库表

主要表结构：
- `user_profiles` - 用户档案
- `leads` - 线索
- `daily_leads` - 每日线索
- `teacher_candidates` - 教师候选
- `teachers` - 教师
- `students` - 学生
- `trial_lessons` - 试听课程
- `formal_orders` - 正式订单
- `wechat_accounts` - 微信账号
- `transactions` - 异动记录
- `dictionaries` - 数据字典

## 开发指南

### 运行项目

```bash
npm install
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm start
```

### Git 提交规范

提交信息使用中文，清晰描述改动内容。

### 重要注意事项

1. **环境变量**: `.env.local` 文件不要提交到 Git
2. **RLS 策略**: Supabase Row Level Security 可能阻止客户端查询，使用服务端 API (`supabaseServer`) 绕过
3. **认证流程**: 使用 localStorage 存储token，通过 Authorization header 传递
4. **权限控制**: 前端使用 `usePermission` Hook，后端需要在 API 中验证

## 最近更新

### 2025-12-31
- 重构侧边栏菜单结构，按照客户业务流程组织
- 新增线索：运营人员字段改为下拉选择，默认为当前用户
- 创建 UserProfilesService 和 /api/user-profiles 端点

### 2025-12-30
- 修复权限系统用户认证问题
- 创建 /api/auth/profile 服务端端点

## 联系方式

如有问题，请查看项目文档或联系开发团队。
