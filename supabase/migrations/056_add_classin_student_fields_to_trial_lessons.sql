-- 记录试听学生的 ClassIn 账号绑定结果

ALTER TABLE public.trial_lessons
ADD COLUMN IF NOT EXISTS classin_student_uid BIGINT,
ADD COLUMN IF NOT EXISTS classin_student_registered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS classin_student_error TEXT;

CREATE INDEX IF NOT EXISTS idx_trial_lessons_classin_student_uid
  ON public.trial_lessons(classin_student_uid);

COMMENT ON COLUMN public.trial_lessons.classin_student_uid IS '试听学生 ClassIn UID';
COMMENT ON COLUMN public.trial_lessons.classin_student_registered_at IS '试听学生 ClassIn 账号创建/绑定时间';
COMMENT ON COLUMN public.trial_lessons.classin_student_error IS '试听学生 ClassIn 账号创建失败原因';
