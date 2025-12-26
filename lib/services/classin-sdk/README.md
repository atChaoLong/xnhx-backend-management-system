# ClassIn SDK 集成指南

## 概述

本项目已集成 ClassIn 官方 SDK，提供稳定可靠的 API 访问方式。

### SDK vs 页面端接口

| 特性 | SDK (官方 API) | 页面端接口 |
|-----|---------------|-----------|
| **认证方式** | SID + SECRET | Cookie |
| **稳定性** | ✅ 生产级 | ❌ 测试用 |
| **功能** | 完整 API | 有限接口 |
| **推荐场景** | 生产环境 | 开发测试 |

## 配置步骤

### 1. 获取 API 凭证

1. 登录 ClassIn 管理后台
2. 进入：设置 → API设置
3. 获取：
   - SID（机构ID）
   - SECRET（API密钥）

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# ClassIn SDK 配置
CLASSIN_SID=your_sid_here
CLASSIN_SECRET=your_secret_here
CLASSIN_API_URL=api.eeo.cn  # 可选，默认值
```

### 3. 重启开发服务器

```bash
npm run dev
```

## 可用功能

### 用户管理
- **注册老师**: `/api/classin-sdk/register/teacher`
- **注册学生**: `/api/classin-sdk/register/student`

### 课程管理
- **创建课程**: `/api/classin-sdk/course`
- **创建单元**: `/api/classin-sdk/unit`
- **创建课堂**: `/api/classin-sdk/classroom`

### 完整流程（推荐）
- **一键创建**: `/api/classin-sdk/complete`
  - 自动完成：注册老师 → 创建课程 → 创建单元 → 创建课堂

## 使用示例

### 方式一：通过管理页面

访问：`http://localhost:3000/dashboard/classin-sdk`

提供可视化界面，支持所有功能。

### 方式二：通过 API 调用

#### 注册老师

```javascript
const response = await fetch('/api/classin-sdk/register/teacher', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telephone: '13910005001',
    nickname: '李老师',
    password: '123456'
  })
})

const data = await response.json()
// 返回: { success: true, data: { teacherUid: 91146378 } }
```

#### 创建课程

```javascript
const response = await fetch('/api/classin-sdk/course', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    courseName: 'Python编程入门班'
  })
})

const data = await response.json()
// 返回: { success: true, data: { courseId: 292535261 } }
```

#### 一键创建完整课程和课堂

```javascript
const response = await fetch('/api/classin-sdk/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    teacher: {
      telephone: '13910005001',
      nickname: '李老师',
      password: '123456'
    },
    course: {
      courseName: 'Python编程入门班'
    },
    unit: {
      name: '第一章'
    },
    classroom: {
      name: '第一节：Python环境搭建',
      startTime: '2025-12-27T14:00:00',
      endTime: '2025-12-27T15:30:00'
    }
  })
})

const data = await response.json()
// 返回:
// {
//   success: true,
//   data: {
//     teacherUid: 91146378,
//     courseId: 292535261,
//     unitId: 246385375,
//     classId: 1012043429,
//     activityId: 1087638748
//   }
// }
```

## SDK 文件结构

```
lib/services/classin-sdk/
├── index.js          # SDK 主入口
├── service.ts        # TypeScript 服务层封装
├── types.ts          # TypeScript 类型定义
├── core/
│   ├── api-v1.js     # API v1 实现
│   ├── api-v2.js     # API v2 实现
│   └── signature.js  # 签名工具
└── utils/
    ├── request.js    # HTTP 请求工具
    └── time.js       # 时间处理工具
```

## 常见错误

### 错误 101002005: 签名验证失败
**原因**: SID 或 SECRET 配置错误
**解决**: 检查 .env.local 中的配置是否正确

### 错误 101002006: 验签时间戳过期
**原因**: 服务器时间不准确
**解决**: 同步服务器时间

### 错误 136: 机构下没有该老师
**原因**: 老师未注册
**解决**: 先调用注册老师接口

### 错误 40020: 单元不存在
**原因**: 单元未创建
**解决**: 先调用创建单元接口

## 技术细节

### API v1 签名规则
```javascript
MD5(SECRET + timeStamp)
```

### API v2 签名规则
```javascript
MD5('排序后的参数&key=密钥')
```

## 获取帮助

- ClassIn 官方文档: https://www.eeo.cn
- SDK 源码位置: `/Users/t77yq/Desktop/classin/ClassIn-SDK/`

## 注意事项

1. **安全性**: 不要将 SID 和 SECRET 提交到代码仓库
2. **时间格式**: 使用 ISO 8601 格式或 Unix 时间戳
3. **错误处理**: 所有 API 都有统一的错误处理
4. **调试**: 开发环境下会自动开启调试模式
