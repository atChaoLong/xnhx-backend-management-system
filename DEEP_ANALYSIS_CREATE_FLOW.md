# 创建老师/学生的数据流深度分析

## 核心问题分析

当前系统在创建老师和学生时，分成两个独立的库：
1. **本地库**（我们自己的 Supabase）
2. **ClassIn 库**（第三方在线教学平台）

这份文档详细分析两边数据的流向、存储位置和同步机制。

---

## 一、学生创建流程分析

### 1.1 前端表单提交 (`/dashboard/students/new/page.tsx`)

```
用户填写表单
    ↓
handleSubmit() 方法触发
    ↓
验证必填字段
    ├─ student_name (必填)
    ├─ 如果 register_to_classin=true，需要 parent_phone + classin_password
    └─ 其他字段（学号、年级、地域等）
    ↓
调用 StudentsService.createStudent()
```

**表单数据结构**：
```typescript
payload: NewStudent = {
  student_name: string           // 学生姓名 ⭐
  student_number?: string        // 学号
  grade_code?: string            // 年级代码
  region?: string                // 地域
  school?: string                // 学校
  parent_phone?: string          // 家长电话
  status?: string                // 状态，默认 'active'
}
```

### 1.2 服务层调用 (`lib/services/students.ts`)

```typescript
StudentsService.createStudent(payload)
    ↓
api.post("/api/students", payload)  // 发送 POST 请求
```

### 1.3 后端 API 路由 (`/api/students/route.ts`)

```
POST /api/students
    ↓
1️⃣ 验证必填字段（student_name）
    ↓
2️⃣ 构建插入数据
    insertData = {
      student_number: null       // 如果未填
      student_name: "张三"        // 必填
      grade_code: null
      region: null
      school: null
      parent_phone: null
      head_teacher_id: null
      status: "active"
    }
    ↓
3️⃣ 插入到本地 Supabase 库 📍 students 表
    supabaseServer
      .from('students')
      .insert(insertData)
      .select()
      .single()
    ↓
4️⃣ 返回创建的学生数据
    {
      id: "uuid...",              // ← 本地库生成的 UUID
      student_name: "张三",
      student_number: null,
      ...
      classin_uid: null           // ⚠️ 此时为 null，还未注册到 ClassIn
    }
```

**📍 数据保存位置**：
- **表名**：`students`
- **字段**：`id`, `student_name`, `student_number`, `grade_code`, `region`, `school`, `parent_phone`, `head_teacher_id`, `status`, `classin_uid`, `created_at`, `updated_at`
- **此时 `classin_uid` = null**（因为还没注册到 ClassIn）

### 1.4 可选：注册到 ClassIn

如果前端表单选中了 `register_to_classin = true`，则触发第二步：

```typescript
handleRegisterToClassIn(studentId: string)
    ↓
调用 api.post('/api/students/register-classin')
    ↓
body = {
      studentId: "uuid...",           // 本地库生成的 UUID
      telephone: "18888888888",       // ClassIn 用来标识的电话号码
      nickname: "张三",                // ClassIn 用户名
      password: "password123",        // ClassIn 密码
    }
```

#### 1.4.1 ClassIn 注册 API (`/api/students/register-classin/route.ts`)

```
POST /api/students/register-classin
    ↓
1️⃣ 获取学生信息（从本地 students 表）
    WHERE id = studentId
    ↓
2️⃣ 检查是否已注册到 ClassIn
    IF student.classin_uid != null
        THEN 返回错误 "已注册过"
    ↓
3️⃣ 调用 ClassIn SDK 注册学生
    sdk.registerStudent({
      telephone: "18888888888",
      nickname: "张三",
      password: "password123"
    })
    ↓
    ClassIn 返回：uid = 12345678  ← ClassIn 系统生成的学生 ID
    ↓
4️⃣ 将学生添加到机构
    sdk.addSchoolStudent({
      studentAccount: "18888888888",  // 用电话号作为账号
      studentName: "张三"
    })
    ↓
5️⃣ 更新本地库，保存 ClassIn UID
    UPDATE students
    SET classin_uid = 12345678
    WHERE id = studentId
    ↓
6️⃣ 返回结果
    {
      uid: 12345678,           // ← ClassIn 返回的 UID
      studentId: "uuid..."     // ← 本地库的 ID
    }
```

**📍 数据保存位置**：
- **表名**：`students`
- **字段更新**：`classin_uid = 12345678`（建立关联）

