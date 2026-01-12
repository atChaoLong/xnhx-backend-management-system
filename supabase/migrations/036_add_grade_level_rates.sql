-- 为 teacher_candidates 表添加年级段-时薪映射字段
-- 支持不同年级段（小学、初中、高中）有不同的时薪标准

-- 添加 JSONB 字段存储年级段-时薪映射
DO $$
BEGIN
  -- 添加新字段
  ALTER TABLE public.teacher_candidates
    ADD COLUMN IF NOT EXISTS grade_level_rates JSONB DEFAULT '{}'::jsonb;

  -- 添加注释
  COMMENT ON COLUMN public.teacher_candidates.grade_level_rates IS '年级段-时薪映射，格式: {"小学": 80, "初中": 100, "高中": 120}';

  -- 保留原有 approved_hourly_rate 字段作为默认/参考时薪
  COMMENT ON COLUMN public.teacher_candidates.approved_hourly_rate IS '默认时薪（已废弃，请使用 grade_level_rates）';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding grade_level_rates column: %', SQLERRM;
END $$;

-- 创建索引以支持 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_grade_level_rates
  ON public.teacher_candidates USING GIN (grade_level_rates);
