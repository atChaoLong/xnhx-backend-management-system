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
| session_id | UUID | 关联 class_sessions.id (外键) |
| classroom_id | TEXT | ClassIn 课堂 ID |
| student_id | INTEGER | 学生 ID (ClassIn SID) |
| statistics | JSONB | 完整统计数据 |
| stage_up_total | JSONB | 上讲台统计（提取） |
| inout_details | JSONB | 进出课堂详情（提取） |
| equipment_usage | JSONB | 设备使用情况（提取） |
| screen_sharing | JSONB | 屏幕共享统计（提取） |
| handsup_details | JSONB | 举手统计（提取） |
| award_details | JSONB | 奖励统计（提取） |
| created_at | TIMESTAMPTZ | 创建时间 |

### class_student_participation

用于存储学生参与记录（从 inoutEnd 数据提取）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| session_id | UUID | 关联 class_sessions.id (外键) |
| student_uid | INTEGER | 学生 UID (ClassIn) |
| identity | INTEGER | 身份：1=学生, 2=旁听, 3=老师, 4=联席教师 |
| total_time_seconds | BIGINT | 在教室总时长（秒） |
| actual_duration_minutes | INTEGER | 实际参与时长（分钟） |
| first_in_time | TIMESTAMPTZ | 首次进入教室时间 |
| last_out_time | TIMESTAMPTZ | 最后离开教室时间 |
| attendance_status | VARCHAR(20) | 出勤状态：absent/present/late |
| inout_details | JSONB | 进出教室详情（JSON） |
| created_at | TIMESTAMPTZ | 创建时间 |

## 安装步骤

### 1. 执行数据库迁移

在 Supabase SQL Editor 中按顺序执行以下迁移脚本：

```bash
# 1. 创建课堂统计表
cat supabase/migrations/045_add_class_session_statistics.sql

# 2. 创建学生参与记录表
cat supabase/migrations/046_add_class_student_participation.sql

# 3. 添加举手和奖励统计字段
cat supabase/migrations/047_add_handsup_award_to_statistics.sql
```

或在 Supabase Dashboard → SQL Editor 中手动执行这三个迁移脚本。

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
解析数据:
  - ClassID: 商家ID（不用于查找）
  - CourseID: 班级ID
  - SID: 学生ID
  - StartTime: 开始时间
  - CloseTime: 计划结束时间
  - RealCloseTime: 实际结束时间（可能不存在）
    ↓
计算实际结束时间（RealCloseTime 判断逻辑）:
  1. 判断是否有 RealCloseTime 字段
  2. 如果没有 RealCloseTime，使用 CloseTime
  3. 有 RealCloseTime：
     - RealCloseTime = 0 → 使用 CloseTime
     - RealCloseTime != 0 → 使用 min(RealCloseTime, CloseTime)
    ↓
查找课节记录:
  1. 通过 CourseID → courses.classin_course_id 找到课程
  2. 通过 course.id → class_sessions.course_id 找到课节
     → 找到状态为 'scheduled' 的最早课节
  3. 可选：如果课节的 classroom_id 未设置，更新为 ClassID
    ↓
计算实际上课时长
    ↓
更新课节状态:
  - status → 'completed'
  - actual_start_time
  - actual_end_time (使用计算出的最终结束时间)
  - actual_duration_minutes
    ↓
处理学生参与记录（从 inoutEnd 数据）:
  - 遍历 inoutEnd，提取每个学生（Identity = 1）的进出记录
  - 计算在教室总时长、首次进入、最后离开时间
  - 判断出勤状态：
    - 出席：参与时长 >= 课堂时长 * 50%
    - 迟到：有参与但 < 50%
    - 缺席：无参与记录
  - 保存到 class_student_participation 表
    ↓
保存统计数据:
  - class_session_statistics 表（完整 Data 对象）
    ↓
更新课程统计:
  - courses.session_count
  - courses.course_consumption_info
    ↓
更新老师课时:
  - teachers.total_hours += (duration / 60)
```

**重要说明**：
- **ClassID**: ClassIn 提供的商家ID，**不用于查找课节**
- **CourseID**: 班级ID，对应 `courses.classin_course_id`
- **RealCloseTime**: 提前下课功能产生的实际结束时间，需要与 CloseTime 比较取较小值
- 通过 `CourseID` → `courses.id` → `class_sessions.course_id` 链式查找
- 找到 `status = 'scheduled'` 的最早课节（按 `scheduled_date` 排序）
- 从 `inoutEnd` 数据提取学生参与记录，只保存 `Identity = 1`（学生）的记录

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
WHERE session_id = 'your-session-uuid'::uuid;
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

1. **不使用 ClassID**: ClassID 是 ClassIn 提供给商家的ID，**不能用于查找课节**
2. **使用 CourseID**: 通过 CourseID（班级ID）链式查找：`CourseID → courses → class_sessions`
3. **RealCloseTime 判断逻辑**（重要）：
   - 场景：客户端和后台增加了提前下课功能
   - 判断步骤：
     1. 判断是否有 RealCloseTime 字段（掉线、异常退出可能没有）
     2. 如果没有 RealCloseTime 字段 → 使用 CloseTime
     3. 有 RealCloseTime 字段：
        - RealCloseTime = 0 → 使用 CloseTime
        - RealCloseTime != 0 → 使用 min(RealCloseTime, CloseTime)
   - 示例：
     ```javascript
     let finalCloseTime = closeTime;
     if (realCloseTime !== undefined && realCloseTime !== null) {
       if (realCloseTime === 0) {
         finalCloseTime = closeTime;
       } else {
         finalCloseTime = Math.min(realCloseTime, closeTime);
       }
     }
     ```
4. **时间戳处理**: ClassIn 使用 Unix 时间戳（秒），需要转换为 ISO 字符串
5. **时长计算**: `actual_duration_minutes = (finalCloseTime - StartTime) / 60`
6. **课节匹配**: 找到 `status = 'scheduled'` 的最早课节（按排课日期排序）
7. **学生参与记录**: 从 `inoutEnd` 数据提取，只保存 `Identity = 1`（学生）的记录
8. **出勤判断**:
   - 出席 (present)：参与时长 >= 课堂时长 × 50%
   - 迟到 (late)：有参与但 < 50%
   - 缺席 (absent)：无参与记录
9. **统计数据**: 完整保存为 JSONB，同时提取关键字段便于查询
10. **RLS 策略**: 只有认证用户可以读写统计数据

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
