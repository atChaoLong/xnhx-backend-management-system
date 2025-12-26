-- 为 students 表添加更多 ClassIn 相关字段

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS school_uid BIGINT,
ADD COLUMN IF NOT EXISTS serve_state INTEGER,
ADD COLUMN IF NOT EXISTS join_type INTEGER,
ADD COLUMN IF NOT EXISTS stud_id BIGINT,
ADD COLUMN IF NOT EXISTS classin_extra JSONB;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_students_school_uid ON public.students(school_uid);
CREATE INDEX IF NOT EXISTS idx_students_serve_state ON public.students(serve_state);

-- 添加注释
COMMENT ON COLUMN public.students.school_uid IS 'ClassIn 学校 UID';
COMMENT ON COLUMN public.students.serve_state IS 'ClassIn 服务状态 (2=在籍)';
COMMENT ON COLUMN public.students.join_type IS 'ClassIn 加入类型';
COMMENT ON COLUMN public.students.stud_id IS 'ClassIn 学生 ID';
COMMENT ON COLUMN public.students.classin_extra IS 'ClassIn 额外信息 (JSON格式)';
