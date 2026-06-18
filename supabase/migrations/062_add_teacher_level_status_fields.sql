-- Add teacher inventory level/status fields used by the 0601 teacher-pool workflow.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS teacher_level TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE public.teachers
SET status = 'active'
WHERE status IS NULL OR btrim(status) = '';

CREATE INDEX IF NOT EXISTS idx_teachers_teacher_level
  ON public.teachers(teacher_level);

CREATE INDEX IF NOT EXISTS idx_teachers_status
  ON public.teachers(status);

COMMENT ON COLUMN public.teachers.teacher_level IS '老师等级：junior/intermediate/senior/expert 或业务自定义值';
COMMENT ON COLUMN public.teachers.status IS '老师库存状态：active=正常，full=满课，paused=暂停排课，disabled=停用';

INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
  ('teacher_status', 'active', '正常', 1, true),
  ('teacher_status', 'full', '满课', 2, true),
  ('teacher_status', 'paused', '暂停排课', 3, true),
  ('teacher_status', 'disabled', '停用', 4, true),
  ('teacher_level', 'ungraded', '未定级', 0, true)
ON CONFLICT (category, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
