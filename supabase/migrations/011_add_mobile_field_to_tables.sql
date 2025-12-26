-- 为 teacher_profiles 和 students 表添加 mobile 字段

-- 1. 为 teacher_profiles 表添加 mobile 字段
-- 注：该表已有 classin_phone 字段用于 ClassIn 注册手机号
-- mobile 字段用于老师的常用联系电话
ALTER TABLE public.teacher_profiles
ADD COLUMN IF NOT EXISTS mobile TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_mobile ON public.teacher_profiles(mobile);

-- 2. 为 students 表添加 mobile 字段
-- 注：该表已有 parent_phone 字段用于家长电话
-- mobile 字段用于学生本人的联系电话
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS mobile TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_students_mobile ON public.students(mobile);

-- 注释
COMMENT ON COLUMN public.teacher_profiles.mobile IS '老师常用联系电话';
COMMENT ON COLUMN public.students.mobile IS '学生本人联系电话';
