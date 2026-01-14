-- 添加 education 和 university 字段到 teachers 表
DO $$
BEGIN
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS education TEXT;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS university TEXT;
END $$;

-- 添加字段注释
COMMENT ON COLUMN public.teachers.education IS '学历';
COMMENT ON COLUMN public.teachers.university IS '毕业院校';
