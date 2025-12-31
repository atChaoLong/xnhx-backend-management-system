# 试听课快速操作功能说明

## 功能概述

在试听课列表页面添加了四个快速操作按钮，用于加速试听课流程的处理：

1. **匹配老师** - 销售人员操作
2. **确认老师** - 教务人员操作
3. **开课** - 教务人员操作
4. **转正** - 销售人员操作（仅在试听完并反馈后显示）

## 权限配置

### 角色权限矩阵

| 角色 | 匹配老师 | 确认老师 | 开课 | 转正 |
|------|---------|---------|------|------|
| 销售顾问 (sales) | ✅ | ❌ | ❌ | ✅ |
| 教务 (academic_affairs) | ❌ | ✅ | ✅ | ❌ |
| 超级管理员 (admin) | ❌ | ❌ | ❌ | ❌ |

**权限说明**：
- `matchTeacher` - 匹配老师权限，仅销售拥有
- `confirmTeacher` - 确认老师权限，仅教务拥有
- `addLink` - 开课权限，仅教务拥有
- `convert` - 转正权限，仅销售拥有

## 状态流转规则

试听课状态根据字段完成度和时间自动计算：

```
1. cancelled (取消试听)
   - course_status = '取消试听'

2. waiting_match (待匹配老师)
   - matched_teacher 为空

3. waiting_confirm (待确认老师)
   - matched_teacher 不为空
   - confirmed_teacher 为空

4. waiting_time (待确认时间)
   - matched_teacher 不为空
   - confirmed_teacher 不为空
   - trial_time 为空

5. waiting_link (待开链接)
   - matched_teacher 不为空
   - confirmed_teacher 不为空
   - trial_time 不为空
   - class_link 为空

6. scheduled (已排待上课)
   - 所有字段已填写
   - trial_time > 今天
   - 未转化

7. waiting_feedback (上完待反馈)
   - 所有字段已填写
   - trial_time <= 今天
   - 未转化

8. completed (已完成)
   - is_converted = true
```

## 快速操作详解

### 1. 匹配老师 (销售)

**显示条件**：
- 状态为 `waiting_match`
- 用户角色为 `sales`
- 拥有 `matchTeacher` 权限

**操作流程**：
1. 点击"匹配老师"按钮
2. 在弹出的输入框中输入老师姓名
3. 系统更新 `matched_teacher` 字段
4. 状态自动变更为 `waiting_confirm`

**代码实现**：
```typescript
const handleQuickMatchTeacher = async (lesson: TrialLesson) => {
  const teacherName = prompt("请输入匹配的老师姓名：")
  if (!teacherName || !teacherName.trim()) return

  try {
    setIsMatching(lesson.id)
    await TrialLessonsService.updateTrialLesson({
      ...lesson,
      matched_teacher: teacherName.trim(),
    })
    toast({ title: "匹配成功", description: "已成功匹配老师" })
    fetchLessons()
  } catch (error: any) {
    toast({ variant: "destructive", title: "匹配失败", description: error.message })
  } finally {
    setIsMatching(null)
  }
}
```

### 2. 确认老师 (教务)

**显示条件**：
- 状态为 `waiting_confirm`
- 用户角色为 `academic_affairs`
- 拥有 `confirmTeacher` 权限

**操作流程**：
1. 点击"确认老师"按钮
2. 打开教师选择对话框
3. 从系统教师列表中选择（来自 `user_profiles` 表，`role='teacher'`）
4. 系统更新 `confirmed_teacher` 字段
5. 状态自动变更为 `waiting_time`

**数据源**：
- API: `/api/user-profiles?role=teacher`
- 表: `user_profiles`
- 过滤条件: `role = 'teacher'`

**字段映射**：
```typescript
{
  id: profile.id,
  name: profile.name || profile.username || '未知',
  subject: profile.subject || profile.teacher_subject || '',
  classin_uid: profile.classin_uid
}
```

