-- 修正 trial_duration 字段注释
-- 该字段存储的是分钟数，而不是小时数

COMMENT ON COLUMN public.trial_lessons.trial_duration IS '试听时长（分钟）';
