-- ============================================
-- 课程管理表（业务层）
-- 基于 class_classin 和 classroom_classin 架构
-- ============================================

-- 课程表（业务层，链接到 ClassIn 课程）
CREATE TABLE IF NOT EXISTS courses (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联关系
  order_id UUID NOT NULL REFERENCES formal_orders(id) ON DELETE CASCADE,
  classin_course_id BIGINT REFERENCES class_classin(course_id) ON DELETE SET NULL,

  -- 课程基本信息
  course_name VARCHAR(200),
  subject VARCHAR(100),
  grade VARCHAR(50),

  -- 教师信息
  teacher_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  teacher_name VARCHAR(100),

  -- 课程统计（冗余字段，便于快速查询）
  session_count INT DEFAULT 0,
  total_hours DECIMAL(10, 2) DEFAULT 0,

  -- 课程状态
  course_status VARCHAR(50) DEFAULT 'active',
    -- active: 进行中
    -- completed: 已完成
    -- suspended: 已暂停
    -- cancelled: 已取消

  -- ClassIn 统计信息（JSON）
  course_consumption_info TEXT,
  -- {
  --   totalSessions: number,
  --   completedSessions: number,
  --   progress: number,
  --   totalHours: number,
  --   actualHours: number,
  --   lastSyncTime: string
  -- }

  -- 备注
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT unique_order_course UNIQUE(order_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_courses_order_id ON courses(order_id);
CREATE INDEX IF NOT EXISTS idx_courses_classin_course_id ON courses(classin_course_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(course_status);

-- 添加注释
COMMENT ON TABLE courses IS '课程表（业务层）';
COMMENT ON COLUMN courses.order_id IS '关联的正式订单ID（一对一关系）';
COMMENT ON COLUMN courses.classin_course_id IS 'ClassIn课程ID（关联到class_classin.course_id）';
COMMENT ON COLUMN courses.course_consumption_info IS '课程消耗统计信息（JSON格式）';

-- ============================================
-- 课时表（业务层，链接到 ClassIn 课堂）
-- ============================================

CREATE TABLE IF NOT EXISTS class_sessions (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联关系
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  classroom_id BIGINT REFERENCES classroom_classin(class_id) ON DELETE SET NULL,

  -- 课时基本信息
  session_number INT NOT NULL,
  session_name VARCHAR(200),

  -- 排课信息
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  scheduled_duration_minutes INT,

  -- 实际上课信息（从 classroom_classin 同步）
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  actual_duration_minutes INT,

  -- 课时状态
  status VARCHAR(50) DEFAULT 'scheduled',
    -- scheduled: 已排课
    -- completed: 已完成
    -- cancelled: 已取消
    -- missed: 缺课

  -- 教师信息
  teacher_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  teacher_name VARCHAR(100),

  -- 学生信息
  student_attendance_status VARCHAR(50),
    -- present: 出席
    -- absent: 缺席
    -- late: 迟到

  -- 课堂备注
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT unique_course_session UNIQUE(course_id, session_number)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_class_sessions_course_id ON class_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_classroom_id ON class_sessions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_scheduled_date ON class_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON class_sessions(status);

-- 添加注释
COMMENT ON TABLE class_sessions IS '课时表（业务层）';
COMMENT ON COLUMN class_sessions.course_id IS '关联的课程ID';
COMMENT ON COLUMN class_sessions.classroom_id IS 'ClassIn课堂ID（关联到classroom_classin.class_id）';
COMMENT ON COLUMN class_sessions.session_number IS '课时序号';
COMMENT ON COLUMN class_sessions.actual_start_time IS '实际开始时间（从classroom_classin同步）';
COMMENT ON COLUMN class_sessions.actual_end_time IS '实际结束时间（从classroom_classin同步）';

-- ============================================
-- 更新时间戳触发器
-- ============================================

-- courses 表更新时间戳
CREATE OR REPLACE FUNCTION update_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_courses_updated_at();

-- class_sessions 表更新时间戳
CREATE OR REPLACE FUNCTION update_class_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_class_sessions_updated_at
  BEFORE UPDATE ON class_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_class_sessions_updated_at();