---

## 二、老师创建流程分析

### 2.1 前端表单提交 (`/dashboard/teachers/new/page.tsx`)

```
用户填写复杂的表单
    ↓
handleSubmit() 验证所有必填字段
    ├─ teacher_name (必填)
    ├─ gender (必填)
    ├─ wechat (必填)
    ├─ classin_phone (必填)
    ├─ location (必填)
    ├─ subjects[] (至少选1个)
    ├─ grade_levels[] (至少选1个，最多2个)
    ├─ education (必填)
    ├─ university (必填)
    ├─ available_times[] (至少选1个)
    ├─ textbook_versions[] (至少选1个)
    ├─ student_regions[] (至少选1个)
    ├─ student_levels[] (至少选1个)
    └─ 其他可选字段
    ↓
构建 payload
    ↓
TeachersService.createTeacher(payload)
```

**表单数据结构**：
```typescript
payload: NewTeacher = {
  teacher_name: string           // 老师姓名 ⭐
  gender: string                 // 性别
  wechat: string                 // 微信号
  classin_phone: string          // ClassIn 手机号
  location: string               // 所在地
  subjects: string[]             // 教授科目
  grade_levels: string[]         // 教授年级
  used_classin: boolean          // 是否用过 ClassIn
  has_certificate: boolean       // 是否有教资证
  education: string              // 学历
  university: string             // 毕业院校
  available_times?: string[]     // 可排课时间
  textbook_versions?: string[]   // 教材版本
  student_regions?: string[]     // 带过学生地域
  student_levels?: string[]      // 擅长学生水平
  teaching_years?: number        // 教龄
  teaching_style?: string        // 教学风格
  success_cases?: string         // 成功案例
  photo_url?: string             // 照片
  review_screenshots?: string[]  // 评价截图
  notes?: string                 // 备注
}
```

### 2.2 后端 API 路由 (`/api/teachers/route.ts`)

```
POST /api/teachers
    ↓
1️⃣ 验证必填字段
    requiredFields = [
      'teacher_name', 'gender', 'wechat', 'classin_phone',
      'location', 'subjects', 'grade_levels', 'education',
      'university'
    ]
    ↓
2️⃣ 构建插入数据
    insertData = {
      teacher_name: "李老师",
      gender: "male",
      wechat: "liteacher123",
      classin_phone: "18888888888",
      location: "北京",
      subjects: ["math", "physics"],
      grade_levels: ["high1", "high2"],
      used_classin: true,
      has_certificate: true,
      education: "bachelor",
      university: "北京大学",
      available_times: ["weekday_evening", "weekend_morning"],
      textbook_versions: ["people_education"],
      student_regions: ["beijing", "shanghai"],
      student_levels: ["elementary", "junior"],
      teaching_years: 5,
      teaching_style: "lively",
      success_cases: "...",
      photo_url: "...",
      review_screenshots: ["...", "..."],
      notes: null
    }
    ↓
3️⃣ 插入到本地 Supabase 库 📍 teacher_profiles 表
    supabaseServer
      .from('teacher_profiles')
      .insert(insertData)
      .select()
      .single()
    ↓
4️⃣ 返回创建的老师数据
    {
      id: "uuid...",              // ← 本地库生成的 UUID
      teacher_name: "李老师",
      gender: "male",
      ...
    }
```

**📍 数据保存位置**：
- **表名**：`teacher_profiles`
- **字段**：`id`, `teacher_name`, `gender`, `wechat`, `classin_phone`, `location`, `subjects`, `grade_levels`, `used_classin`, `has_certificate`, `education`, `university`, `available_times`, `textbook_versions`, `student_regions`, `student_levels`, `teaching_years`, `teaching_style`, `success_cases`, `photo_url`, `review_screenshots`, `notes`, `created_at`, `updated_at`

**⚠️ 当前问题**：老师创建后，**不会自动注册到 ClassIn**（与学生流程不同）

---

## 三、数据流图对比

