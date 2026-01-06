-- 简化 students 表，新增手动录入与入库关联字段
DO $$
BEGIN
  -- 学生编号（手动录入）
  ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS student_code TEXT;

  -- ClassIn 初始密码（可选）
  ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS classin_initial_password TEXT;

  -- 索引与唯一约束
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_student_code
    ON public.students(student_code);

  -- 注释
  COMMENT ON COLUMN public.students.student_code IS '学生编号（手动录入）';
  COMMENT ON COLUMN public.students.classin_initial_password IS 'ClassIn 初始密码（可选）';
END $$;