**UI 组件**：
```typescript
<Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>确认老师</DialogTitle>
      <DialogDescription>
        从教师列表中选择确认的老师
      </DialogDescription>
    </DialogHeader>
    <div className="max-h-96 overflow-y-auto">
      {teachers.map((teacher) => (
        <Button
          key={teacher.id}
          variant="outline"
          className="w-full justify-start"
          onClick={() => handleConfirmTeacherSelect(teacher.name)}
        >
          <div className="text-left">
            <div className="font-medium">{teacher.name}</div>
            <div className="text-sm text-muted-foreground">
              {teacher.subject || '未指定学科'}
              {teacher.classin_uid && ' • 已绑定 ClassIn'}
            </div>
          </div>
        </Button>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

### 3. 开课 (教务)

**显示条件**：
- 状态为 `waiting_link`
- 用户角色为 `academic_affairs`
- 拥有 `addLink` 权限

**操作流程**：
1. 点击"开课"按钮
2. 系统验证 `confirmed_teacher` 和 `trial_time` 是否已填写
3. 从 `user_profiles` 查询老师的 ClassIn UID
4. 调用 ClassIn SDK API 创建课室
5. 将生成的课室链接写入 `class_link` 字段
6. 状态自动变更为 `scheduled` 或 `waiting_feedback`

**ClassIn API 调用**：
```typescript
const classResponse = await fetch('/api/classin-sdk/classroom', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
  },
  body: JSON.stringify({
    courseId: process.env.NEXT_PUBLIC_CLASSIN_DEFAULT_COURSE_ID || 'default_course',
    unitId: process.env.NEXT_PUBLIC_CLASSIN_DEFAULT_UNIT_ID || 'default_unit',
    name: `${lesson.child_name || '学生'}的试听课`,
    teacherUid: teacher.classin_uid,
    startTime: new Date(lesson.trial_time).getTime() / 1000,
    endTime: new Date(new Date(lesson.trial_time).getTime() + (lesson.trial_duration || 60) * 60 * 1000).getTime() / 1000,
  })
})
```

**环境变量**：
```env
NEXT_PUBLIC_CLASSIN_DEFAULT_COURSE_ID=default_course
NEXT_PUBLIC_CLASSIN_DEFAULT_UNIT_ID=default_unit
```

### 4. 转正 (销售)

**显示条件**：
- 状态为 `waiting_feedback`（上完待反馈）或 `completed`（已完成）
- 用户角色为 `sales`
- 拥有 `convert` 权限

**操作流程**：
1. 点击"转正"按钮
2. 系统验证试听状态是否允许转正
3. 跳转到正式订单创建页面（`/dashboard/formal-orders/new?trialLessonId=xxx`）
4. 正式订单创建后，试听课状态自动变更为 `completed`

**代码实现**：
```typescript
const handleConvertToFormal = (lesson: TrialLesson) => {
  // 验证状态：只有试听完并反馈后才能转正
  if (lesson.lesson_status !== 'waiting_feedback' && lesson.lesson_status !== 'completed') {
    toast({
      variant: "destructive",
      title: "无法转正",
      description: "只有试听完并反馈后才能转正为正式订单",
    })
    return
  }

  setIsConverting(lesson.id)
  // 跳转到正式订单创建页面
  router.push(`/dashboard/formal-orders/new?trialLessonId=${lesson.id}`)
}
```

**UI 组件**：
```typescript
{/* 转正按钮 - 销售操作，仅在试听完并反馈后显示 */}
{(lesson.lesson_status === 'waiting_feedback' || lesson.lesson_status === 'completed') && trialLessonsPerm.convert() && (
  <Button
    variant="default"
    size="sm"
    onClick={() => handleConvertToFormal(lesson)}
    disabled={isConverting === lesson.id}
    className="bg-green-600 hover:bg-green-700"
    title="将试听课转正为正式订单"
  >
    {isConverting === lesson.id ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <>
        <CheckCircle className="mr-1 h-4 w-4" />
        转正
      </>
    )}
  </Button>
)}
```

## 调试指南

### 教师列表为空问题

**症状**：点击"确认老师"后，对话框中不显示任何教师

**排查步骤**：

1. **检查浏览器控制台日志**
   - 打开浏览器开发者工具 (F12)
   - 切换到 Console 标签
   - 查找以下日志：
     - `"API返回结果:"` - 查看完整的 API 响应
     - `"教师数据:"` - 查看教师数组
     - `"教师数量:"` - 查看教师数量
     - `"映射教师档案:"` - 查看每个教师档案的映射过程

2. **验证 API 端点**
   ```bash
   # 直接测试 API（需要先登录获取 token）
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/user-profiles?role=teacher
   ```

3. **检查数据库**
   ```sql
   -- 查询 user_profiles 表
   SELECT id, name, username, role, classin_uid
   FROM user_profiles
   WHERE role = 'teacher';

   -- 如果没有数据，插入测试教师
   INSERT INTO user_profiles (id, name, username, role, classin_uid)
   VALUES (
     uuid_generate_v4(),
     '测试教师',
     'test_teacher',
     'teacher',
     123456 -- 替换为实际的 ClassIn UID
   );
   ```

4. **检查 RLS 策略**
   ```sql
   -- 验证 user_profiles 表的 RLS 策略
   SELECT
     policyname,
     cmd,
     permissive,
     roles,
     qual,
     with_check
   FROM pg_policies
   WHERE tablename = 'user_profiles';

   -- 应该看到 "Authenticated users can view all profiles" 策略
   ```

5. **检查认证状态**
   - 确认用户已登录
   - 检查 `localStorage` 中是否有 `supabase.auth.token`
   - 在控制台运行：
     ```javascript
     console.log('Token:', localStorage.getItem('supabase.auth.token'))
     ```

### 状态计算不正确

**症状**：试听课状态显示与预期不符

**排查步骤**：

1. **检查字段值**
   ```sql
   SELECT
     id,
     course_status,
     matched_teacher,
     confirmed_teacher,
     trial_time,
     class_link,
     manual_converted
   FROM trial_lessons
   WHERE id = 'lesson_id';
   ```

2. **验证时间字段**
   - 确保 `trial_time` 使用正确的格式：`YYYY-MM-DD HH:mm:ss`
   - 确认时区设置正确

3. **检查转化状态**
   ```sql
   -- 检查是否产生正式订单
   SELECT id, lead_id, trial_lesson_id
   FROM formal_orders
   WHERE trial_lesson_id = 'lesson_id';
   ```

### ClassIn 开课失败

**症状**：点击"开课"后显示错误提示

**排查步骤**：

1. **检查教师 ClassIn UID**
   ```sql
   SELECT
     up.name,
     up.classin_uid,
     tl.confirmed_teacher
   FROM trial_lessons tl
   JOIN user_profiles up ON up.name = tl.confirmed_teacher
   WHERE tl.id = 'lesson_id';
   ```

2. **验证环境变量**
   ```bash
   # 检查 .env.local 文件
   cat .env.local | grep CLASSIN
   ```

3. **测试 ClassIn API**
   - 查看 `/api/classin-sdk/classroom` 日志
   - 确认 ClassIn SDK 配置正确

## 核心文件

### 前端组件
- `app/dashboard/trial-lessons/page.tsx` - 试听课列表页面（快速操作按钮）

### 业务逻辑
- `lib/status-calculator.ts` - 试听课状态计算逻辑

### 权限配置
- `lib/permissions.ts` - 角色权限矩阵
- `lib/route-permissions.ts` - API 路由权限

### API 端点
- `app/api/user-profiles/route.ts` - 教师数据查询
- `app/api/classin-sdk/classroom/route.ts` - ClassIn 课室创建

### 数据库迁移
- `supabase/migrations/028_fix_user_profiles_rls.sql` - user_profiles RLS 策略
- `supabase/migrations/029_update_user_roles_enum.sql` - 用户角色枚举

## 数据库表结构

### user_profiles 表

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name VARCHAR(100),              -- 用户姓名
  username VARCHAR(100),          -- 用户名
  role TEXT,                      -- 角色：admin, operator, sales, head_teacher, teacher, academic_affairs, finance, hr
  classin_uid BIGINT,             -- ClassIn 唯一标识符
  subject TEXT,                   -- 学科（用于教师）
  teacher_subject TEXT,           -- 教授学科（备用字段）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_role CHECK (role IN ('admin', 'operator', 'sales', 'head_teacher', 'teacher', 'academic_affairs', 'finance', 'hr'))
);
```