### 学生流程

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 - 新增学生                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  填写表单，勾选「注册到ClassIn」
                          ↓
        ┌─────────────────────────────────────┐
        │                                     │
        ↓                                     ↓
   点击「创建」                          点击「创建并注册」
        ↓                                     ↓
   ┌────────────────────────┐        ┌─────────────────────────┐
   │ POST /api/students     │        │ POST /api/students      │
   │ (创建本地学生)         │        │ (创建本地学生)          │
   │                        │        │ ↓                       │
   │ Supabase 本地库        │        │ POST /api/students/     │
   │ students 表            │        │ register-classin        │
   │ ✓ 保存成功            │        │ (注册到 ClassIn)        │
   │ classin_uid = null    │        │ ↓                       │
   └────────────────────────┘        │ ClassIn SDK 注册        │
           ↓                          │ ✓ 注册成功             │
      跳转到列表                      │ classin_uid = 12345    │
                                      └─────────────────────────┘
                                              ↓
                                         跳转到列表
```

### 老师流程

```
┌──────────────────────────────────────┐
│      前端 - 新增老师                 │
└──────────────────────────────────────┘
              ↓
       填写复杂表单
              ↓
      点击「创建」
              ↓
  ┌──────────────────────┐
  │ POST /api/teachers   │
  │ (创建本地老师)       │
  │                      │
  │ Supabase 本地库      │
  │ teacher_profiles 表  │
  │ ✓ 保存成功          │
  │ classin_uid = null  │
  └──────────────────────┘
         ↓
    跳转到列表

⚠️ 老师创建后不会注册到 ClassIn
```

---

## 四、数据库表映射

### 学生端表结构

```
┌─────────────────────────────────────┐
│         students (本地库)            │
├─────────────────────────────────────┤
│ id (UUID) - 主键                     │
│ student_name (VARCHAR)               │
│ student_number (VARCHAR) - 学号      │
│ grade_code (VARCHAR) - 年级代码      │
│ region (VARCHAR) - 地域              │
│ school (VARCHAR) - 学校              │
│ parent_phone (VARCHAR) - 家长电话    │
│ head_teacher_id (VARCHAR)            │
│ status (VARCHAR) - active/deleted    │
│ classin_uid (BIGINT) - ClassIn映射  │ ← 关键字段
│ created_at (TIMESTAMPTZ)             │
│ updated_at (TIMESTAMPTZ)             │
└─────────────────────────────────────┘
          ↓ classin_uid = 12345
┌─────────────────────────────────────┐
│    students_classin (镜像表)         │
├─────────────────────────────────────┤
│ id (UUID) - 主键                     │
│ uid (BIGINT) - ClassIn UID - 主键   │ ← ClassIn 侧的主键
│ stud_id (BIGINT) - ClassIn学生ID    │
│ name (VARCHAR) - 姓名               │
│ mobile (VARCHAR) - 手机号            │
│ email (VARCHAR) - 邮箱              │
│ account_status (INTEGER)             │
│ isdel (INTEGER) - 是否删除          │
│ sync_time (TIMESTAMPTZ) - 同步时间  │
│ classin_extra (JSONB) - 额外字段    │
└─────────────────────────────────────┘
          ↓
┌─────────────────────────────────────┐
│      ClassIn 平台（线上）            │
├─────────────────────────────────────┤
│ UID: 12345                          │
│ Name: "张三"                        │
│ Mobile: "18888888888"               │
│ ...                                  │
└─────────────────────────────────────┘
```

### 老师端表结构

```
┌──────────────────────────────────────┐
│      teacher_profiles (本地库)        │
├──────────────────────────────────────┤
│ id (UUID) - 主键                      │
│ teacher_name (VARCHAR)                │
│ gender (VARCHAR)                      │
│ wechat (VARCHAR)                      │
│ classin_phone (VARCHAR) - ClassIn电话 │
│ location (VARCHAR)                    │
│ subjects (TEXT[]) - 教科              │
│ grade_levels (TEXT[]) - 年级段        │
│ used_classin (BOOLEAN)                │
│ has_certificate (BOOLEAN)             │
│ education (VARCHAR)                   │
│ university (VARCHAR)                  │
│ available_times (TEXT[])              │
│ textbook_versions (TEXT[])            │
│ student_regions (TEXT[])              │
│ student_levels (TEXT[])               │
│ teaching_years (INTEGER)              │
│ teaching_style (VARCHAR)              │
│ success_cases (TEXT)                  │
│ photo_url (VARCHAR)                   │
│ review_screenshots (TEXT[])           │
│ notes (TEXT)                          │
│ bank_card_info (JSONB)                │
│ classin_uid (BIGINT) - ClassIn映射   │ ← 为空，还未注册
│ created_at (TIMESTAMPTZ)              │
│ updated_at (TIMESTAMPTZ)              │
└──────────────────────────────────────┘
          ↓ classin_uid = null (✋ 当前未使用)
