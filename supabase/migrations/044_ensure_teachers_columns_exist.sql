-- ============================================
-- 确保 teachers 表具有所有必需字段
-- 修复可能缺失的字段
-- ============================================

DO $$
BEGIN
  -- 检查并添加 location 字段（如果不存在）
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'teachers'
      AND column_name = 'location'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.teachers ADD COLUMN location TEXT;
    RAISE NOTICE '已添加 location 字段';
  ELSE
    RAISE NOTICE 'location 字段已存在';
  END IF;

  -- 检查并添加 gender 字段
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'teachers'
      AND column_name = 'gender'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.teachers ADD COLUMN gender TEXT;
    RAISE NOTICE '已添加 gender 字段';
  END IF;

  -- 检查并添加 notes 字段
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'teachers'
      AND column_name = 'notes'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.teachers ADD COLUMN notes TEXT;
    RAISE NOTICE '已添加 notes 字段';
  END IF;

  -- 检查并添加 status 字段
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'teachers'
      AND column_name = 'status'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.teachers ADD COLUMN status TEXT DEFAULT 'active';
    RAISE NOTICE '已添加 status 字段';
  END IF;

  -- 检查并添加 is_del 字段
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'teachers'
      AND column_name = 'is_del'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.teachers ADD COLUMN is_del INTEGER DEFAULT 0;
    RAISE NOTICE '已添加 is_del 字段';
  END IF;

END $$;

-- 添加字段注释
COMMENT ON COLUMN public.teachers.location IS '老师所在地';
COMMENT ON COLUMN public.teachers.gender IS '性别';
COMMENT ON COLUMN public.teachers.notes IS '备注';
COMMENT ON COLUMN public.teachers.status IS '状态';
COMMENT ON COLUMN public.teachers.is_del IS '是否删除（0=正常，1=已删除）';
