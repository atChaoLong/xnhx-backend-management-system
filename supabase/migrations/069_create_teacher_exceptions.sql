CREATE TABLE IF NOT EXISTS public.teacher_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  issue_code TEXT NOT NULL,
  issue_label TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'ignored')),
  reason TEXT,
  current_suggestion TEXT,
  issue_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, issue_code)
);

CREATE INDEX IF NOT EXISTS idx_teacher_exceptions_teacher_id
  ON public.teacher_exceptions(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_exceptions_status
  ON public.teacher_exceptions(status);

CREATE INDEX IF NOT EXISTS idx_teacher_exceptions_severity
  ON public.teacher_exceptions(severity);

CREATE INDEX IF NOT EXISTS idx_teacher_exceptions_updated_at
  ON public.teacher_exceptions(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.teacher_exception_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id UUID NOT NULL REFERENCES public.teacher_exceptions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'note_added')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('open', 'in_progress', 'resolved', 'ignored')),
  to_status TEXT CHECK (to_status IS NULL OR to_status IN ('open', 'in_progress', 'resolved', 'ignored')),
  note TEXT,
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_exception_events_exception_id
  ON public.teacher_exception_events(exception_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_exception_events_teacher_id
  ON public.teacher_exception_events(teacher_id, created_at DESC);

ALTER TABLE public.teacher_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_exception_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view teacher exceptions" ON public.teacher_exceptions;
CREATE POLICY "Authenticated users can view teacher exceptions"
  ON public.teacher_exceptions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage teacher exceptions" ON public.teacher_exceptions;
CREATE POLICY "Service role can manage teacher exceptions"
  ON public.teacher_exceptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view teacher exception events" ON public.teacher_exception_events;
CREATE POLICY "Authenticated users can view teacher exception events"
  ON public.teacher_exception_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage teacher exception events" ON public.teacher_exception_events;
CREATE POLICY "Service role can manage teacher exception events"
  ON public.teacher_exception_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.teacher_exceptions IS '老师新入库异常处理主表，按老师和异常项保存当前处理状态';
COMMENT ON COLUMN public.teacher_exceptions.issue_code IS '自动识别出的异常代码，例如 missing_classin_uid';
COMMENT ON COLUMN public.teacher_exceptions.status IS '异常处理状态：open/in_progress/resolved/ignored';
COMMENT ON COLUMN public.teacher_exceptions.reason IS '异常原因或处理说明';
COMMENT ON COLUMN public.teacher_exceptions.issue_snapshot IS '保存异常项的识别快照，便于后续追溯规则变化';
COMMENT ON TABLE public.teacher_exception_events IS '老师异常处理事件流水，记录每次创建、备注和状态变化';
