-- ============================================
-- 创建学生参与记录表
-- 用于存储从 ClassIn End 回调的 inoutEnd 数据提取的学生参与信息
-- ============================================

-- 创建学生参与记录表
CREATE TABLE IF NOT EXISTS public.class_student_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,                    -- 关联 class_sessions.id
  student_uid INTEGER NOT NULL,                -- 学生 UID (ClassIn)
  identity INTEGER NOT NULL,                   -- 身份：1=学生, 2=旁听, 3=老师, 4=联席教师

  -- 时间数据
  total_time_seconds BIGINT,                   -- 在教室总时长（秒）
  actual_duration_minutes INTEGER,             -- 实际参与时长（分钟）
  first_in_time TIMESTAMPTZ,                   -- 首次进入教室时间
  last_out_time TIMESTAMPTZ,                  -- 最后离开教室时间

  -- 出勤状态
  attendance_status VARCHAR(20) DEFAULT 'absent',
    -- absent: 缺席
    -- present: 出席
    -- late: 迟到或早退

  -- 详细数据（JSON 格式）
  inout_details JSONB,                         -- 进出教室详情

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- 外键约束
  CONSTRAINT fk_session_id FOREIGN KEY (session_id)
    REFERENCES public.class_sessions(id)
    ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_class_student_participation_session_id
  ON public.class_student_participation(session_id);

CREATE INDEX IF NOT EXISTS idx_class_student_participation_student_uid
  ON public.class_student_participation(student_uid);

CREATE INDEX IF NOT EXISTS idx_class_student_participation_attendance_status
  ON public.class_student_participation(attendance_status);

CREATE INDEX IF NOT EXISTS idx_class_student_participation_created_at
  ON public.class_student_participation(created_at DESC);

-- 创建复合索引：查询某节课的所有学生参与情况
CREATE INDEX IF NOT EXISTS idx_class_student_participation_session_attendance
  ON public.class_student_participation(session_id, attendance_status);

-- 添加注释
COMMENT ON TABLE public.class_student_participation IS '学生参与记录 - 从 ClassIn inoutEnd 数据提取';

COMMENT ON COLUMN public.class_student_participation.session_id IS '关联的课节ID (UUID)';
COMMENT ON COLUMN public.class_student_participation.student_uid IS '学生 UID (ClassIn)';
COMMENT ON COLUMN public.class_student_participation.identity IS '身份：1=学生, 2=旁听, 3=老师, 4=联席教师';
COMMENT ON COLUMN public.class_student_participation.total_time_seconds IS '在教室总时长（秒）';
COMMENT ON COLUMN public.class_student_participation.actual_duration_minutes IS '实际参与时长（分钟）';
COMMENT ON COLUMN public.class_student_participation.first_in_time IS '首次进入教室时间';
COMMENT ON COLUMN public.class_student_participation.last_out_time IS '最后离开教室时间';
COMMENT ON COLUMN public.class_student_participation.attendance_status IS '出勤状态：absent=缺席, present=出席, late=迟到或早退';
COMMENT ON COLUMN public.class_student_participation.inout_details IS '进出教室详情（JSON）';

-- 启用 RLS（行级安全）
ALTER TABLE public.class_student_participation ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：只有认证用户可以读取
CREATE POLICY "Authenticated users can view student participation"
  ON public.class_student_participation
  FOR SELECT
  TO authenticated
  USING (true);

-- 创建 RLS 策略：只有认证用户可以插入（通过API）
CREATE POLICY "Authenticated users can insert student participation"
  ON public.class_student_participation
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 创建 RLS 策略：只有认证用户可以更新
CREATE POLICY "Authenticated users can update student participation"
  ON public.class_student_participation
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 创建 RLS 策略：只有认证用户可以删除
CREATE POLICY "Authenticated users can delete student participation"
  ON public.class_student_participation
  FOR DELETE
  TO authenticated
  USING (true);
