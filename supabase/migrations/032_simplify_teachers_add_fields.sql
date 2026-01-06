-- 简化 teachers 表，新增手动录入与入库关联字段，并放宽 classin_uid 约束
DO $$
BEGIN
  -- 放宽 classin_uid 非空约束，允许先入库后补 UID
  ALTER TABLE public.teachers
    ALTER COLUMN classin_uid DROP NOT NULL;

  -- 老师编号（手动录入）
  ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS teacher_code TEXT;

  -- ClassIn 初始密码（可选）
  ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS classin_initial_password TEXT;

  -- 面试记录关联（teacher_candidates.id）
  ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS candidate_id UUID;

  -- 外键约束（若列存在且未绑定约束则添加）
  ALTER TABLE public.teachers
    ADD CONSTRAINT IF NOT EXISTS teachers_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES public.teacher_candidates(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

  -- 索引与唯一约束
  CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_teacher_code
    ON public.teachers(teacher_code);

  CREATE INDEX IF NOT EXISTS idx_teachers_candidate_id
    ON public.teachers(candidate_id);

  -- 注释
  COMMENT ON COLUMN public.teachers.teacher_code IS '老师编号（手动录入）';
  COMMENT ON COLUMN public.teachers.classin_initial_password IS 'ClassIn 初始密码（可选）';
  COMMENT ON COLUMN public.teachers.candidate_id IS '关联的面试记录ID（teacher_candidates.id）';
END $$;

