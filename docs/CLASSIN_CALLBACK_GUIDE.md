# ClassIn 回调接口使用指南

## 概述

本文档介绍如何使用和测试 ClassIn 回调接口。该接口用于接收来自 ClassIn 系统的各种事件通知。

## 接口信息

- **URL**: `/api/classin/callback`
- **方法**: `POST`
- **内容类型**: `application/json`

## 环境配置

在 `.env.local` 文件中设置以下环境变量：

```env
CLASSIN_SECRET=your-secret-key-here
```

## 请求格式

### 基础字段

所有回调请求都包含以下基础字段：

```json
{
  "SID": 12345,           // 学校ID
  "Cmd": "raiseHand",     // 命令类型
  "Msg": "optional",     // 消息内容（可选）
  "SafeKey": "md5_hash", // 安全密钥
  "TimeStamp": 1640995200 // 时间戳
}
```

### SafeKey 生成规则

SafeKey 使用 MD5 哈希算法生成：

```
SafeKey = MD5(CLASSIN_SECRET + TimeStamp)
```

## 支持的消息类型

### 课堂互动类

- `raiseHand` - 举手
- `reward` - 奖励
- `answer` - 答题器
- `grab` - 抢答器
- `onStage` - 上下台
- `muteAll` - 全体静音
- `mute` - 个人静音

### 教室管理类

- `enterRoom` - 进入教室
- `leaveRoom` - 离开教室
- `help` - 求助
- `extendLesson` - 延长课节

### 技术相关类

- `networkStatus` - 网络状态
- `deviceCheck` - 设备检测

### 课程相关类

- `lessonSummary` - 课后汇总
- `lessonEvaluation` - 课程评价
- `lessonRecord` - 录课文件
- `recordStart` - 开始录课
- `blackboardImage` - 板书图片

### 直播相关类

- `liveLogin` - 直播登录
- `liveBooking` - 直播预约
- `liveView` - 直播观看
- `liveLike` - 直播点赞
- `liveProductClick` - 直播商品点击

### 数据统计类

- `quizResult` - 答题统计
- `webPlayback` - 网页回放
- `clientPlayback` - 客户端回放

### 系统类

- `Test` - 测试消息
- `auth` - 授权
- `fileConvert` - 文件转换
- `accountCancel` - 账号注销
- `changePhone` - 更换手机号
- `subAccount` - 子账号设置

## 响应格式

### 成功响应

```json
{
  "error_info": {
    "errno": 1,
    "error": "程序正常执行"
  }
}
```

### 错误响应

```json
{
  "error_info": {
    "errno": 0,
    "error": "错误描述"
  }
}
```

## 测试方法

### 1. 使用测试脚本

```bash
# 确保开发服务器运行
npm run dev

# 在另一个终端运行测试
npx tsx scripts/test-classin-callback.ts
```

### 2. 手动测试

使用 curl 命令测试：

```bash
# 生成时间戳和 SafeKey
TIMESTAMP=$(date +%s)
SAFEKEY=$(echo -n "your-secret-key$TIMESTAMP" | md5sum | cut -d' ' -f1)

# 发送测试请求
curl -X POST http://localhost:3000/api/classin/callback \
  -H "Content-Type: application/json" \
  -d "{
    \"SID\": 12345,
    \"Cmd\": \"Test\",
    \"Msg\": \"Test message\",
    \"SafeKey\": \"$SAFEKEY\",
    \"TimeStamp\": $TIMESTAMP
  }"
```

### 3. 使用 Postman

1. 创建新的 POST 请求
2. URL: `http://localhost:3000/api/classin/callback`
3. Headers: `Content-Type: application/json`
4. Body: 选择 raw JSON，输入测试数据

## 错误处理

### 常见错误码

- `400` - 缺少必要字段
- `401` - SafeKey 验证失败
- `405` - 请求方法不允许
- `500` - 服务器内部错误

### 调试建议

1. 检查环境变量 `CLASSIN_SECRET` 是否正确设置
2. 确认 SafeKey 生成算法是否正确
3. 检查时间戳是否在合理范围内（建议5分钟内）
4. 查看服务器日志获取详细错误信息

## 日志查看

开发环境下，回调处理日志会输出到控制台：

```bash
# 查看详细日志
npm run dev 2>&1 | grep -E "(ClassIn|回调|SafeKey)"
```

## 生产部署注意事项

1. 确保 `CLASSIN_SECRET` 环境变量已设置
2. 配置正确的回调 URL 到 ClassIn 系统
3. 监控接口响应时间和错误率
4. 定期检查日志文件
5. 考虑添加请求限流和防护措施

## 相关文件

- `lib/services/classin/callback-types.ts` - 类型定义
- `lib/services/classin/callback-handler.ts` - 消息处理逻辑
- `app/api/classin/callback/route.ts` - API 路由
- `scripts/test-classin-callback.ts` - 测试脚本

## 故障排除

### 问题：SafeKey 验证失败

**解决方案**：
1. 检查 `CLASSIN_SECRET` 环境变量
2. 确认 MD5 计算逻辑
3. 验证时间戳格式

### 问题：消息未被处理

**解决方案**：
1. 检查 `Cmd` 字段是否在支持列表中
2. 查看控制台日志确认消息接收情况
3. 检查对应处理函数是否有异常

### 问题：响应超时

**解决方案**：
1. 检查数据库连接
2. 优化处理逻辑
3. 考虑异步处理长时间操作
