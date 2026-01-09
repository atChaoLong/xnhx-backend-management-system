# ClassIn 课节管理 API

本文档介绍了 ClassIn 课节管理的修改和删除功能的实现和使用方法。

## 功能概述

新增的课节管理功能包括：
- **修改课节**: 修改已创建课节的基本信息、时间、教师等
- **删除课节**: 删除指定的课节

## API 端点

### 1. 修改课节

**端点**: `PUT /api/classin/classrooms`

**请求体**:
```json
{
  "SID": "your-classin-sid",
  "safeKey": "your-classin-safekey", 
  "timeStamp": "1484719085",
  "courseId": 442447,
  "classId": 23644,
  "className": "修改后的课节名称",
  "beginTime": 1484739085,
  "endTime": 1484739085,
  "teacherUid": 1001001,
  "teacherName": "教师姓名",
  "folderId": "1",
  "record": 1,
  "live": 1,
  "replay": 1,
  "assistantUids": [1001002, 1001003],
  "watchByLogin": 0,
  "allowUnloggedChat": 1
}
```

**参数说明**:
- `SID` (必需): 机构SID
- `safeKey` (必需): 安全密钥
- `timeStamp` (必需): 时间戳
- `courseId` (必需): 课程ID
- `classId` (必需): 课节ID
- `className` (可选): 课节名称
- `beginTime` (可选): 开始时间（Unix时间戳，秒）
- `endTime` (可选): 结束时间（Unix时间戳，秒）
- `teacherUid` (可选): 教师UID
- `teacherName` (可选): 教师姓名
- `folderId` (可选): 云盘目录ID
- `record` (可选): 录课（1: 开启, 0: 关闭）
- `live` (可选): 直播（1: 开启, 0: 关闭）
- `replay` (可选): 回放（1: 开启, 0: 关闭）
- `assistantUids` (可选): 联席教师UID列表
- `watchByLogin` (可选): 登录观看（1: 需要, 0: 不需要）
- `allowUnloggedChat` (可选): 未登录用户聊天（1: 允许, 0: 不允许）

### 2. 删除课节

**端点**: `DELETE /api/classin/classrooms`

**查询参数**:
- `SID` (必需): 机构SID
- `safeKey` (必需): 安全密钥
- `timeStamp` (必需): 时间戳
- `courseId` (必需): 课程ID
- `classId` (必需): 课节ID

**示例**:
```
DELETE /api/classin/classrooms?SID=1234567&safeKey=0f7781b3033527a8cc2b1abbf45a5fd2&timeStamp=1484719085&courseId=442447&classId=23644
```

### 3. 测试端点

**端点**: `GET/POST /api/classin/classrooms/test`

**用途**: 用于测试修改和删除功能

**修改测试**:
```json
POST /api/classin/classrooms/test
{
  "action": "edit",
  "SID": "your-classin-sid",
  "safeKey": "your-classin-safekey",
  "timeStamp": "1484719085",
  "courseId": 442447,
  "classId": 23644,
  "className": "修改后的课节名称"
}
```

**删除测试**:
```json
POST /api/classin/classrooms/test
{
  "action": "delete",
  "SID": "your-classin-sid",
  "safeKey": "your-classin-safekey", 
  "timeStamp": "1484719085",
  "courseId": 442447,
  "classId": 23644
}
```

## 环境配置

在 `.env.local` 文件中配置以下环境变量：

```env
# ClassIn API 配置
CLASSIN_SID="your-classin-sid"
CLASSIN_SECRET="your-classin-secret"
CLASSIN_API_URL="https://dynamic.eeo.cn"
```

## 实现架构

### 1. 类型定义 (`lib/services/classin/types.ts`)

新增了以下接口：
- `EditClassParams`: 修改课节的参数类型
- `DeleteClassParams`: 删除课节的参数类型

### 2. API 客户端 (`lib/services/classin/api.ts`)

新增方法：
- `editClass()`: 修改课节信息
- `deleteClass()`: 删除课节

### 3. 服务层 (`lib/services/classin.ts`)

新增方法：
- `editClass()`: 修改课节的业务逻辑封装
- `deleteClass()`: 删除课节的业务逻辑封装

### 4. API 路由 (`app/api/classin/classrooms/route.ts`)

新增HTTP方法处理器：
- `PUT()`: 处理修改课节请求
- `DELETE()`: 处理删除课节请求

## 数据库同步

修改和删除操作会同时：
1. 调用 ClassIn API
2. 同步更新本地数据库 (`classroom_classin` 表)

## 错误处理

所有API端点都包含完善的错误处理：
- 参数验证
- API调用异常捕获
- 数据库操作错误处理
- 详细的错误信息返回

## 使用示例

### 修改课节示例

```javascript
const editClass = async () => {
  try {
    const response = await fetch('/api/classin/classrooms', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        SID: 'your-classin-sid',
        safeKey: 'your-classin-safekey',
        timeStamp: '1484719085',
        courseId: 442447,
        classId: 23644,
        className: '新的课节名称',
        beginTime: 1484739085,
        endTime: 1484739085,
        teacherUid: 1001001,
      }),
    });
    
    const result = await response.json();
    console.log('修改成功:', result);
  } catch (error) {
    console.error('修改失败:', error);
  }
};
```

### 删除课节示例

```javascript
const deleteClass = async () => {
  try {
    const response = await fetch(
      '/api/classin/classrooms?SID=your-classin-sid&safeKey=your-classin-safekey&timeStamp=1484719085&courseId=442447&classId=23644',
      {
        method: 'DELETE',
      }
    );
    
    const result = await response.json();
    console.log('删除成功:', result);
  } catch (error) {
    console.error('删除失败:', error);
  }
};
```

## 注意事项

1. **认证方式**: 使用传统的SID/safeKey认证，不需要LMS API的签名
2. **时间戳**: 所有时间参数使用Unix时间戳（秒）
3. **权限控制**: 确保API密钥有相应的操作权限
4. **数据一致性**: API会尝试同步本地数据库，但如果ClassIn API操作失败，本地数据不会回滚
5. **测试环境**: 建议先在测试环境中验证功能正常后再在生产环境使用

## 故障排除

### 常见错误

1. **认证失败**: 检查 `CLASSIN_SID` 和 `CLASSIN_SECRET` 配置
2. **参数缺失**: 确保必需的 `SID`、`safeKey`、`timeStamp`、`courseId`、`classId` 参数已提供
3. **权限不足**: 验证API密钥是否有相应的操作权限
4. **网络问题**: 检查服务器能否访问 ClassIn API 端点

### 调试建议

1. 使用测试端点 `/api/classin/classrooms/test` 进行功能验证
2. 查看服务器日志获取详细错误信息
3. 在开发环境中启用详细错误堆栈跟踪
