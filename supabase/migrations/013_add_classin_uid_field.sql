-- 为 teacher_profiles 和 students 表添加 classin_uid 字段
-- 用于存储 ClassIn 系统中的唯一标识符

-- 1. 为 teacher_profiles 表添加 classin_uid 字段
ALTER TABLE public.teacher_profiles
ADD COLUMN IF NOT EXISTS classin_uid BIGINT;

-- 添加唯一索引，确保 uid 不重复
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_profiles_classin_uid ON public.teacher_profiles(classin_uid);

-- 添加注释
COMMENT ON COLUMN public.teacher_profiles.classin_uid IS 'ClassIn 系统中的老师唯一标识符（uid）';

-- 2. 为 students 表添加 classin_uid 字段
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS classin_uid BIGINT;

-- 添加唯一索引，确保 uid 不重复
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_classin_uid ON public.students(classin_uid);

-- 添加注释
COMMENT ON COLUMN public.students.classin_uid IS 'ClassIn 系统中的学生唯一标识符（uid）';
