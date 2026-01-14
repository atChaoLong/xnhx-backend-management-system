# ClassIn 课堂结束回调处理说明

## 概述

当 ClassIn 课堂结束时，ClassIn 会发送 "End" 回调消息到系统。系统接收后会：
1. 更新课节状态为已完成
2. 记录实际上课时长
3. 保存详细的课堂统计数据
4. 更新课程进度
5. 记录老师课时消耗

## 数据结构

### End 回调数据示例

```json
{
  "ClassID": 1019442515,
  "ActionTime": 1768317950,
  "CourseID": 293567505,
  "TimeStamp": 1768318551,
  "SafeKey": "1e65d18b0b75209848b6bbd76b1156ac",
  "Cmd": "End",
  "CloseTime": 1768319700,
  "StartTime": 1768314000,
  "SID": 1304802,
  "_id": "696663ffcd344e686b437cdc",
  "RealCloseTime": 1768317860,
  "Data": {
    "stageEnd": {
      "88288032": { "UpTotal": 4046, "DownCount": 1, "UpCount": 1, "DownTotal": 0 },
      "42755570": { "UpTotal": 3830, "DownCount": 1, "UpCount": 1, "DownTotal": 0 }
    },
    "silenceEnd": {
      "SilenceAll": { "Count": 0, "Total": 0 },
      "Persons": {
        "88288032": { "Total": 4046 },
        "42755570": { "Total": 3830 }
      }
    },
    "screenchangeEnd": {
      "88288032": { "WindowTotal": 0, "WindowCount": 0, "Details": [], "FullTotal": 0, "FullCount": 0 },
      "42755570": { "WindowTotal": 0, "WindowCount": 0, "Details": [], "FullTotal": 0, "FullCount": 0 }
    },
    "mdscreenEnd": { "Count": 1, "Total": 3999 },
    "authorizeEnd": {
      "42755570": { "Count": 1, "Total": 3573 }
    },
    "inoutEnd": {
      "88288032": {
        "Identity": 3,
        "Total": 4046,
        "Details": [
          { "Device": 9, "Type": "In", "Time": 1768313814 },
          { "Device": 9, "Type": "Out", "Time": 1768317860 }
        ],
        "Deputies": [...]
      }
    },
    "muteEnd": {
      "Persons": {
        "88288032": { "Total": 4046 },
        "42755570": { "Total": 3830 }
      },
      "MuteAll": { "Count": 0, "Total": 0 }
    },
    "equipmentsEnd": {
      "42755570": {
        "Microphone": { "Total": 3517, "TotalNotDisabled": 3517 },
        "Camera": { "Total": 3830, "TotalNotDisabled": 3830 }
      },
      "88288032": {
        "Microphone": { "Total": 4046, "TotalNotDisabled": 4046 },
        "Camera": { "Total": 4031, "TotalNotDisabled": 4031 }
      }
    }
  }
}
```

## 数据库表结构

### class_session_statistics

用于存储课堂详细统计数据：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| session_id | TEXT | 关联 class_sessions.id |
| classroom_id | TEXT | ClassIn 课堂 ID |
| student_id | INTEGER | 学生 ID (ClassIn SID) |
| statistics | JSONB | 完整统计数据 |
| stage_up_total | JSONB | 上讲台统计（提取） |
| inout_details | JSONB | 进出课堂详情（提取） |
| equipment_usage | JSONB | 设备使用情况（提取） |
| screen_sharing | JSONB | 屏幕共享统计（提取） |
| created_at | TIMESTAMPTZ | 创建时间 |

## 安装步骤

### 1. 执行数据库迁移

在 Supabase SQL Editor 中执行：

```bash
# 复制迁移文件内容
cat supabase/migrations/045_add_class_session_statistics.sql
```

或在 Supabase Dashboard → SQL Editor 中手动执行迁移脚本。

### 2. 验证表创建

```sql
-- 检查表是否创建成功
SELECT * FROM information_schema.tables
WHERE table_name = 'class_session_statistics';

-- 查看表结构
\d+ public.class_session_statistics
```

## 处理流程

```
ClassIn End 回调
    ↓
验证 SafeKey
    ↓
查找课节记录 (by ClassID)
    ↓
计算实际上课时长
    ↓
更新课节状态:
  - status → 'completed'
  - actual_start_time
  - actual_end_time
  - actual_duration_minutes
    ↓
保存统计数据:
  - class_session_statistics 表
    ↓
更新课程统计:
  - courses.session_count
  - courses.course_consumption_info
    ↓
更新老师课时:
  - teachers.total_hours += (duration / 60)
```

## 统计数据说明

