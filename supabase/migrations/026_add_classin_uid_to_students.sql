-- 添加 ClassIn UID 字段到 students 表

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS classin_uid BIGINT;

-- 添加注释
COMMENT ON COLUMN public.students.classin_uid IS 'ClassIn 学生唯一标识符 (UID)，用于关联 ClassIn 系统';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_students_classin_uid ON public.students(classin_uid);
