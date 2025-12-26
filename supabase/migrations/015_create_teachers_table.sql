-- 创建 teachers 表
-- 专门用于存储从 ClassIn 同步的老师数据，与 ClassIn 系统对齐

CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 核心字段
  classin_uid BIGINT NOT NULL UNIQUE,    -- ClassIn 唯一标识符
  name TEXT NOT NULL,                     -- 老师姓名
  mobile TEXT,                            -- 手机号
  email TEXT,                             -- 邮箱
  gender TEXT,                            -- 性别
  location TEXT,                          -- 所在地

  -- 教学信息
  subject TEXT,                           -- 教授科目
  grade TEXT,                             -- 教授年级
  teach_type TEXT,                        -- 教学类型
  education TEXT,                         -- 学历
  university TEXT,                        -- 毕业院校

  -- ClassIn 特有字段
  school_uid BIGINT,                      -- 学校编号
  join_type INTEGER,                      -- 加入类型
  serve_state INTEGER,                    -- 服务状态
  tea_id BIGINT,                          -- 老师ID
  is_del INTEGER DEFAULT 0,               -- 是否删除

  -- 状态字段
  status TEXT DEFAULT 'active',           -- 本地状态
  sync_time TIMESTAMPTZ,                  -- 最后同步时间
  notes TEXT,                             -- 备注

  -- ClassIN 额外信息
  classin_extra JSONB                     -- ClassIn 额外信息 (JSON格式)
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_classin_uid ON public.teachers(classin_uid);
CREATE INDEX IF NOT EXISTS idx_teachers_mobile ON public.teachers(mobile);
CREATE INDEX IF NOT EXISTS idx_teachers_school_uid ON public.teachers(school_uid);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON public.teachers(status);
CREATE INDEX IF NOT EXISTS idx_teachers_subject ON public.teachers(subject);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_teachers_updated_at ON public.teachers;
CREATE TRIGGER update_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 策略：允许所有认证用户操作
CREATE POLICY "Authenticated users can view teachers"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teachers"
  ON public.teachers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teachers"
  ON public.teachers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete teachers"
  ON public.teachers FOR DELETE
  TO authenticated
  USING (true);

-- 添加注释
COMMENT ON TABLE public.teachers IS 'ClassIn 老师数据表，与 ClassIn 系统对齐';
COMMENT ON COLUMN public.teachers.classin_uid IS 'ClassIn 唯一标识符（uid）';
COMMENT ON COLUMN public.teachers.name IS '老师姓名';
COMMENT ON COLUMN public.teachers.mobile IS '手机号';
COMMENT ON COLUMN public.teachers.email IS '邮箱';
COMMENT ON COLUMN public.teachers.gender IS '性别';
COMMENT ON COLUMN public.teachers.location IS '所在地';
COMMENT ON COLUMN public.teachers.subject IS '教授科目';
COMMENT ON COLUMN public.teachers.grade IS '教授年级';
COMMENT ON COLUMN public.teachers.teach_type IS '教学类型';
COMMENT ON COLUMN public.teachers.education IS '学历';
COMMENT ON COLUMN public.teachers.university IS '毕业院校';
COMMENT ON COLUMN public.teachers.school_uid IS 'ClassIn 学校编号';
COMMENT ON COLUMN public.teachers.join_type IS '加入类型';
COMMENT ON COLUMN public.teachers.serve_state IS '服务状态';
COMMENT ON COLUMN public.teachers.tea_id IS 'ClassIn 老师ID';
COMMENT ON COLUMN public.teachers.is_del IS '是否删除（0=正常，1=已删除）';
COMMENT ON COLUMN public.teachers.sync_time IS '最后同步时间';
COMMENT ON COLUMN public.teachers.classin_extra IS 'ClassIn 额外信息 (JSON格式)';
