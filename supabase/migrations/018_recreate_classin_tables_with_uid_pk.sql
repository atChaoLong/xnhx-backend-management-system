-- 重建 teacher_classin 和 students_classin 表
-- 使用 ClassIn uid 作为主键，移除 classin_extra 字段

-- 删除旧表
DROP TABLE IF EXISTS public.teacher_classin CASCADE;
DROP TABLE IF EXISTS public.students_classin CASCADE;

-- 重建 teacher_classin 表
CREATE TABLE public.teacher_classin (
  uid BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 原始字段
  st_id BIGINT,                          -- 老师ID
  name TEXT NOT NULL,                    -- 老师姓名
  logo TEXT,                             -- 头像URL
  emp_no TEXT,                           -- 工号
  position TEXT,                         -- 职位
  is_del INTEGER DEFAULT 0,              -- 是否删除 (0=正常, 1=已删除)
  join_type INTEGER,                     -- 加入类型 (1=正常加入)
  departments_info JSONB,                -- 部门信息
  mobile TEXT,                           -- 手机号
  email TEXT,                            -- 邮箱
  account_status INTEGER,                -- 账号状态

  -- 同步相关字段
  sync_time TIMESTAMPTZ,                 -- 最后同步时间
  notes TEXT                             -- 备注
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_classin_st_id ON public.teacher_classin(st_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_mobile ON public.teacher_classin(mobile);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_account_status ON public.teacher_classin(account_status);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_is_del ON public.teacher_classin(is_del);

-- 更新时间触发器
CREATE TRIGGER update_teacher_classin_updated_at
  BEFORE UPDATE ON public.teacher_classin
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.teacher_classin ENABLE ROW LEVEL SECURITY;

-- 策略：允许所有认证用户操作
CREATE POLICY "Authenticated users can view teacher_classin"
  ON public.teacher_classin FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teacher_classin"
  ON public.teacher_classin FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teacher_classin"
  ON public.teacher_classin FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete teacher_classin"
  ON public.teacher_classin FOR DELETE
  TO authenticated
  USING (true);

-- 添加注释
COMMENT ON TABLE public.teacher_classin IS 'ClassIn 老师原始数据表，使用 ClassIn uid 作为主键';
COMMENT ON COLUMN public.teacher_classin.uid IS 'ClassIn 唯一标识符（主键）';
COMMENT ON COLUMN public.teacher_classin.st_id IS 'ClassIn 老师ID (stId)';
COMMENT ON COLUMN public.teacher_classin.name IS '老师姓名';
COMMENT ON COLUMN public.teacher_classin.logo IS '头像URL';
COMMENT ON COLUMN public.teacher_classin.emp_no IS '工号';
COMMENT ON COLUMN public.teacher_classin.position IS '职位';
COMMENT ON COLUMN public.teacher_classin.is_del IS '是否删除 (0=正常, 1=已删除)';
COMMENT ON COLUMN public.teacher_classin.join_type IS '加入类型 (1=正常加入)';
COMMENT ON COLUMN public.teacher_classin.departments_info IS '部门信息 (JSON数组)';
COMMENT ON COLUMN public.teacher_classin.mobile IS '手机号';
COMMENT ON COLUMN public.teacher_classin.email IS '邮箱';
COMMENT ON COLUMN public.teacher_classin.account_status IS '账号状态';
COMMENT ON COLUMN public.teacher_classin.sync_time IS '最后同步时间';

-- 重建 students_classin 表
CREATE TABLE public.students_classin (
  uid BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 原始字段
  stud_id BIGINT,                         -- 学生ID
  name TEXT NOT NULL,                     -- 学生姓名
  join_type INTEGER,                      -- 加入类型
  mobile TEXT,                            -- 手机号
  email TEXT,                             -- 邮箱
  account_status INTEGER,                 -- 账号状态
  cat_info JSONB,                         -- 分类信息
  lable_info JSONB,                       -- 标签信息
  stuno TEXT,                             -- 学号
  isdel INTEGER DEFAULT 0,                -- 是否删除 (0=正常, 1=已删除)
  addtime BIGINT,                         -- 添加时间 (Unix时间戳)
  serve_state INTEGER,                    -- 服务状态

  -- 同步相关字段
  sync_time TIMESTAMPTZ,                  -- 最后同步时间
  notes TEXT                              -- 备注
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_students_classin_stud_id ON public.students_classin(stud_id);
CREATE INDEX IF NOT EXISTS idx_students_classin_mobile ON public.students_classin(mobile);
CREATE INDEX IF NOT EXISTS idx_students_classin_account_status ON public.students_classin(account_status);
CREATE INDEX IF NOT EXISTS idx_students_classin_serve_state ON public.students_classin(serve_state);
CREATE INDEX IF NOT EXISTS idx_students_classin_isdel ON public.students_classin(isdel);
CREATE INDEX IF NOT EXISTS idx_students_classin_stuno ON public.students_classin(stuno);

-- 更新时间触发器
CREATE TRIGGER update_students_classin_updated_at
  BEFORE UPDATE ON public.students_classin
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.students_classin ENABLE ROW LEVEL SECURITY;

-- 策略：允许所有认证用户操作
CREATE POLICY "Authenticated users can view students_classin"
  ON public.students_classin FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert students_classin"
  ON public.students_classin FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update students_classin"
  ON public.students_classin FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete students_classin"
  ON public.students_classin FOR DELETE
  TO authenticated
  USING (true);

-- 添加注释
COMMENT ON TABLE public.students_classin IS 'ClassIn 学生原始数据表，使用 ClassIn uid 作为主键';
COMMENT ON COLUMN public.students_classin.uid IS 'ClassIn 唯一标识符（主键）';
COMMENT ON COLUMN public.students_classin.stud_id IS 'ClassIn 学生ID (studId)';
COMMENT ON COLUMN public.students_classin.name IS '学生姓名';
COMMENT ON COLUMN public.students_classin.join_type IS '加入类型';
COMMENT ON COLUMN public.students_classin.mobile IS '手机号';
COMMENT ON COLUMN public.students_classin.email IS '邮箱';
COMMENT ON COLUMN public.students_classin.account_status IS '账号状态';
COMMENT ON COLUMN public.students_classin.cat_info IS '分类信息 (JSON数组)';
COMMENT ON COLUMN public.students_classin.lable_info IS '标签信息 (JSON数组)';
COMMENT ON COLUMN public.students_classin.stuno IS '学号';
COMMENT ON COLUMN public.students_classin.isdel IS '是否删除 (0=正常, 1=已删除)';
COMMENT ON COLUMN public.students_classin.addtime IS '添加时间 (Unix时间戳)';
COMMENT ON COLUMN public.students_classin.serve_state IS '服务状态';
COMMENT ON COLUMN public.students_classin.sync_time IS '最后同步时间';
