-- 线索编号自动生成：渠道前缀 + 9 位递增序号

CREATE SEQUENCE IF NOT EXISTS public.leads_report_number_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
  max_existing BIGINT;
BEGIN
  SELECT COALESCE(MAX((REGEXP_MATCH(report_number, '([0-9]+)$'))[1]::BIGINT), 0)
  INTO max_existing
  FROM public.leads
  WHERE report_number ~ '[0-9]+$';

  PERFORM SETVAL(
    'public.leads_report_number_seq',
    GREATEST(max_existing, 1),
    max_existing > 0
  );
END $$;

CREATE OR REPLACE FUNCTION public.generate_lead_report_number(channel_code TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
BEGIN
  prefix := UPPER(REGEXP_REPLACE(COALESCE(NULLIF(channel_code, ''), 'LEAD'), '[^A-Za-z0-9]+', '_', 'g'));
  prefix := TRIM(BOTH '_' FROM prefix);

  IF prefix = '' THEN
    prefix := 'LEAD';
  END IF;

  RETURN prefix || '_' || LPAD(NEXTVAL('public.leads_report_number_seq')::TEXT, 9, '0');
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE report_number IS NOT NULL
    GROUP BY report_number
    HAVING COUNT(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_report_number_unique ON public.leads(report_number)';
  ELSE
    RAISE NOTICE 'Skipped unique index idx_leads_report_number_unique because duplicate report_number values already exist.';
  END IF;
END $$;

COMMENT ON FUNCTION public.generate_lead_report_number(TEXT) IS '生成线索编号：渠道前缀 + 9 位递增序号';
