-- 为 user_profiles 表添加教师相关字段
-- 用于支持试听课的"确认老师"和"开课"功能

-- 1. 添加 classin_uid 字段（用于 ClassIn 集成）
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS classin_uid BIGINT;

-- 添加注释
COMMENT ON COLUMN public.user_profiles.classin_uid IS 'ClassIn 系统中的唯一标识符（uid），教师账号需要绑定才能创建课室';

-- 2. 添加 subject 字段（教师教授学科）
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS subject TEXT;

-- 添加注释
COMMENT ON COLUMN public.user_profiles.subject IS '教师教授的学科（如：数学、英语、物理等）';

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_profiles_classin_uid ON public.user_profiles(classin_uid);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subject ON public.user_profiles(subject);

-- 4. 验证字段已添加
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name IN ('classin_uid', 'subject')
ORDER BY column_name;
