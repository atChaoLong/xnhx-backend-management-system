-- ============================================
-- 为 teachers 表添加面试视频链接字段
-- ============================================

-- 添加面试视频链接字段
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS interview_link TEXT;

-- 添加注释
COMMENT ON COLUMN public.teachers.interview_link IS '面试视频链接';