### 1. stageEnd - 上讲台统计
- **UpTotal**: 上讲台总时长（秒）
- **DownCount**: 下讲台次数
- **UpCount**: 上讲台次数
- **DownTotal**: 下讲台总时长（秒）

### 2. silenceEnd - 静音统计
- **SilenceAll**: 全体静音统计
  - Count: 静音次数
  - Total: 静音总时长
- **Persons**: 个人静音统计
  - Total: 个人静音总时长

### 3. screenchangeEnd - 切屏统计
- **WindowTotal**: 窗口切屏总次数
- **WindowCount**: 窗口切屏次数
- **FullTotal**: 全屏切屏总次数
- **FullCount**: 全屏切屏次数
- **Details**: 切屏详情列表

### 4. mdscreenEnd - 屏幕共享统计
- **Count**: 共享次数
- **Total**: 共享总时长（秒）

### 5. authorizeEnd - 授权统计
- **Count**: 授权次数
- **Total**: 授权总时长（秒）

### 6. inoutEnd - 进出课堂统计
- **Identity**: 身份标识
- **Total**: 在课堂总时长（秒）
- **Details**: 进出详情
  - Device: 设备类型
  - Type: In/Out
  - Time: 时间戳

### 7. muteEnd - 麦克风静音统计
- **MuteAll**: 全员静音统计
- **Persons**: 个人静音统计

### 8. equipmentsEnd - 设备使用统计
- **Microphone**: 麦克风使用
  - Total: 总时长
  - TotalNotDisabled: 未禁用总时长
- **Camera**: 摄像头使用
  - Total: 总时长
  - TotalNotDisabled: 未禁用总时长

## 查询示例

### 查询某节课的统计数据

```sql
SELECT
  session_id,
  classroom_id,
  statistics->'stageEnd' as stage_stats,
  statistics->'equipmentsEnd' as equipment_stats,
  created_at
FROM class_session_statistics
WHERE session_id = 'your-session-id';
```

### 查询某学生的课堂参与度

```sql
SELECT
  session_id,
  statistics->'inoutEnd'->'Persons'->'SID' as participation,
  statistics->'stageEnd'->'SID' as stage_time,
  created_at
FROM class_session_statistics
WHERE student_id = 1304802
ORDER BY created_at DESC;
```

### 统计老师实际课时

```sql
SELECT
  t.name as teacher_name,
  t.total_hours,
  COUNT(css.id) as total_sessions,
  SUM(cs.actual_duration_minutes) / 60.0 as actual_hours
FROM teachers t
JOIN class_sessions cs ON cs.teacher_id = t.id
LEFT JOIN class_session_statistics css ON css.session_id = cs.id
WHERE cs.status = 'completed'
GROUP BY t.id, t.name, t.total_hours
ORDER BY actual_hours DESC;
```

## 日志和监控

处理过程会输出以下日志：

```javascript
// 收到回调
logger.info('收到课堂结束回调', { classId, courseId });

// 找到课节
logger.info('找到课节记录', { sessionId, courseId });

// 更新状态
logger.info('课节状态已更新为已完成', { sessionId, actualDuration });

// 保存统计
logger.info('课堂统计数据已保存', { sessionId });

// 更新课时
logger.info('老师课时已更新', { teacherId, addedHours, newHours });

// 完成
logger.info('课堂结束处理完成', { sessionId, courseId, actualDurationMinutes });
```

## 错误处理

所有错误都被捕获并记录，不会影响 ClassIn 回调响应：

```javascript
try {
  // 处理逻辑
} catch (error) {
  logger.error('处理课堂结束时出错', { error, stack });
  // 不抛出错误，避免影响 ClassIn 的回调重试机制
}
```

## 注意事项

1. **时间戳处理**: ClassIn 使用 Unix 时间戳（秒），需要转换为 ISO 字符串
2. **时长计算**: `actual_duration_minutes = (RealCloseTime - StartTime) / 60`
3. **ID 类型**: ClassID 是数字，数据库存储为 TEXT
4. **统计数据**: 完整保存为 JSONB，同时提取关键字段便于查询
5. **RLS 策略**: 只有认证用户可以读写统计数据

## 相关文件

- `lib/services/classin/callback-handler.ts` - 回调处理逻辑
- `lib/services/classin/callback-types.ts` - 类型定义
- `supabase/migrations/045_add_class_session_statistics.sql` - 数据库迁移
- `app/api/classin/callback/route.ts` - 回调接收端点

## 后续优化建议

1. 创建定时任务统计报表
2. 添加学生学习质量分析
3. 计算老师教学效果评分
4. 监控异常数据（如过短时长、频繁进出等）
5. 实时课堂数据推送（WebSocket）
