-- 创建 students_classin 表
-- 完全按照 ClassIn API 返回的原始字段结构

CREATE TABLE IF NOT EXISTS public.students_classin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 原始字段
  stud_id BIGINT,                         -- 学生ID
  uid BIGINT NOT NULL UNIQUE,             -- 唯一标识符
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
  notes TEXT,                             -- 备注

  -- ClassIn 额外字段（保存 API 返回的其他字段）
  classin_extra JSONB                     -- ClassIn 额外信息
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_classin_uid ON public.students_classin(uid);
CREATE INDEX IF NOT EXISTS idx_students_classin_stud_id ON public.students_classin(stud_id);
CREATE INDEX IF NOT EXISTS idx_students_classin_mobile ON public.students_classin(mobile);
CREATE INDEX IF NOT EXISTS idx_students_classin_account_status ON public.students_classin(account_status);
CREATE INDEX IF NOT EXISTS idx_students_classin_serve_state ON public.students_classin(serve_state);
CREATE INDEX IF NOT EXISTS idx_students_classin_isdel ON public.students_classin(isdel);
CREATE INDEX IF NOT EXISTS idx_students_classin_stuno ON public.students_classin(stuno);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_students_classin_updated_at ON public.students_classin;
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
COMMENT ON TABLE public.students_classin IS 'ClassIn 学生原始数据表，完全按照 ClassIn API 字段结构';

COMMENT ON COLUMN public.students_classin.stud_id IS 'ClassIn 学生ID (studId)';
COMMENT ON COLUMN public.students_classin.uid IS 'ClassIn 唯一标识符，用于去重';
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
COMMENT ON COLUMN public.students_classin.classin_extra IS 'ClassIn API 返回的其他额外字段';
