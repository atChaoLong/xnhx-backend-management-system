-- Formal release hardening: block direct anon-key/PUBLIC access to business tables.
-- Server API access is handled by the service-role server client plus route-level RBAC.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  operator_id UUID,
  target_user_id UUID,
  operation TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_operator_id
  ON public.admin_operation_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_target_user_id
  ON public.admin_operation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_created_at
  ON public.admin_operation_logs(created_at DESC);

ALTER TABLE public.admin_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_lessons ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.admin_operation_logs FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.formal_orders FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.trial_lessons FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.admin_operation_logs FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.formal_orders FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.trial_lessons FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_operation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.formal_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trial_lessons TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view formal orders" ON public.formal_orders;
DROP POLICY IF EXISTS "Authenticated users can create formal orders" ON public.formal_orders;
DROP POLICY IF EXISTS "Authenticated users can update formal orders" ON public.formal_orders;
DROP POLICY IF EXISTS "Authenticated users can delete formal orders" ON public.formal_orders;

CREATE POLICY "Authenticated users can view formal orders"
  ON public.formal_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create formal orders"
  ON public.formal_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update formal orders"
  ON public.formal_orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete formal orders"
  ON public.formal_orders
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view trial lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Authenticated users can create trial lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Authenticated users can update trial lessons" ON public.trial_lessons;
DROP POLICY IF EXISTS "Authenticated users can delete trial lessons" ON public.trial_lessons;

CREATE POLICY "Authenticated users can view trial lessons"
  ON public.trial_lessons
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create trial lessons"
  ON public.trial_lessons
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update trial lessons"
  ON public.trial_lessons
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trial lessons"
  ON public.trial_lessons
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can view admin operation logs" ON public.admin_operation_logs;
DROP POLICY IF EXISTS "Admins can create admin operation logs" ON public.admin_operation_logs;

CREATE POLICY "Admins can view admin operation logs"
  ON public.admin_operation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create admin operation logs"
  ON public.admin_operation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DO $$
DECLARE
  table_name TEXT;
  business_tables TEXT[] := ARRAY[
    'admin_operation_logs',
    'class_classin',
    'class_session_statistics',
    'class_sessions',
    'class_student_participation',
    'classin_callback_events',
    'classroom_classin',
    'courses',
    'daily_leads',
    'formal_orders',
    'leads',
    'quality_reports',
    'student_status_history',
    'students',
    'students_classin',
    'sys_dictionaries',
    'teacher_candidates',
    'teacher_characteristics',
    'teacher_classin',
    'teacher_details',
    'teacher_exception_events',
    'teacher_exceptions',
    'teacher_profiles',
    'teachers',
    'todos',
    'transaction_records',
    'transaction_workflow_events',
    'trial_lessons',
    'user_profiles',
    'visit_records',
    'wechat_accounts'
  ];
BEGIN
  FOREACH table_name IN ARRAY business_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.admin_operation_logs IS '管理员操作日志表';

COMMIT;
