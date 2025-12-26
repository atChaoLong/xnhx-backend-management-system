# ClassIn API 集成文档

## 概述

本项目已集成 ClassIn 页面端 API (https://dynamic.eeo.cn)，可以获取老师、学生、课程和课节等数据。

## 架构说明

### 文件结构

```
lib/services/
├── classin/
│   ├── types.ts          # TypeScript 类型定义
│   ├── api.ts            # API 客户端实现
│   └── ...
└── classin.ts            # 服务层业务逻辑

app/api/classin/
├── login/route.ts        # 登录 API
├── teachers/route.ts     # 老师列表 API
└── students/route.ts     # 学生列表 API

app/dashboard/
└── classin/page.tsx      # ClassIn 集成管理页面
```

### 核心组件

1. **ClassInApiClient** - API 客户端类
   - 使用 Cookie 认证
   - Session 管理（2小时有效期）
   - 自动处理请求头和错误

2. **ClassInService** - 服务层
   - 业务逻辑封装
   - 提供统一的数据接口
   - 类型安全的返回值

3. **API Routes** - Next.js API 路由
   - `/api/classin/login` - 登录接口
   - `/api/classin/teachers` - 获取老师列表
   - `/api/classin/students` - 获取学生列表

## 使用方法

### 1. 获取 Cookie

1. 在浏览器中打开 [console.eeo.cn](https://console.eeo.cn) 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 `Application` 标签
4. 左侧菜单中选择 `Cookies → https://console.eeo.cn`
5. 复制所有 Cookie（格式：`name1=value1; name2=value2; ...`）

示例 Cookie：
```
locationArgumentLang=zh-CN; PHPSESSID=7kbqm68pn5e6pvj4sfjb6v7u09; _eeos_uid=90814334; _eeos_useraccount=18982163676; _eeos_remember=1; _eeos_sub=1; _eeos_sid=1304802
```

### 2. 配置环境变量（可选）

创建 `.env.local` 文件：

```bash
# ClassIn API 基础 URL
NEXT_PUBLIC_CLASSIN_API_URL=https://dynamic.eeo.cn

# ClassIn 管理后台 URL
NEXT_PUBLIC_CLASSIN_CONSOLE_URL=https://console.eeo.cn
```

### 3. 测试连接

访问集成页面：`/dashboard/classin`

1. 将获取的 Cookie 粘贴到输入框
2. 点击"测试连接"按钮
3. 查看连接状态和数据统计

### 4. API 调用示例

#### 前端调用

```typescript
// 获取老师列表
const response = await fetch('/api/classin/teachers?page=1&pageSize=1000')
const data = await response.json()
console.log(data.data.list) // 老师列表
console.log(data.data.total) // 总数
```

#### 服务端调用

```typescript
import { classInService } from '@/lib/services/classin'

// 登录
classInService.login(cookieString)

// 获取老师列表
const teachers = await classInService.getTeachers({
  page: 1,
  pageSize: 1000,
})

// 搜索老师
const results = await classInService.searchTeachers({
  name: '张老师',
  page: 1,
  pageSize: 20,
})
```

## API 接口列表

### 已实现的接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 登录 | POST | /api/classin/login | 使用 Cookie 登录 |
| 老师列表 | GET | /api/classin/teachers | 获取老师列表 |
| 学生列表 | GET | /api/classin/students | 获取学生列表 |

### ClassIn 原生接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 老师列表 | POST | /coreapi/teacher/v1/searchTeacherList | 搜索老师 |
| 学生列表 | POST | /coreapi/student/v1/searchStudentList | 搜索学生 |
| 课程列表 | POST | /coreapi/course/v1/searchCourseList | 搜索课程 |
| 课节列表 | POST | /coreapi/class/v1/searchClassList | 搜索课节 |

## 类型定义

### 老师类型

```typescript
interface ClassInTeacher {
  uid: number
  name: string
  telephone: string
  email?: string
  subject?: string
  status: number
  created_at?: string
}
```

### 学生类型

```typescript
interface ClassInStudent {
  uid: number
  name: string
  telephone: string
  email?: string
  grade?: string
  class_name?: string
  status: number
  created_at?: string
}
```

### 分页响应

```typescript
interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
```

## 扩展开发

### 添加新的 API

1. 在 `lib/services/classin/api.ts` 中添加方法：

```typescript
async getCourses(params: PageParams): Promise<PageResponse<any>> {
  const response = await this.request<PageResponse<any>>(
    'POST',
    '/coreapi/course/v1/searchCourseList',
    params
  )
  return response.data
}
```

2. 在 `lib/services/classin.ts` 中添加服务方法：

```typescript
async getCourses(params?: PageParams): Promise<{
  list: ClassInCourse[]
  total: number
}> {
  const result = await this.apiClient.getCourses(params)
  return {
    list: result.list as ClassInCourse[],
    total: result.total,
  }
}
```

3. 创建 API 路由：

```typescript
// app/api/classin/courses/route.ts
export async function GET(request: NextRequest) {
  const result = await classInService.getCourses({
    page: 1,
    pageSize: 1000,
  })
  return NextResponse.json({ success: true, data: result })
}
```

## 安全注意事项

1. **Cookie 安全**
   - Cookie 仅用于服务端请求
   - 不要在客户端存储敏感 Cookie
   - 定期更新 Cookie（2小时有效期）

2. **生产环境**
   - 建议使用代理 API
   - 添加访问控制和认证
   - 记录 API 调用日志

3. **错误处理**
   - 所有 API 调用都应包含错误处理
   - Session 过期时自动提示用户重新登录
   - 网络错误时给出友好提示

## 故障排除

### 问题：登录失败

**可能原因**：
- Cookie 格式不正确
- Cookie 已过期
- 网络连接问题

**解决方法**：
- 重新获取 Cookie
- 检查网络连接
- 查看浏览器控制台错误信息

### 问题：Session 过期

**可能原因**：
- Cookie 超过2小时有效期

**解决方法**：
- 重新获取 Cookie
- 实现自动刷新机制

### 问题：API 返回错误

**可能原因**：
- 权限不足
- 参数错误
- ClassIn 服务异常

**解决方法**：
- 检查 Cookie 权限
- 验证请求参数
- 查看 ClassIn 官方文档

## 参考资源

- [ClassIn 官方文档](https://www.eeo.cn)
- 示例项目：`/Users/t77yq/Desktop/classin/classin-internal-api-demo`

## 更新日志

### 2025-12-26
- ✅ 初始集成完成
- ✅ 实现老师、学生列表接口
- ✅ 创建集成管理页面
- ✅ 完整的 TypeScript 类型定义
