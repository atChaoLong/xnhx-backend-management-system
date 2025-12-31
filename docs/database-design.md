# 数据库设计文档

## 📚 目录
- [1. 学生管理模块](#1-学生管理模块)
- [2. 订单管理模块](#2-订单管理模块)
- [3. 课程管理模块](#3-课程管理模块)
- [4. 排课管理模块](#4-排课管理模块)
- [5. 回访管理模块](#5-回访管理模块)
- [6. 异动管理模块](#6-异动管理模块)
- [7. 待办事项模块](#7-待办事项模块)
- [8. 老师面试管理模块](#8-老师面试管理模块)

---

## 1. 学生管理模块

### 1.1 students 表 (学生基础信息)

存储学生的核心基础信息。

```sql
CREATE TABLE students (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 基础信息
  student_number VARCHAR(50) UNIQUE,              -- 学号ID
  name VARCHAR(100) NOT NULL,                     -- 学生姓名
  name_serial VARCHAR(100),                       -- 姓名-序号 (用于显示)
  child_nickname VARCHAR(100),                    -- 孩子称呼*

  -- 学籍信息
  grade VARCHAR(50),                              -- 年级*
  region VARCHAR(100),                            -- 地域*
  school VARCHAR(200),                            -- 学校

  -- 联系信息
  parent_phone VARCHAR(20),                       -- 家长电话号
  parent_wechat VARCHAR(100),                     -- 家长微信号
  mobile VARCHAR(20),                             -- 学生本人联系电话

  -- 班级信息
  classin_uid BIGINT,                             -- ClassIn 唯一标识符
  school_uid BIGINT,                              -- ClassIn 学校 UID

  -- 人员关联
  consultant_id UUID REFERENCES user_profiles(id), -- 对应顾问
  head_teacher_id UUID REFERENCES user_profiles(id), -- 班主任（手动）
  sales_leader_id UUID REFERENCES user_profiles(id), -- 销售leader
  operator_id UUID REFERENCES user_profiles(id),  -- 对应运营

  -- 组织架构
  team_id VARCHAR(100),                           -- 所属团队

  -- 状态标记
  status VARCHAR(50),                             -- 学生状态
  new_student_status VARCHAR(50),                 -- 新生状态
  is_parent_meeting BOOLEAN DEFAULT FALSE,        -- 是否家长会
  handover_to_formal BOOLEAN DEFAULT FALSE,       -- 正式生交接

  -- 自定义字段
  custom_color VARCHAR(20),                       -- 自定义颜色

  -- 时间戳
  first_order_date DATE,                          -- 首单时间
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),

  -- 备注
  notes TEXT
);

-- 索引
CREATE INDEX idx_students_student_number ON students(student_number);
CREATE INDEX idx_students_consultant ON students(consultant_id);
CREATE INDEX idx_students_head_teacher ON students(head_teacher_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_team ON students(team_id);
```

### 1.2 student_profiles 表 (学生详细档案)

存储学生的扩展详细信息。

```sql
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- 联系方式
  contact_method VARCHAR(100),                    -- 联系方式（手动）

  -- 学习偏好
  course_frequency VARCHAR(100),                  -- 课程频次
  class_duration INT,                             -- 单课时长（分钟）
  class_time VARCHAR(200),                        -- 上课时间

  -- 价格信息
  hourly_rate DECIMAL(10, 2),                     -- 课时单价/小时单价

  -- 订单统计
  first_order_month VARCHAR(20),                  -- 首单月份
  renewal_count INT DEFAULT 0,                    -- 续费次数
  renewed_count INT DEFAULT 0,                    -- 被续次数

  -- 课表备注
  schedule_notes TEXT,                            -- 课表备注

  -- 其他信息
  channel VARCHAR(100),                           -- 渠道
  notes TEXT,                                     -- 备注

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(student_id)
);

CREATE INDEX idx_student_profiles_student ON student_profiles(student_id);
```

---

## 2. 订单管理模块

### 2.1 orders 表 (订单主表)

存储所有订单信息（新签、续费）。

```sql
CREATE TABLE orders (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 订单编号
  order_number VARCHAR(100) UNIQUE NOT NULL,      -- 订单序号/课程编号

  -- 学生关联
  student_id UUID NOT NULL REFERENCES students(id),

  -- 订单类型
  order_type VARCHAR(50) NOT NULL,                -- 订单类型: 'new'(新签) / 'renewal'(续费) / 'trial'(试听)

  -- 关联订单
  trial_order_id UUID REFERENCES orders(id),      -- 选择试听（试听转正式）
  renewed_from_order_id UUID REFERENCES orders(id), -- 选择续费订单（原订单ID）

  -- 课程信息
  course_name VARCHAR(200),                       -- 课程名称
  enrollment_subject VARCHAR(100),                -- 报名学科

  -- 课时与价格
  total_hours DECIMAL(10, 2),                     -- 总课时（h）
  total_hours_count INT,                          -- 总小时数
  session_count INT,                              -- 课次
  session_duration INT,                           -- 单课时长（分钟）

  -- 单价信息
  hourly_rate_manual DECIMAL(10, 2),              -- 课时单价（填写）
  hourly_rate_auto DECIMAL(10, 2),                -- 单价（自动）

  -- 付款信息
  payment_channel VARCHAR(100),                   -- 付款渠道
  payment_amount DECIMAL(10, 2),                  -- 付款金额
  payment_proof TEXT,                             -- 付款凭证（URL或JSON数组）
  payment_time TIMESTAMP,                         -- 付费时间
  payment_month VARCHAR(20),                      -- 付费月份

  -- 人员信息
  consultant_id UUID REFERENCES user_profiles(id), -- 签单顾问
  consultant_position VARCHAR(100),               -- 顾问职位
  head_teacher_id UUID REFERENCES user_profiles(id), -- 班主任
  operator_id UUID REFERENCES user_profiles(id),  -- 对应运营
  sales_leader_id UUID REFERENCES user_profiles(id), -- 销售leader

  -- 组织信息
  team_id VARCHAR(100),                           -- 所属团队

  -- 时间信息
  first_class_time TIMESTAMP,                     -- 首次课时间
  first_order_time TIMESTAMP,                     -- 首单时间
  enrollment_date DATE,                           -- 报名日期

  -- 渠道信息
  channel VARCHAR(100),                           -- 渠道
  trial_order_number VARCHAR(100),                -- 试听单号

  -- 排课模式
  schedule_mode VARCHAR(100),                     -- 排课模式
  fixed_mode VARCHAR(100),                        -- 固定模式
  frequency VARCHAR(100),                         -- 频次
  class_frequency VARCHAR(100),                   -- 上课频次

  -- 状态信息
  status VARCHAR(50) DEFAULT 'active',            -- 订单状态: 'active' / 'completed' / 'cancelled' / 'suspended'

  -- 课程状态
  course_status VARCHAR(100),                     -- 课程状态
  course_progress TEXT,                           -- 课程进度（JSON或文本）

  -- 结课信息
  is_finished_manual BOOLEAN DEFAULT FALSE,       -- 是否结课（手动）
  is_finished_confirmed BOOLEAN DEFAULT FALSE,    -- 是否确认最后一课
  actual_end_date DATE,                           -- 【确定】最后一课日期
  estimated_end_date DATE,                        -- 最后一课提醒日期

  -- 统计信息
  renewal_count INT DEFAULT 0,                    -- 续费次数
  renewed_count INT DEFAULT 0,                    -- 被续次数

  -- ClassIn 信息
  classin_end_time TIMESTAMP,                     -- classin最后一课时间

  -- 学生状态
  student_status VARCHAR(100),                    -- 学生状态
  handover_to_formal BOOLEAN DEFAULT FALSE,       -- 正式生交接

  -- 备注
  notes TEXT,                                     -- 订单备注

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id)
);

-- 索引
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_student ON orders(student_id);
CREATE INDEX idx_orders_consultant ON orders(consultant_id);
CREATE INDEX idx_orders_head_teacher ON orders(head_teacher_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_team ON orders(team_id);
CREATE INDEX idx_orders_trial ON orders(trial_order_id);
CREATE INDEX idx_orders_renewal ON orders(renewed_from_order_id);
```

---

## 3. 课程管理模块

### 3.1 courses 表 (课程详细排课)

存储详细的课程排课信息。

```sql
CREATE TABLE courses (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联订单
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- 课程基本信息
  course_name VARCHAR(200),                       -- 课程名称
  subject VARCHAR(100),                           -- 学科
  grade VARCHAR(50),                              -- 年级
  region VARCHAR(100),                            -- 地域

  -- 老师信息
  teacher_id UUID REFERENCES teacher_profiles(id), -- 授课老师

  -- 课时信息
  session_count INT,                              -- 课次
  session_duration INT,                           -- 单课时长（分钟）
  total_hours DECIMAL(10, 2),                     -- 总课时（h）

  -- 排课模式
  schedule_mode VARCHAR(100),                     -- 排课模式
  fixed_mode VARCHAR(100),                        -- 固定模式
  frequency VARCHAR(100),                         -- 频次
  class_frequency VARCHAR(100),                   -- 上课频次

  -- 时间安排
  first_class_time TIMESTAMP,                     -- 首次课时间
  end_date DATE,                                  -- 课表截至
  classin_end_time TIMESTAMP,                     -- classin最后一课时间

  -- 课程状态
  course_status VARCHAR(100),                     -- 课程状态
  progress TEXT,                                  -- 课程进度（JSON或文本）

  -- 结课信息
  is_finished_manual BOOLEAN DEFAULT FALSE,       -- 是否结课（手动）
  is_finished_confirmed BOOLEAN DEFAULT FALSE,    -- 是否确认最后一课
  actual_end_date DATE,                           -- 【确定】最后一课日期
  estimated_end_date DATE,                        -- 最后一课提醒日期

  -- 学生信息
  student_status VARCHAR(100),                    -- 学生状态
  handover_to_formal BOOLEAN DEFAULT FALSE,       -- 正式生交接

  -- 回访信息
  last_visit_time TIMESTAMP,                      -- 最新回访时间
  next_visit_time TIMESTAMP,                      -- 下次回访时间

  -- 课耗信息
  course_consumption_info TEXT,                   -- 课耗信息（JSON）
  course_consumption_images TEXT,                 -- 课耗图片（JSON数组）

  -- ClassIn 关联
  classin_course_id BIGINT,                       -- ClassIn 班级ID

  -- 备注
  notes TEXT,                                     -- 备注

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(order_id)
);

CREATE INDEX idx_courses_order ON courses(order_id);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_courses_status ON courses(course_status);
CREATE INDEX idx_courses_classin ON courses(classin_course_id);
```

### 3.2 class_sessions 表 (具体课次)

存储每节课的具体安排。

```sql
CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- 课次信息
  session_number INT,                             -- 课次号
  session_name VARCHAR(200),                      -- 课次名称

  -- 时间信息
  start_time TIMESTAMP,                           -- 开始时间
  end_time TIMESTAMP,                             -- 结束时间

  -- 状态
  status VARCHAR(50) DEFAULT 'scheduled',         -- 状态: 'scheduled' / 'completed' / 'cancelled'

  -- 关联
  teacher_id UUID REFERENCES teacher_profiles(id),
  classroom_id BIGINT,                            -- ClassIn 课堂ID

  -- 作业与反馈
  homework_assigned TEXT,                         -- 布置的作业
  homework_feedback TEXT,                         -- 作业反馈
  session_notes TEXT,                             -- 课次笔记

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_class_sessions_course ON class_sessions(course_id);
CREATE INDEX idx_class_sessions_time ON class_sessions(start_time);
CREATE INDEX idx_class_sessions_status ON class_sessions(status);
```

---

## 4. 排课管理模块

### 4.1 schedule_templates 表 (排课模板)

存储常用的排课模板。

```sql
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 模板信息
  name VARCHAR(200) NOT NULL,                     -- 模板名称
  description TEXT,                               -- 描述

  -- 排课规则
  frequency VARCHAR(100),                         -- 频次: 'weekly', 'biweekly', 'monthly'
  day_of_week INT,                                -- 星期几 (1-7)
  time_slot VARCHAR(50),                          -- 时间段: '19:00-21:00'

  -- 默认值
  default_session_duration INT DEFAULT 120,       -- 默认单课时长
  default_subject VARCHAR(100),                   -- 默认学科

  -- 适用范围
  applicable_grades VARCHAR(200)[],               -- 适用年级（数组）

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX idx_schedule_templates_name ON schedule_templates(name);
```

### 4.2 class_schedules 表 (课程日历)

存储具体的排课日历记录。

```sql
CREATE TABLE class_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id UUID REFERENCES class_sessions(id) ON DELETE SET NULL,

  -- 日历信息
  title VARCHAR(200),                             -- 标题
  description TEXT,                               -- 描述

  -- 时间
  start_time TIMESTAMP NOT NULL,                  -- 开始时间
  end_time TIMESTAMP NOT NULL,                    -- 结束时间

  -- 参与者
  teacher_id UUID REFERENCES teacher_profiles(id),
  student_id UUID REFERENCES students(id),

  -- 状态
  status VARCHAR(50) DEFAULT 'scheduled',         -- 'scheduled', 'completed', 'cancelled'

  -- 颜色标记
  color VARCHAR(20),                              -- 自定义颜色

  -- 提醒
  reminder_sent BOOLEAN DEFAULT FALSE,            -- 是否已发送提醒
  reminder_time TIMESTAMP,                        -- 提醒时间

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_class_schedules_course ON class_schedules(course_id);
CREATE INDEX idx_class_schedules_time ON class_schedules(start_time, end_time);
CREATE INDEX idx_class_schedules_teacher ON class_schedules(teacher_id);
CREATE INDEX idx_class_schedules_student ON class_schedules(student_id);
```

---

## 5. 回访管理模块

### 5.1 visit_records 表 (回访记录)

存储所有回访记录。

```sql
CREATE TABLE visit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联信息
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,

  -- 回访信息
  visit_date DATE NOT NULL,                       -- 回访日期
  visit_time TIMESTAMP,                           -- 回访具体时间
  visit_method VARCHAR(100),                      -- 回访方式: 'phone', 'wechat', 'offline', 'video'
  visit_type VARCHAR(100),                        -- 回访类型: 'regular', 'follow_up', 'complaint', 'parent_meeting'

  -- 家长反馈
  parent_attitude VARCHAR(100),                   -- 家长态度: 'satisfied', 'neutral', 'dissatisfied'
  parent_feedback TEXT,                           -- 家长反馈内容

  -- 回访内容
  visit_notes TEXT NOT NULL,                      -- 回访备注
  month_notes TEXT,                               -- 月度回访备注（如"12月回访备注"）

  -- 回访人员
  visit_personnel UUID NOT NULL REFERENCES user_profiles(id), -- 回访人员

  -- 监课反馈
  monitoring_screenshots TEXT,                    -- 监课反馈截图（JSON数组）

  -- 关联记录
  parent_record_id UUID REFERENCES visit_records(id), -- 父记录（用于关联上级回访）

  -- 下次计划
  next_visit_date DATE,                           -- 下次回访日期
  next_visit_notes TEXT,                          -- 下次回访计划

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 确保同一学生同一天只有一条主回访记录
  CONSTRAINT unique_daily_visit UNIQUE (student_id, visit_date, parent_record_id)
);

CREATE INDEX idx_visit_records_student ON visit_records(student_id);
CREATE INDEX idx_visit_records_order ON visit_records(order_id);
CREATE INDEX idx_visit_records_course ON visit_records(course_id);
CREATE INDEX idx_visit_records_date ON visit_records(visit_date);
CREATE INDEX idx_visit_records_personnel ON visit_records(visit_personnel);
CREATE INDEX idx_visit_records_parent ON visit_records(parent_record_id);
```

### 5.2 visit_templates 表 (回访模板)

存储常用回访话术模板。

```sql
CREATE TABLE visit_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 模板信息
  name VARCHAR(200) NOT NULL,                     -- 模板名称
  category VARCHAR(100),                          -- 分类: 'regular', 'follow_up', 'complaint', 'parent_meeting'
  visit_type VARCHAR(100),                        -- 适用回访类型

  -- 模板内容
  template_content TEXT,                          -- 模板内容
  questions TEXT[],                               -- 常见问题（数组）

  -- 适用场景
  applicable_order_types VARCHAR(100)[],          -- 适用订单类型
  applicable_student_statuses VARCHAR(100)[],     -- 适用学生状态

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX idx_visit_templates_category ON visit_templates(category);
```

---

## 6. 异动管理模块

### 6.1 course_changes 表 (课程异动)

存储所有课程异动记录。

```sql
CREATE TABLE course_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联信息
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,

  -- 异动信息
  change_type VARCHAR(100) NOT NULL,              -- 异动类型:
                                                  -- 'pause' - 暂停课程
                                                  -- 'resume' - 恢复课程
                                                  -- 'change_teacher' - 换老师
                                                  -- 'adjust_time' - 调整时间
                                                  -- 'extend' - 延期
                                                  -- 'terminate' - 终止课程
                                                  -- 'upgrade' - 升级课程
                                                  -- 'downgrade' - 降级课程

  change_date DATE NOT NULL,                      -- 异动日期
  effective_date DATE,                            -- 生效日期

  -- 异动详情
  reason TEXT NOT NULL,                           -- 异动原因
  description TEXT,                               -- 详细描述

  -- 变更内容
  changes_before JSONB,                           -- 变更前数据
  changes_after JSONB,                            -- 变更后数据

  -- 人员信息
  handled_by UUID NOT NULL REFERENCES user_profiles(id), -- 处理人
  approved_by UUID REFERENCES user_profiles(id),  -- 审批人

  -- 状态
  status VARCHAR(50) DEFAULT 'pending',           -- 'pending', 'approved', 'rejected', 'completed'

  -- 父级记录（支持多层级关联）
  parent_record UUID REFERENCES course_changes(id), -- 父记录
  parent_record_2 UUID REFERENCES course_changes(id), -- 父记录2
  parent_record_3 UUID REFERENCES course_changes(id), -- 父记录3

  -- 统计
  estimated_consumption DECIMAL(10, 2),           -- 毛估课耗

  -- 附件
  attachments TEXT,                               -- 附件（JSON数组）

  -- 备注
  notes TEXT,                                     -- 备注

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_course_changes_student ON course_changes(student_id);
CREATE INDEX idx_course_changes_order ON course_changes(order_id);
CREATE INDEX idx_course_changes_course ON course_changes(course_id);
CREATE INDEX idx_course_changes_type ON course_changes(change_type);
CREATE INDEX idx_course_changes_date ON course_changes(change_date);
CREATE INDEX idx_course_changes_status ON course_changes(status);
CREATE INDEX idx_course_changes_handler ON course_changes(handled_by);
```

---

## 7. 待办事项模块

### 7.1 todos 表 (待办事项)

存储所有待办事项。

```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 基本信息
  title VARCHAR(500) NOT NULL,                    -- 标题
  description TEXT,                               -- 描述

  -- 关联信息
  related_type VARCHAR(100) NOT NULL,             -- 关联类型: 'student', 'order', 'course', 'teacher'
  related_id UUID NOT NULL,                       -- 关联ID

  -- 优先级
  priority VARCHAR(50) DEFAULT 'medium',          -- 优先级: 'low', 'medium', 'high', 'urgent'

  -- 状态
  status VARCHAR(50) DEFAULT 'pending',           -- 状态: 'pending', 'in_progress', 'completed', 'cancelled'

  -- 时间
  due_date DATE,                                  -- 截止日期
  due_time TIMESTAMP,                             -- 截止时间
  completed_at TIMESTAMP,                         -- 完成时间

  -- 负责人
  assigned_to UUID REFERENCES user_profiles(id),  -- 分配给
  created_by UUID NOT NULL REFERENCES user_profiles(id), -- 创建人

  -- 提醒
  reminder_sent BOOLEAN DEFAULT FALSE,            -- 是否已发送提醒
  reminder_time TIMESTAMP,                        -- 提醒时间

  -- 标签
  tags VARCHAR(100)[],                            -- 标签（数组）

  -- 备注
  notes TEXT,                                     -- 备注

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_todos_related ON todos(related_type, related_id);
CREATE INDEX idx_todos_assigned ON todos(assigned_to);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_due ON todos(due_date);
CREATE INDEX idx_todos_priority ON todos(priority);
```

---

## 8. 复合视图定义

### 8.1 订单管理视图 (order_management_view)

```sql
CREATE OR REPLACE VIEW order_management_view AS
SELECT
  -- 订单基础信息
  o.id AS order_id,
  o.order_number AS 课程编号,
  o.student_id AS 选择学生,
  s.name AS 学生姓名,
  CONCAT(s.name, '-', o.order_number) AS 姓名序号,
  s.grade AS 年级,

  -- 订单详情
  o.order_type AS 订单类型,
  o.enrollment_subject AS 报名学科,
  o.trial_order_id AS 选择试听,
  o.renewed_from_order_id AS 选择续费订单,
  o.total_hours AS 总课时h,
  o.hourly_rate_manual AS 小时单价_手动,
  o.hourly_rate_auto AS 单价_自动,
  o.payment_channel AS 付款渠道,
  o.payment_amount AS 付款金额,
  o.total_hours_count AS 总小时数,
  o.payment_proof AS 付款凭证,
  o.payment_time AS 付费时间,

  -- 人员信息
  up1.name AS 签单顾问,
  o.consultant_position AS 顾问职位,
  up2.name AS 班主任,
  up3.name AS 对应运营,
  up4.name AS 销售leader,

  -- 组织信息
  o.team_id AS 所属团队,

  -- 课程信息
  o.course_name AS 课程名称,
  c.session_count AS 课次,
  c.session_duration AS 单课时长,
  c.teacher_id AS 老师,
  o.fixed_mode AS 固定模式,
  o.frequency AS 频次,
  o.class_frequency AS 上课频次,
  o.first_class_time AS 首次课时间,
  c.region AS 地域,
  o.schedule_mode AS 排课模式,

  -- 时间信息
  o.enrollment_date AS 报名日期,
  c.first_class_time AS 首次课时间,
  o.first_order_time AS 首单时间,
  o.payment_month AS 付费月份,

  -- 结课信息
  c.classin_end_time AS classin最后一课时间,
  o.is_finished_manual AS 是否结课_手动,
  c.is_finished_confirmed AS 是否确认最后一课,
  o.actual_end_date AS 最后一课日期,
  o.estimated_end_date AS 最后一课提醒日期,

  -- 课程状态
  c.course_status AS 课程状态,
  c.progress AS 课程进度,

  -- 统计信息
  o.renewal_count AS 续费次数,
  o.renewed_count AS 被续次数,

  -- 学生状态
  c.student_status AS 学生状态,
  s.handover_to_formal AS 正式生交接,

  -- 备注
  o.notes AS 订单备注,
  c.notes AS 课程备注,
  c.course_consumption_info AS 课耗信息,
  c.course_consumption_images AS 课耗图片,

  -- 回访统计
  (
    SELECT COUNT(*)
    FROM visit_records vr
    WHERE vr.order_id = o.id
  ) AS 回访记录数,
  (
    SELECT MAX(vr.visit_date)
    FROM visit_records vr
    WHERE vr.order_id = o.id
  ) AS 最新回访时间,
  (
    SELECT MIN(vr.visit_date)
    FROM visit_records vr
    WHERE vr.order_id = o.id
      AND vr.visit_date > CURRENT_DATE
  ) AS 下次回访时间,

  -- 待办统计
  (
    SELECT COUNT(*)
    FROM todos t
    WHERE t.related_id = o.id
      AND t.related_type = 'order'
      AND t.status = 'pending'
  ) AS 待办事项数,

  -- 异动统计
  (
    SELECT COUNT(*)
    FROM course_changes cc
    WHERE cc.course_id = c.id
  ) AS 异动次数,

  -- 其他信息
  o.channel AS 渠道,
  o.trial_order_number AS 试听单号,
  o.created_at AS 订单创建时间

FROM orders o
LEFT JOIN students s ON o.student_id = s.id
LEFT JOIN user_profiles up1 ON o.consultant_id = up1.id
LEFT JOIN user_profiles up2 ON o.head_teacher_id = up2.id
LEFT JOIN user_profiles up3 ON o.operator_id = up3.id
LEFT JOIN user_profiles up4 ON o.sales_leader_id = up4.id
LEFT JOIN courses c ON o.id = c.order_id;
```

### 8.2 学生管理视图 (student_management_view)

```sql
CREATE OR REPLACE VIEW student_management_view AS
SELECT
  -- 学生基础信息
  s.id AS student_id,
  s.student_number AS 学号ID,
  s.created_at AS 创建日期,
  s.child_nickname AS 孩子称呼,
  s.name AS 学生姓名,
  s.grade AS 年级,
  s.region AS 地域,
  s.school AS 学校,

  -- 人员信息
  up1.name AS 对应顾问,
  s.parent_phone AS 家长电话号,
  up2.name AS 学员创建人,
  s.consultant_id AS 顾问ID,
  s.head_teacher_id AS 班主任ID,
  s.sales_leader_id AS 销售leader,
  s.operator_id AS 对应运营,
  s.team_id AS 所属团队,

  -- 联系方式
  s.parent_wechat AS 家长微信,
  sp.contact_method AS 联系方式,

  -- 订单统计
  (
    SELECT COUNT(*)
    FROM orders o
    WHERE o.student_id = s.id
  ) AS 课程订单数,

  -- 最近订单信息
  (
    SELECT json_agg(json_build_object(
      'order_number', o.order_number,
      'course_name', o.course_name,
      'enrollment_subject', o.enrollment_subject,
      'order_type', o.order_type,
      'total_hours', o.total_hours,
      'status', o.status
    ) ORDER BY o.created_at DESC)
    FROM orders o
    WHERE o.student_id = s.id
    LIMIT 5
  ) AS 课程订单,

  -- 报名学科
  (
    SELECT DISTINCT array_agg(o.enrollment_subject)
    FROM orders o
    WHERE o.student_id = s.id
      AND o.enrollment_subject IS NOT NULL
  ) AS 报名学科,

  -- 回访统计
  (
    SELECT COUNT(*)
    FROM visit_records vr
    WHERE vr.student_id = s.id
  ) AS 回访次数,

  (
    SELECT MAX(vr.visit_date)
    FROM visit_records vr
    WHERE vr.student_id = s.id
  ) AS 最近跟进时间,

  -- 异动统计
  (
    SELECT COUNT(*)
    FROM course_changes cc
    WHERE cc.student_id = s.id
  ) AS 异动次数,

  -- 待办统计
  (
    SELECT COUNT(*)
    FROM todos t
    WHERE t.related_id = s.id
      AND t.related_type = 'student'
      AND t.status = 'pending'
  ) AS 待办事项数,

  -- 学生状态
  s.status AS 学生状态,
  s.new_student_status AS 新生状态,
  s.is_parent_meeting AS 是否家长会,
  s.custom_color AS 自定义颜色,

  -- 学习偏好
  sp.course_frequency AS 课程频次,
  sp.class_duration AS 单课时长,
  sp.class_time AS 上课时间,

  -- 价格信息
  sp.hourly_rate AS 课时单价,

  -- 备注
  s.notes AS 备注,
  sp.schedule_notes AS 课表备注

FROM students s
LEFT JOIN student_profiles sp ON s.id = sp.student_id
LEFT JOIN user_profiles up1 ON s.consultant_id = up1.id
LEFT JOIN user_profiles up2 ON s.created_by = up2.id;
```

---

## 8. 老师面试管理模块

### 8.1 teacher_candidates 表 (候选人主表)

存储老师候选人的核心基础信息。

```sql
CREATE TABLE teacher_candidates (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 来源关联
  daily_lead_id UUID REFERENCES daily_leads(id) ON DELETE SET NULL, -- 从每日线索导入

  -- 基础信息
  candidate_name VARCHAR(100) NOT NULL,          -- 候选人称呼
  wechat_id VARCHAR(100) NOT NULL,               -- 微信号（必填）
  resume_url TEXT,                               -- 简历（URL）

  -- 岗位信息
  grade_level VARCHAR(100) NOT NULL,             -- 年级段
  subjects_taught TEXT[] NOT NULL,               -- 教授学科（数组）
  teacher_type VARCHAR(100),                     -- 老师类型: '全职' / '兼职' / '实习'

  -- 教学特点
  trial_subject VARCHAR(100),                    -- 试讲科目
  teaching_style VARCHAR(200),                   -- 授课风格

  -- 个性化评价
  teacher_feeling VARCHAR(200),                  -- 老师感觉（如：松弛自信、不浮躁、落落大方）
  suitable_for_students VARCHAR(500),            -- 适合学生
  scheduling_preference TEXT,                    -- 排课偏好

  -- 时间统计
  interview_month VARCHAR(20),                   -- 面试月份（格式: 2025-01）
  interview_week VARCHAR(20),                    -- 面试所属周（格式: 2025-W01）

  -- 状态
  status VARCHAR(50) DEFAULT 'pending',           -- 'pending' 待面试 / 'interviewed' 已面试 / 'reviewing' 复核中 / 'hired' 已入库 / 'rejected' 已拒绝

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),            -- 登记日期
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),

  -- 备注
  notes TEXT
);

-- 索引
CREATE INDEX idx_teacher_candidates_wechat ON teacher_candidates(wechat_id);
CREATE INDEX idx_teacher_candidates_daily_lead ON teacher_candidates(daily_lead_id);
CREATE INDEX idx_teacher_candidates_status ON teacher_candidates(status);
CREATE INDEX idx_teacher_candidates_month ON teacher_candidates(interview_month);
CREATE INDEX idx_teacher_candidates_week ON teacher_candidates(interview_week);
```

### 8.2 interview_arrangements 表 (约面安排)

存储面试安排信息。

```sql
CREATE TABLE interview_arrangements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES teacher_candidates(id) ON DELETE CASCADE,

  -- 约面信息
  appointment_date DATE,                         -- 约面日期
  appointed_by UUID REFERENCES user_profiles(id), -- 约面人
  appointed_by_old VARCHAR(100),                 -- 约面人（旧）- 兼容旧数据
  appointment_week VARCHAR(20),                  -- 约面所属周（格式: 2025-W01）

  -- 面试链接
  qr_code TEXT,                                  -- 二维码（图片URL）

  -- 状态
  is_active BOOLEAN DEFAULT TRUE,                -- 是否当前有效的约面

  -- 备注
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_interview_arrangements_candidate ON interview_arrangements(candidate_id);
CREATE INDEX idx_interview_arrangements_date ON interview_arrangements(appointment_date);
```

### 8.3 interview_sessions 表 (面试记录)

存储面试会话的详细信息。

```sql
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES teacher_candidates(id) ON DELETE CASCADE,

  -- 面试时间
  interview_date DATE,                           -- 面试日期
  interview_time TIME,                           -- 面试时间
  interview_link TEXT,                           -- 面试链接（如腾讯会议、Zoom链接）
  interview_week VARCHAR(20),                    -- 面试所属周（格式: 2025-W01）

  -- 面试官
  interviewer UUID REFERENCES user_profiles(id), -- 面试官
  interviewer_old VARCHAR(100),                  -- 面试官（旧）- 兼容旧数据

  -- 面试记录
  interview_video TEXT,                          -- 面试录像（视频文件URL）
  interview_video_link TEXT,                     -- 面试录像（链接版）- 如百度网盘链接
  trial_video TEXT,                              -- 试讲视频（视频文件URL）
  interview_abnormal TEXT,                       -- 面试异常说明

  -- 面试评分表（JSON）
  interview_score_sheet JSONB,                   -- 面试评分表（完整JSON）
  interview_score_total DECIMAL(5, 2),           -- 面试评分表总分

  -- 状态
  status VARCHAR(50) DEFAULT 'scheduled',        -- 'scheduled' 已安排 / 'completed' 已完成 / 'cancelled' 已取消

  -- 备注
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX idx_interview_sessions_date ON interview_sessions(interview_date);
CREATE INDEX idx_interview_sessions_interviewer ON interview_sessions(interviewer);
```

### 8.4 interview_scores 表 (面试评分)

存储面试的详细评分信息。

```sql
CREATE TABLE interview_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,

  -- 总体评分
  interview_score DECIMAL(5, 2),                 -- 面试评价（总分）
  initial_evaluation TEXT,                       -- 初试评价

  -- 分项评分（每项0-10分）
  logical_expression_score DECIMAL(5, 2),        -- 逻辑表达能力
  dress_appearance_score DECIMAL(5, 2),          -- 礼仪着装/精神面貌
  material_preparation_score DECIMAL(5, 2),      -- 课件准备充分度

  -- 考试成绩
  exam_score TEXT,                               -- 中高考分数（格式: "得分/满分"，如 "680/750"）

  -- 其他评分（扩展字段）
  teaching_ability_score DECIMAL(5, 2),          -- 教学能力评分
  communication_score DECIMAL(5, 2),             -- 沟通能力评分
  professionalism_score DECIMAL(5, 2),           -- 专业素养评分

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(interview_session_id)
);

CREATE INDEX idx_interview_scores_session ON interview_scores(interview_session_id);
```

### 8.5 teacher_characteristics 表 (老师素质评价)

存储老师素质特点评价。

```sql
CREATE TABLE teacher_characteristics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES teacher_candidates(id) ON DELETE CASCADE,

  -- 素质评价
  teacher_characteristics TEXT,                  -- 老师特点（综合评价）
  mandarin_level VARCHAR(100),                   -- 普通话水平: '标准' / '二级甲等' / '二级乙等' 等
  research_ability VARCHAR(100),                 -- 教研能力: '强' / '一般' / '弱'
  service_awareness VARCHAR(100),                -- 服务意识: '强' / '一般' / '弱'
  affinity VARCHAR(100),                         -- 亲和力: '强' / '一般' / '弱'

  -- 其他特点
  teaching_experience TEXT,                      -- 教学经验描述
  patience_level VARCHAR(100),                   -- 耐心程度
  responsibility_level VARCHAR(100),             -- 责任心

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(candidate_id)
);

CREATE INDEX idx_teacher_characteristics_candidate ON teacher_characteristics(candidate_id);
```

### 8.6 review_records 表 (复核记录)

存储候选人复核及定薪记录。

```sql
CREATE TABLE review_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES teacher_candidates(id) ON DELETE CASCADE,

  -- 复核状态
  review_status VARCHAR(50) NOT NULL,            -- 复核状态: 'pending' 待复核 / 'reviewed' 已复核 / 'not-suitable' 不合适
  review_date DATE,                              -- 复核日期
  reviewed_by UUID REFERENCES user_profiles(id), -- 复核人

  -- 复核结果
  review_result VARCHAR(100),                    -- 复核结果: '通过' / '不通过' / '待定'
  review_evaluation_comment TEXT,                -- 复核评价（定薪依据）

  -- 薪资信息
  current_rate DECIMAL(10, 2),                   -- 目前课时费（当前薪资）
  approved_hourly_rate DECIMAL(10, 2),           -- 时薪（谈定）- 批准的时薪
  teacher_level VARCHAR(100),                    -- 老师级别: '初级' / '中级' / '高级' / '专家'

  -- 入库决定
  is_hired BOOLEAN DEFAULT FALSE,                -- 是否入库
  can_teach_graduation_class BOOLEAN DEFAULT FALSE, -- 能否排毕业班
  storage_notes TEXT,                            -- 入库备注

  -- 关联记录
  parent_record UUID REFERENCES review_records(id), -- 父记录（支持复核记录的层级关联）

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_records_candidate ON review_records(candidate_id);
CREATE INDEX idx_review_records_status ON review_records(review_status);
CREATE INDEX idx_review_records_date ON review_records(review_date);
```

### 8.7 hire_records 表 (入库记录)

存储候选人转正为老师的入库记录。

```sql
CREATE TABLE hire_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES teacher_candidates(id) ON DELETE CASCADE,

  -- 关联老师档案
  hired_to_teacher UUID REFERENCES teacher_profiles(id) ON DELETE SET NULL, -- 入表老师（关联到teacher_profiles表）

  -- 形象资料
  profile_photo_url TEXT,                        -- 形象照（图片URL）

  -- 入库信息
  hire_date DATE DEFAULT CURRENT_DATE,           -- 入库日期
  hired_by UUID REFERENCES user_profiles(id),    -- 入库操作人

  -- 备注
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(candidate_id)
);

CREATE INDEX idx_hire_records_candidate ON hire_records(candidate_id);
CREATE INDEX idx_hire_records_teacher ON hire_records(hired_to_teacher);
```

---

## 9. 复合视图定义

### 9.1 老师面试管理视图 (teacher_interview_view)

聚合候选人、约面、面试、评分、素质评价、复核、入库等所有信息。

```sql
CREATE OR REPLACE VIEW teacher_interview_view AS
SELECT
  -- ========== 候选人基础信息 ==========
  tc.id AS candidate_id,
  tc.candidate_name AS 候选人称呼,
  tc.wechat_id AS 微信号,
  tc.resume_url AS 简历,
  tc.grade_level AS 年级段,
  tc.subjects_taught AS 教授学科,
  tc.teacher_type AS 老师类型,
  tc.trial_subject AS 试讲科目,
  tc.teaching_style AS 授课风格,
  tc.teacher_feeling AS 老师感觉,
  tc.suitable_for_students AS 适合学生,
  tc.scheduling_preference AS 排课偏好,
  tc.status AS 候选人状态,
  tc.interview_month AS 面试月份,
  tc.interview_week AS 面试所属周,
  tc.created_at AS 登记日期,

  -- ========== 约面信息 ==========
  ia.appointment_date AS 约面日期,
  ia.appointed_by_id AS 约面人_id,
  ia.appointed_by_name AS 约面人,
  ia.appointed_by_old AS 约面人_旧,
  ia.appointment_week AS 约面所属周,
  ia.qr_code AS 二维码,

  -- ========== 面试信息 ==========
  ins.id AS interview_session_id,
  ins.interview_date AS 面试日期,
  ins.interview_time AS 面试时间,
  ins.interview_link AS 面试链接,
  ins.interviewer_id AS 面试官_id,
  ins.interviewer_name AS 面试官,
  ins.interviewer_old AS 面试官_旧,
  ins.interview_week AS 面试官_所属周,
  ins.interview_video AS 面试录像,
  ins.interview_video_link AS 面试录像_链接版,
  ins.trial_video AS 试讲视频,
  ins.interview_abnormal AS 面试异常,
  ins.interview_score_sheet AS 面试评分表,
  ins.interview_score_total AS 面试评分表总分,

  -- ========== 面试评分 ==========
  iscores.interview_score AS 面试评价,
  iscores.initial_evaluation AS 初试评价,
  iscores.logical_expression_score AS 逻辑表达能力,
  iscores.dress_appearance_score AS 礼仪着装_精神面貌,
  iscores.material_preparation_score AS 课件准备充分度,
  iscores.exam_score AS 中高考分数,
  iscores.teaching_ability_score AS 教学能力评分,
  iscores.communication_score AS 沟通能力评分,
  iscores.professionalism_score AS 专业素养评分,

  -- ========== 老师素质评价 ==========
  tch.teacher_characteristics AS 老师特点,
  tch.mandarin_level AS 普通话水平,
  tch.research_ability AS 教研能力,
  tch.service_awareness AS 服务意识,
  tch.affinity AS 亲和力,
  tch.teaching_experience AS 教学经验,

  -- ========== 复核信息 ==========
  rr.id AS review_record_id,
  rr.review_status AS 复核状态,
  rr.review_date AS 复核日期,
  rr.reviewed_by_id AS 复核人_id,
  rr.reviewed_by_name AS 复核人,
  rr.review_result AS 复核结果,
  rr.review_evaluation_comment AS 复核评价_定薪,
  rr.current_rate AS 目前课时费,
  rr.approved_hourly_rate AS 时薪_谈定,
  rr.teacher_level AS 老师级别,
  rr.is_hired AS 是否入库,
  rr.can_teach_graduation_class AS 能否排毕业班,
  rr.storage_notes AS 入库备注,
  rr.parent_record AS 父记录,

  -- ========== 入库信息 ==========
  hr.hired_to_teacher AS 入表老师_id,
  hr.profile_photo_url AS 形象照,
  hr.hire_date AS 入库日期,

  -- ========== 聚合统计 ==========
  (
    SELECT DISTINCT array_agg(DISTINCT ia2.appointed_by_name)
    FROM interview_arrangements ia2
    WHERE ia2.candidate_id = tc.id
  ) AS 约面人_总,

  (
    SELECT DISTINCT array_agg(DISTINCT ins2.interviewer_name)
    FROM interview_sessions ins2
    WHERE ins2.candidate_id = tc.id
  ) AS 面试官_总,

  (
    SELECT COUNT(*)
    FROM interview_sessions ins2
    WHERE ins2.candidate_id = tc.id
  ) AS 面试次数,

  (
    SELECT COUNT(*)
    FROM review_records rr2
    WHERE rr2.candidate_id = tc.id
  ) AS 复核次数

FROM teacher_candidates tc
LEFT JOIN interview_arrangements ia ON tc.id = ia.candidate_id AND ia.is_active = true
LEFT JOIN interview_sessions ins ON tc.id = ins.candidate_id AND ins.status = 'completed'
LEFT JOIN interview_scores iscores ON ins.id = iscores.interview_session_id
LEFT JOIN teacher_characteristics tch ON tc.id = tch.candidate_id
LEFT JOIN review_records rr ON tc.id = rr.candidate_id AND rr.review_status = 'reviewed'
LEFT JOIN hire_records hr ON tc.id = hr.candidate_id
LEFT JOIN user_profiles ia_user ON ia.appointed_by = ia_user.id
LEFT JOIN user_profiles ins_user ON ins.interviewer = ins_user.id
LEFT JOIN user_profiles rr_user ON rr.reviewed_by = rr_user.id;
```

---

## 10. 权限控制策略 (RLS)

### 10.1 Row Level Security 启用

```sql
-- 启用 RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_records ENABLE ROW LEVEL SECURITY;

-- 创建策略函数
CREATE OR REPLACE FUNCTION check_role_access(role TEXT, resource_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 管理员可以访问所有
  IF role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- 运营可以访问自己的线索
  IF role = 'operator' THEN
    RETURN EXISTS (
      SELECT 1 FROM students
      WHERE id = resource_id AND operator_id = auth.uid()
    );
  END IF;

  -- 销售可以访问自己的学生
  IF role = 'sales' THEN
    RETURN EXISTS (
      SELECT 1 FROM students
      WHERE id = resource_id AND consultant_id = auth.uid()
    );
  END IF;

  -- 班主任可以访问自己的学生
  IF role = 'head_teacher' THEN
    RETURN EXISTS (
      SELECT 1 FROM students
      WHERE id = resource_id AND head_teacher_id = auth.uid()
    );
  END IF;

  -- 教务可以访问所有
  IF role = 'academic_affairs' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 11. 数据迁移脚本

### 11.1 创建所有表

```sql
-- 注意: 需要先安装 uuid-ossp 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 按照依赖顺序创建表:
-- 1. students (无依赖)
-- 2. student_profiles (依赖 students)
-- 3. teacher_profiles (无依赖)
-- 4. teacher_candidates (无依赖)
-- 5. interview_arrangements (依赖 teacher_candidates)
-- 6. interview_sessions (依赖 teacher_candidates)
-- 7. interview_scores (依赖 interview_sessions)
-- 8. teacher_characteristics (依赖 teacher_candidates)
-- 9. review_records (依赖 teacher_candidates)
-- 10. hire_records (依赖 teacher_candidates)
-- 11. orders (依赖 students)
-- 12. courses (依赖 orders)
-- 13. class_sessions (依赖 courses)
-- 14. class_schedules (依赖 courses, class_sessions)
-- 15. visit_records (依赖 students, orders, courses)
-- 16. course_changes (依赖 students, orders, courses)
-- 17. todos (独立)
-- 18. schedule_templates (独立)
-- 19. visit_templates (独立)
```

---

## 12. 字段说明与业务规则

### 12.1 订单状态流转

```
新签订单流程:
draft → active → completed / cancelled / suspended
  ↓        ↓
续费 →  active
```

### 12.2 课程状态流转

```
scheduled → in_progress → completed / cancelled / suspended
```

### 12.3 面试流程状态流转

```
每日线索 → 候选人登记 → 约面 → 面试 → 评分 → 复核 → 入库 → 老师档案
pending   pending       arranged scheduled completed reviewing hired  teacher_profile
```

### 12.4 异动类型说明

- **pause**: 暂停课程（保留课时，暂停排课）
- **resume**: 恢复课程（从暂停中恢复）
- **change_teacher**: 更换授课老师
- **adjust_time**: 调整上课时间
- **extend**: 延长课程有效期
- **terminate**: 提前终止课程
- **upgrade**: 课程升级（如从单科升级为全科）
- **downgrade**: 课程降级

### 12.5 权限矩阵

| 操作 | 销售 | 运营 | 班主任 | 教务 | 管理员 |
|------|------|------|--------|------|--------|
| 新增学生 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 录入新签订单 | ✓ | ✗ | ✗ | ✓ | ✓ |
| 录入续费订单 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 编辑订单 | 部分 | ✗ | 部分 | ✓ | ✓ |
| 排课 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 回访记录 | ✓ | ✗ | ✓ | ✓ | ✓ |
| 异动申请 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 老师面试管理 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 复核定薪 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 删除数据 | ✗ | ✗ | ✗ | ✓ | ✓ |

---

## 13. 性能优化建议

### 13.1 索引策略

已在各表定义中包含关键字段的索引。

### 13.2 分区策略

对于大数据量表，建议按时间分区:
- `orders` 按 `created_at` 分区
- `visit_records` 按 `visit_date` 分区
- `course_changes` 按 `change_date` 分区
- `interview_sessions` 按 `interview_date` 分区
- `teacher_candidates` 按 `created_at` 分区

### 13.3 查询优化

- 使用视图简化复杂查询
- 避免过多的子查询
- 使用物化视图缓存统计结果

---

## 14. 备份与恢复

### 14.1 定期备份

```bash
# 每日全量备份
pg_dump -U postgres -d xiaoniuhaoxue > backup_$(date +%Y%m%d).sql

# 仅备份特定表
pg_dump -U postgres -d xiaoniuhaoxue -t students -t orders > backup_tables.sql
```

### 14.2 恢复流程

```bash
# 恢复数据库
psql -U postgres -d xiaoniuhaoxue < backup_20250101.sql
```

---

## 15. 附录

### 15.1 枚举值定义

#### order_type (订单类型)
- `new`: 新签订单
- `renewal`: 续费订单
- `trial`: 试听订单

#### order_status (订单状态)
- `active`: 活跃
- `completed`: 已完成
- `cancelled`: 已取消
- `suspended`: 已暂停

#### visit_method (回访方式)
- `phone`: 电话
- `wechat`: 微信
- `offline`: 线下
- `video`: 视频

#### parent_attitude (家长态度)
- `satisfied`: 满意
- `neutral`: 一般
- `dissatisfied`: 不满意

#### candidate_status (候选人状态)
- `pending`: 待面试
- `interviewed`: 已面试
- `reviewing`: 复核中
- `hired`: 已入库
- `rejected`: 已拒绝

#### review_status (复核状态)
- `pending`: 待复核
- `reviewed`: 已复核
- `not-suitable`: 不合适

#### teacher_level (老师级别)
- `初级`: 初级老师
- `中级`: 中级老师
- `高级`: 高级老师
- `专家`: 专家级老师

### 15.2 外键关系图

```
-- 学生订单流程
students (1) ----< (N) orders
                    |
                    v
                 courses (1)
                    |
                    +----< (N) class_sessions
                    |
                    +----< (N) class_schedules

students (1) ----< (N) visit_records
students (1) ----< (N) course_changes
students (1) ----< (N) todos

orders (1) ----< (N) visit_records
orders (1) ----< (N) course_changes
orders (1) ----< (N) todos

courses (1) ----< (N) visit_records
courses (1) ----< (N) course_changes
courses (1) ----< (N) class_schedules

-- 老师面试流程
teacher_candidates (1) ----< (N) interview_arrangements
teacher_candidates (1) ----< (N) interview_sessions
                           |
                           v
                    interview_scores (1)
teacher_candidates (1) ----< (N) review_records
teacher_candidates (1) ----< (1) hire_records
                               |
                               v
                        teacher_profiles
```

---

**文档版本**: v1.1
**最后更新**: 2025-01-01
**维护人员**: 开发团队
