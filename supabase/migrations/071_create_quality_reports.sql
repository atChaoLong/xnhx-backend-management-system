CREATE TABLE IF NOT EXISTS public.quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('trial_conversion', 'service_quality')),
  target_type TEXT NOT NULL CHECK (target_type IN ('trial_lesson', 'student')),
  target_id UUID NOT NULL,
  target_label TEXT,
  quality_score INT NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  score_level TEXT NOT NULL CHECK (score_level IN ('excellent', 'good', 'warning', 'risk')),
  issues TEXT[] NOT NULL DEFAULT '{}',
  improvement_suggestions TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_reports_open_target
  ON public.quality_reports(report_type, target_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_quality_reports_report_type
  ON public.quality_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_quality_reports_target
  ON public.quality_reports(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_quality_reports_status
  ON public.quality_reports(status);

CREATE INDEX IF NOT EXISTS idx_quality_reports_generated_at
  ON public.quality_reports(generated_at DESC);

DROP TRIGGER IF EXISTS update_quality_reports_updated_at ON public.quality_reports;
CREATE TRIGGER update_quality_reports_updated_at
  BEFORE UPDATE ON public.quality_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.quality_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quality reports" ON public.quality_reports;
CREATE POLICY "Authenticated users can view quality reports"
  ON public.quality_reports
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can create quality reports" ON public.quality_reports;
CREATE POLICY "Authenticated users can create quality reports"
  ON public.quality_reports
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can update quality reports" ON public.quality_reports;
CREATE POLICY "Authenticated users can update quality reports"
  ON public.quality_reports
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL AND updated_by = auth.uid());

DROP POLICY IF EXISTS "Service role can manage quality reports" ON public.quality_reports;
CREATE POLICY "Service role can manage quality reports"
  ON public.quality_reports
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.quality_reports IS '质检报告表，保存试听转化与课后服务质检结果';
COMMENT ON COLUMN public.quality_reports.report_type IS '报告类型：trial_conversion/service_quality';
COMMENT ON COLUMN public.quality_reports.target_type IS '质检对象类型：trial_lesson/student';
COMMENT ON COLUMN public.quality_reports.quality_score IS '质检分数，0-100';
COMMENT ON COLUMN public.quality_reports.score_level IS '评分等级：excellent/good/warning/risk';
COMMENT ON COLUMN public.quality_reports.issues IS '质检发现问题列表';
COMMENT ON COLUMN public.quality_reports.improvement_suggestions IS '改进建议';
