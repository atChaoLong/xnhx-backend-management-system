-- 为 trial_lessons 表添加课堂分享链接字段
ALTER TABLE public.trial_lessons
ADD COLUMN IF NOT EXISTS class_link TEXT;

COMMENT ON COLUMN public.trial_lessons.class_link IS 'ClassIn 课堂/课程分享链接';

