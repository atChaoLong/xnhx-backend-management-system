-- Link trial lessons created from formal student management back to the student.
ALTER TABLE public.trial_lessons
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trial_lessons_student_id
  ON public.trial_lessons(student_id);

COMMENT ON COLUMN public.trial_lessons.student_id IS '关联正式生ID，用于正式生详情中新试听和权限过滤';
