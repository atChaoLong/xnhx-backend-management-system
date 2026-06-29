CREATE TABLE IF NOT EXISTS public.lead_grab_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  report_number TEXT,
  sales_user_id UUID NOT NULL,
  sales_user_name TEXT NOT NULL,
  grab_wechat TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_grab_logs_lead_id
  ON public.lead_grab_logs(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_grab_logs_sales_user_id
  ON public.lead_grab_logs(sales_user_id);

CREATE INDEX IF NOT EXISTS idx_lead_grab_logs_created_at
  ON public.lead_grab_logs(created_at DESC);

ALTER TABLE public.lead_grab_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view lead grab logs" ON public.lead_grab_logs;
CREATE POLICY "Authenticated users can view lead grab logs"
  ON public.lead_grab_logs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage lead grab logs" ON public.lead_grab_logs;
CREATE POLICY "Service role can manage lead grab logs"
  ON public.lead_grab_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.lead_grab_logs IS '销售抢单记录日志，记录每次抢单操作的时间、销售人员和线索信息';