### trial_lessons 表

```sql
CREATE TABLE trial_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 基本信息
  child_name VARCHAR(100),        -- 学生姓名
  grade VARCHAR(50),              -- 年级
  subject VARCHAR(100),           -- 学科

  -- 老师信息
  matched_teacher VARCHAR(100),   -- 匹配老师（销售填写）
  confirmed_teacher VARCHAR(100), -- 确认老师（教务选择）

  -- 时间信息
  trial_time TIMESTAMP,           -- 试听时间
  trial_duration INT DEFAULT 60,  -- 试听时长（分钟）

  -- 课程信息
  course_status VARCHAR(100),     -- 课程状态：取消试听
  class_link TEXT,                -- 上课链接

  -- 转化信息
  manual_converted VARCHAR(20),   -- 是否转化（手动）：是/否/待定

  -- ClassIn 信息
  classin_course_id BIGINT,       -- ClassIn 课程ID
  classin_unit_id BIGINT,         -- ClassIn 单元ID
  classin_class_id BIGINT,        -- ClassIn 班级ID

  -- 计算字段（非存储）
  lesson_status TEXT,             -- 试听状态（计算得出）
  lesson_status_name TEXT,        -- 状态显示名称
  is_converted BOOLEAN,           -- 是否转化（计算得出）

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 测试场景

### 完整流程测试

1. **销售匹配老师**
   - 登录销售账号
   - 找到状态为"待匹配老师"的试听
   - 点击"匹配老师"并输入教师姓名
   - 验证状态变更为"待确认老师"

2. **教务确认老师**
   - 登录教务账号
   - 找到状态为"待确认老师"的试听
   - 点击"确认老师"并从列表选择
   - 验证状态变更为"待确认时间"

3. **填写试听时间**
   - 在编辑页面填写 `trial_time`
   - 验证状态变更为"待开链接"

4. **教务开课**
   - 找到状态为"待开链接"的试听
   - 点击"开课"按钮
   - 验证 `class_link` 已生成
   - 验证状态根据时间变更为"已排待上课"或"上完待反馈"

5. **销售转正**
   - 等待试听时间已过，状态变为"上完待反馈"
   - 登录销售账号
   - 找到状态为"上完待反馈"或"已完成"的试听
   - 点击"转正"按钮
   - 验证跳转到正式订单创建页面
   - 创建正式订单后，验证试听课状态变为"已完成"

## 常见问题

### Q1: 为什么看不到"匹配老师"按钮？
**A**: 请检查：
- 是否使用销售账号登录
- 试听课状态是否为"待匹配老师"
- 权限配置中 sales 角色是否有 matchTeacher 权限

### Q2: 确认老师时为什么显示"暂无教师数据"？
**A**: 可能原因：
- 数据库中没有 role='teacher' 的用户档案
- RLS 策略阻止了查询
- 查看浏览器控制台的详细错误信息

### Q3: 开课时提示"老师未绑定 ClassIn 账号"？
**A**: 需要在 user_profiles 表中为教师填写 classin_uid 字段

### Q4: 状态为什么没有自动更新？
**A**: 状态是实时计算的，确保：
- 已刷新页面
- 相关字段已正确填写
- 检查浏览器缓存

### Q5: 为什么看不到"转正"按钮？
**A**: 请检查：
- 是否使用销售账号登录
- 试听课状态是否为"上完待反馈"或"已完成"
- 试听时间是否已过
- 权限配置中 sales 角色是否有 convert 权限

### Q6: 转正后试听课状态会变吗？
**A**: 会。当创建正式订单并关联试听课后：
- `manual_converted` 字段会被自动设置为"是"
- 试听课状态会自动变更为"已完成"（completed）

## 更新日志

### 2025-12-31
- ✅ 添加"匹配老师"快速操作（销售）
- ✅ 添加"确认老师"快速操作（教务）
- ✅ 添加"开课"快速操作（教务）
- ✅ 添加"转正"快速操作（销售，仅在试听完并反馈后显示）
- ✅ 优化试听状态计算逻辑
- ✅ 更新权限配置
- ✅ 添加教师数据加载和调试日志
- ✅ 修复 trial_time 字段使用（替代 confirmed_time）
- ✅ 添加转正状态验证和加载状态

### 待完成
- [ ] 添加教师管理页面（创建/编辑教师账号）
- [ ] 添加 ClassIn UID 绑定功能
- [ ] 优化错误提示信息
- [ ] 添加操作日志记录
