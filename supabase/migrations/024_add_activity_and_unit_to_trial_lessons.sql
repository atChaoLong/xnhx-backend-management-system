-- 添加 ClassIn 单元ID和活动ID到 trial_lessons 表

ALTER TABLE public.trial_lessons
ADD COLUMN IF NOT EXISTS classin_unit_id BIGINT,
ADD COLUMN IF NOT EXISTS classin_activity_id BIGINT;

-- 添加注释
COMMENT ON COLUMN public.trial_lessons.classin_unit_id IS 'ClassIn 单元ID';
COMMENT ON COLUMN public.trial_lessons.classin_activity_id IS 'ClassIn 课堂活动ID';
