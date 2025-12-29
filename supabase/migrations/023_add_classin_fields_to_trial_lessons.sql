-- 添加 ClassIn 相关字段到 trial_lessons 表

ALTER TABLE public.trial_lessons
ADD COLUMN IF NOT EXISTS classin_course_id BIGINT,
ADD COLUMN IF NOT EXISTS classin_class_id BIGINT;

-- 添加注释
COMMENT ON COLUMN public.trial_lessons.classin_course_id IS 'ClassIn 课程ID';
COMMENT ON COLUMN public.trial_lessons.classin_class_id IS 'ClassIn 课节ID';
