# 日志系统使用指南

## 概述

项目使用统一的日志系统 (`lib/logger.ts`)，提供结构化、可配置、安全的日志功能。

## 核心特性

### 1. 日志级别

- **error**: 错误级别，生产环境会输出
- **warn**: 警告级别，生产环境会输出
- **info**: 信息级别，仅开发环境输出
- **debug**: 调试级别，仅开发环境输出

### 2. 环境区分

- **开发环境**: 输出所有级别的日志，带颜色标记
- **生产环境**: 只输出 error 和 warn 级别，不带颜色

### 3. 敏感信息自动过滤

自动过滤以下敏感字段（值替换为 `***`）：
- `password`
- `token`
- `accessToken`
- `refreshToken`
- `authorization`
- `secret`
- `apiKey`
- `api_key`

### 4. 结构化输出

每条日志包含：
- ISO 8601 时间戳
- 日志级别
- 上下文标签
- 消息内容
- 结构化数据（JSON 格式）

## 使用方法

### 方法 1: 使用 Logger 类（推荐）

适用于需要上下文标签的场景：

```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Signup')

// 在代码中使用
logger.info('用户注册尝试', { email, name })
logger.error('注册失败', { message: error.message, status: error.status })
logger.warn('注册请求缺少必填字段')
logger.debug('调试信息', { userId, sessionId })
```

### 方法 2: 使用默认导出

适用于简单场景，不需要上下文标签：

```typescript
import { logger } from '@/lib/logger'

logger.info('应用启动')
logger.error('严重错误', { error: err.message })
```

## 使用示例

### API 路由

```typescript
// app/api/auth/signin/route.ts
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth:Signin')

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  logger.info('用户登录尝试', { email, passwordLength: password?.length })

  try {
    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logger.error('认证失败', {
        message: error.message,
        status: error.status,
      })
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    logger.info('登录成功', { userId: data.user?.id, email: data.user?.email })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('登录 API 异常', {
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
```

### React Hooks

```typescript
// hooks/useAuth.ts
import { createLogger } from '@/lib/logger'

const logger = createLogger('useAuth')

export function useAuth() {
  useEffect(() => {
    const checkSession = async () => {
      logger.debug('检查会话状态', { hasToken: !!token })

      const response = await api.get('/api/auth/session')

      if (response.ok) {
        const { data } = await response.json()
        logger.info('用户已登录', { email: data.user.email })
      }
    }
    checkSession()
  }, [])
}
```

### 服务端操作

```typescript
// app/actions/leads.ts
import { createLogger } from '@/lib/logger'

const logger = createLogger('Actions:Leads')

export async function createLead(data: LeadFormData) {
  logger.info('创建新线索', { name: data.name, email: data.email })

  try {
    const lead = await db.leads.create({ data })
    logger.info('线索创建成功', { leadId: lead.id })
    return lead
  } catch (error) {
    logger.error('线索创建失败', {
      message: error.message,
      formData: data
    })
    throw error
  }
}
```

## 日志输出示例

### 开发环境（带颜色）

```
2025-12-24T16:30:45.123Z INFO [Auth:Signin] 用户登录尝试
{
  "email": "user@example.com",
  "passwordLength": 8
}

2025-12-24T16:30:46.456Z ERROR [Auth:Signin] 认证失败
{
  "message": "Invalid login credentials",
  "status": 400
}
```

### 生产环境（无颜色）

```
2025-12-24T16:30:46.456Z ERROR [Auth:Signin] 认证失败
{
  "message": "Invalid login credentials",
  "status": 400
}
```

### 敏感信息过滤示例

```typescript
logger.info('用户登录', {
  email: 'user@example.com',
  password: 'secret123',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
})
```

输出：
```
2025-12-24T16:30:45.123Z INFO [] 用户登录
{
  "email": "user@example.com",
  "password": "sec***",
  "token": "eyJ***"
}
```

## 最佳实践

### 1. 选择合适的日志级别

- **error**: 错误导致功能失败
- **warn**: 潜在问题，但不影响主要功能
- **info**: 重要的业务流程节点
- **debug**: 详细的调试信息

### 2. 使用有意义的上下文标签

```typescript
// ✅ 好的上下文标签
const logger = createLogger('Auth:Signup')
const logger = createLogger('Database:Leads')
const logger = createLogger('API:Webhook')

// ❌ 不好的上下文标签
const logger = createLogger('logger')
const logger = createLogger('test')
```

### 3. 记录关键业务数据

```typescript
// ✅ 记录关键业务数据
logger.info('订单创建成功', {
  orderId: order.id,
  userId: order.userId,
  amount: order.total,
})

// ❌ 记录过多无用数据
logger.info('函数调用', { allVariables })
```

### 4. 错误日志包含堆栈信息

```typescript
// ✅ 包含堆栈信息
logger.error('API 调用失败', {
  message: error.message,
  stack: error.stack,
  endpoint: '/api/leads',
})

// ❌ 缺少关键信息
logger.error('出错了')
```

### 5. 客户端日志谨慎使用

客户端日志会暴露在浏览器控制台，避免记录敏感信息：

```typescript
// ✅ 客户端只记录必要信息
logger.info('用户已登录', { email: user.email })

// ❌ 避免在客户端记录敏感数据
logger.debug('用户数据', { user: fullUserData, token: accessToken })
```

## 配置

### 环境变量

日志级别由 `NODE_ENV` 自动控制：

- `NODE_ENV=production`: 只输出 error 和 warn
- `NODE_ENV=development`: 输出所有级别

### 自定义敏感字段

如需添加更多敏感字段，编辑 `lib/logger.ts`：

```typescript
const SENSITIVE_FIELDS = [
  'password',
  'token',
  // 添加你的敏感字段
  'customSecretField',
]
```

## 未来扩展

可以考虑的增强功能：

1. **日志持久化**: 将日志发送到外部服务（如 Sentry、LogRocket）
2. **日志聚合**: 在服务端收集客户端日志
3. **性能监控**: 添加性能相关的日志
4. **A/B 测试标记**: 记录实验分组信息