┌──────────────────────────────────────┐
│   teacher_classin (镜像表)            │
├──────────────────────────────────────┤
│ id (UUID) - 主键                      │
│ uid (BIGINT) - ClassIn UID - 主键    │ ← ClassIn 侧主键
│ st_id (BIGINT) - ClassIn 老师ID      │
│ name (VARCHAR)                        │
│ logo (VARCHAR) - 头像                │
│ emp_no (VARCHAR) - 工号              │
│ position (VARCHAR) - 职位            │
│ mobile (VARCHAR) - 手机号            │
│ email (VARCHAR) - 邮箱              │
│ account_status (INTEGER)              │
│ is_del (INTEGER)                      │
│ departments_info (JSONB)              │
│ sync_time (TIMESTAMPTZ)               │
│ classin_extra (JSONB)                 │
└──────────────────────────────────────┘
```

---

## 五、当前实现的问题和缺陷

### 问题 1：学生和老师处理不一致

| 操作 | 学生 | 老师 |
|------|------|------|
| 创建本地库 | ✅ 自动创建 | ✅ 自动创建 |
| 注册到 ClassIn | ✅ 可选（通过弹窗） | ❌ 不支持 |
| 自动关联 classin_uid | ✅ 注册时自动更新 | ❌ 未实现 |
| 从 ClassIn 同步 | ❌ 无 | ❌ 无 |

### 问题 2：老师库和 ClassIn 的关联缺失

- `teacher_profiles.classin_uid` 永远为 `null`
- 无法知道哪个本地老师对应 ClassIn 系统中的哪个老师
- `teacher_classin` 表中的数据与 `teacher_profiles` 完全不关联

### 问题 3：数据同步机制缺失

- 创建老师后，**不会自动同步到 ClassIn**
- 无法从 ClassIn 批量导入老师
- 修改本地数据后，不会同步到 ClassIn

### 问题 4：字段映射不清楚

创建老师时，下列字段的用途不明确：
- `classin_phone` - 是老师在 ClassIn 的手机号？还是微信号？
- 与 ClassIn 侧的 `mobile` 字段的关系是什么？
- 如何确定唯一性？

---

## 六、改进方案

### 6.1 统一的学生/老师创建流程

```
创建本地记录 → 可选：注册到 ClassIn → 保存 classin_uid
```

代码示例：
```typescript
// 创建老师 - 同步学生流程
export async function createTeacherWithClassIn(
  teacherData: NewTeacher,
  registerToClassIn: boolean = false,
  classinPhonePassword?: {
    phone: string
    password: string
  }
) {
  // 1. 创建本地老师记录
  const teacher = await TeachersService.createTeacher(teacherData)
  
  // 2. 可选：注册到 ClassIn
  if (registerToClassIn && classinPhonePassword) {
    const uid = await registerTeacherToClassIn(
      teacher.id,
      teacherData.teacher_name,
      classinPhonePassword.phone,
      classinPhonePassword.password
    )
    
    // 3. 更新本地库，保存 classin_uid
    await supabaseServer
      .from('teacher_profiles')
      .update({ classin_uid: uid })
      .eq('id', teacher.id)
  }
  
  return teacher
}
```

### 6.2 创建 ClassIn 注册 API（老师版）

```typescript
// /api/teachers/register-classin/route.ts
POST /api/teachers/register-classin
body: {
  teacherId: string
  telephone: string
  nickname: string
  password: string
}

Flow:
1. 获取本地老师数据
2. 检查是否已注册（classin_uid != null）
3. 调用 SDK 注册到 ClassIn
4. 获取返回的 uid
5. 更新本地库 classin_uid
6. 返回结果
```

### 6.3 改进字段映射

```typescript
// 创建老师时的 ClassIn 相关字段应该更清晰：
interface NewTeacher {
  // 本地库字段
  teacher_name: string
  gender: string
  wechat: string          // 微信号（联系方式）
  
  // ClassIn 相关字段
  classin_phone: string   // ← 改名为 classin_account_phone（ClassIn 账号电话）
  classin_password?: string // ← 新增：ClassIn 密码（如需注册）
  
