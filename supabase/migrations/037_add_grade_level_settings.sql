-- 为 teacher_candidates 表添加年级配置数组字段
-- 支持手动添加年级、带课量、时薪配置

-- 添加 JSONB 字段存储年级配置数组
DO $$
BEGIN
  -- 添加新字段
  ALTER TABLE public.teacher_candidates
    ADD COLUMN IF NOT EXISTS grade_level_settings JSONB DEFAULT '[]'::jsonb;

  -- 添加注释
  COMMENT ON COLUMN public.teacher_candidates.grade_level_settings IS '年级配置数组，格式: [{"grade": "小学一年级", "workload": 10, "hourlyRate": 80}]';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding grade_level_settings column: %', SQLERRM;
END $$;

-- 创建索引以支持 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_grade_level_settings
  ON public.teacher_candidates USING GIN (grade_level_settings);
