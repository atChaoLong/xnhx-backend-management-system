-- 修复 chat_screenshots 字段类型
-- 确保它是 TEXT 类型而不是 TEXT[]

DO $$
BEGIN
  -- 检查列是否存在并修改类型
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name = 'chat_screenshots'
    AND data_type = 'ARRAY'
  ) THEN
    -- 如果是数组类型，改为 TEXT
    ALTER TABLE public.leads
    ALTER COLUMN chat_screenshots TYPE TEXT USING chat_screenshots::TEXT;
  END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN public.leads.chat_screenshots IS '聊天截图 URL';
