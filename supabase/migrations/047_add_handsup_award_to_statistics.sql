-- ============================================
-- 更新课堂统计表，添加举手和奖励统计字段
-- ============================================

-- 添加举手统计字段
ALTER TABLE public.class_session_statistics
ADD COLUMN IF NOT EXISTS handsup_details JSONB;

-- 添加奖励统计字段
ALTER TABLE public.class_session_statistics
ADD COLUMN IF NOT EXISTS award_details JSONB;

-- 添加注释
COMMENT ON COLUMN public.class_session_statistics.handsup_details IS '举手统计（JSON）- 从 handsupEnd 提取';
COMMENT ON COLUMN public.class_session_statistics.award_details IS '奖励统计（JSON）- 从 awardEnd 提取';
