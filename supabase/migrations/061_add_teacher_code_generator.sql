-- 老师库存编号自动生成：TH + 5 位递增序号

CREATE SEQUENCE IF NOT EXISTS public.teacher_code_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
  max_existing BIGINT;
BEGIN
  SELECT COALESCE(MAX((REGEXP_MATCH(teacher_code, '^TH([0-9]+)$'))[1]::BIGINT), 0)
  INTO max_existing
  FROM public.teachers
  WHERE teacher_code ~ '^TH[0-9]+$';

  PERFORM SETVAL(
    'public.teacher_code_seq',
    GREATEST(max_existing, 1),
    max_existing > 0
  );
END $$;

CREATE OR REPLACE FUNCTION public.generate_teacher_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'TH' || LPAD(NEXTVAL('public.teacher_code_seq')::TEXT, 5, '0');
END;
$$;

UPDATE public.teachers
SET teacher_code = public.generate_teacher_code()
WHERE teacher_code IS NULL;

COMMENT ON FUNCTION public.generate_teacher_code() IS '生成老师库存编号：TH + 5 位递增序号';
COMMENT ON COLUMN public.teachers.teacher_code IS '老师编号（TH + 5 位递增自动生成）';