  // 其他教学信息...
}
```

### 6.4 同步机制

```
定期任务（每天凌晨）：
1. 从 ClassIn API 获取老师列表
2. 与本地库比对（通过 classin_uid）
3. 更新 teacher_classin 镜像表
4. 检测冲突或新增
```

---

## 七、完整的数据流（理想状态）

### 学生流程（已实现）

```
┌──────────────┐
│ 前端表单     │
│ student_name │
│ parent_phone │
└──────────────┘
      ↓
┌─────────────────────────────────────┐
│ POST /api/students                  │
│ → Supabase students 表              │
│ ✓ 保存：student_name, parent_phone  │
│ ✓ 返回：id (UUID), classin_uid=null│
└─────────────────────────────────────┘
      ↓
   用户选择：注册到 ClassIn？
      ↓
   ┌──yes──┐ ┌──no──┐
   ↓       ↓
┌────────────────────────────────────┐
│ POST /api/students/register-classin│
│ → ClassIn SDK                      │
│ ✓ 调用：registerStudent()          │
│ ✓ 返回：uid (BIGINT) = 12345       │
│ → Supabase students 表             │
│ ✓ 更新：classin_uid = 12345        │
└────────────────────────────────────┘
      ↓
   end
```

### 老师流程（当前实现）

```
┌──────────────┐
│ 前端表单     │
│ teacher_name │
│ wechat       │
│ ...          │
└──────────────┘
      ↓
┌─────────────────────────────────────┐
│ POST /api/teachers                  │
│ → Supabase teacher_profiles 表      │
│ ✓ 保存：teacher_name, wechat, ...   │
│ ✓ 返回：id (UUID)                   │
│ ✓ classin_uid = null (永远)        │
└─────────────────────────────────────┘
      ↓
   end

⚠️ 问题：老师永远不会注册到 ClassIn
```

### 老师流程（改进版）

```
┌──────────────┐
│ 前端表单     │
│ teacher_name │
│ wechat       │
│ classin_phone│
│ ...          │
└──────────────┘
      ↓
┌─────────────────────────────────────┐
│ POST /api/teachers                  │
│ → Supabase teacher_profiles 表      │
│ ✓ 保存：teacher_name, wechat, ...   │
│ ✓ 返回：id (UUID), classin_uid=null │
└─────────────────────────────────────┘
      ↓
   用户选择：注册到 ClassIn？
      ↓
   ┌──yes──┐ ┌──no──┐
   ↓       ↓
┌────────────────────────────────────┐
│ POST /api/teachers/register-classin │
│ → ClassIn SDK                      │
│ ✓ 调用：registerTeacher()          │
│ ✓ 返回：uid (BIGINT) = 67890       │
│ → Supabase teacher_profiles 表     │
│ ✓ 更新：classin_uid = 67890        │
└────────────────────────────────────┘
      ↓
   end
```

---

## 八、关键字段总结

### 本地库侧

| 表名 | 主键 | ClassIn 映射字段 | 用途 |
|------|------|-----------------|------|
| `students` | `id` (UUID) | `classin_uid` (BIGINT) | 关联到 ClassIn 学生 |
| `teacher_profiles` | `id` (UUID) | `classin_uid` (BIGINT) | 关联到 ClassIn 老师（当前为null） |

### ClassIn 侧（镜像表）

| 表名 | 主键 | 来源 | 用途 |
|------|------|------|------|
| `students_classin` | `uid` (BIGINT) | ClassIn API | 学生数据镜像 |
| `teacher_classin` | `uid` (BIGINT) | ClassIn API | 老师数据镜像 |

### ClassIn 平台侧（线上）

| 资源 | 唯一标识 | 说明 |
|------|---------|------|
| Student | `uid` (BIGINT) | ClassIn 学生唯一 ID |
| Teacher | `uid` (BIGINT) | ClassIn 老师唯一 ID |

---

## 九、建议的改进优先级

### Phase 1（高优先级）- 统一创建流程
- [ ] 为老师创建添加 ClassIn 注册选项
- [ ] 创建 `/api/teachers/register-classin` 接口
- [ ] 更新前端老师创建表单

### Phase 2（中优先级）- 数据同步
- [ ] 实现从 ClassIn 同步老师列表
- [ ] 实现从 ClassIn 同步学生列表
- [ ] 创建同步管理后台

### Phase 3（低优先级）- 高级功能
- [ ] 双向同步（修改本地 → 更新 ClassIn）
- [ ] 智能匹配和去重
- [ ] 冲突解决流程

