-- 创建 teacher_classin 表
-- 完全按照 ClassIn API 返回的原始字段结构

CREATE TABLE IF NOT EXISTS public.teacher_classin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 原始字段
  st_id BIGINT,                          -- 老师ID
  uid BIGINT NOT NULL UNIQUE,            -- 唯一标识符
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
  notes TEXT,                            -- 备注

  -- ClassIn 额外字段（保存 API 返回的其他字段）
  classin_extra JSONB                    -- ClassIn 额外信息
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_classin_uid ON public.teacher_classin(uid);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_st_id ON public.teacher_classin(st_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_mobile ON public.teacher_classin(mobile);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_account_status ON public.teacher_classin(account_status);
CREATE INDEX IF NOT EXISTS idx_teacher_classin_is_del ON public.teacher_classin(is_del);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_teacher_classin_updated_at ON public.teacher_classin;
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
COMMENT ON TABLE public.teacher_classin IS 'ClassIn 老师原始数据表，完全按照 ClassIn API 字段结构';

COMMENT ON COLUMN public.teacher_classin.st_id IS 'ClassIn 老师ID (stId)';
COMMENT ON COLUMN public.teacher_classin.uid IS 'ClassIn 唯一标识符，用于去重';
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
COMMENT ON COLUMN public.teacher_classin.classin_extra IS 'ClassIn API 返回的其他额外字段';
