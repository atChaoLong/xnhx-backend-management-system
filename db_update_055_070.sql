
-- ============================================================
-- supabase/migrations/055_add_trial_lesson_id_to_formal_orders.sql
-- ============================================================

-- 为正式订单补充来源试听关联，支持试听转正式和防重复转化
ALTER TABLE public.formal_orders
ADD COLUMN IF NOT EXISTS trial_lesson_id UUID REFERENCES public.trial_lessons(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_formal_orders_trial_lesson_id_unique
ON public.formal_orders(trial_lesson_id)
WHERE trial_lesson_id IS NOT NULL;

COMMENT ON COLUMN public.formal_orders.trial_lesson_id IS '来源试听课程ID（试听转正式时填写）';


-- ============================================================
-- supabase/migrations/056_add_classin_student_fields_to_trial_lessons.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/057_add_lead_report_number_generator.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/058_add_lead_channel_social_fields.sql
-- ============================================================

-- 线索新增渠道平台与客户社媒账号 ID，用于同渠道重复提示

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS channel_platform TEXT,
  ADD COLUMN IF NOT EXISTS customer_social_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_channel_social
  ON public.leads(channel_platform, customer_social_id)
  WHERE channel_platform IS NOT NULL
    AND customer_social_id IS NOT NULL;

COMMENT ON COLUMN public.leads.channel_platform IS '渠道平台，用于与客户社媒账号 ID 组合判断重复线索';
COMMENT ON COLUMN public.leads.customer_social_id IS '客户社媒账号 ID，用于同渠道重复线索提示';


-- ============================================================
-- supabase/migrations/059_add_transaction_record_relations.sql
-- ============================================================

-- 为退费/异动记录补充正式生与订单关联，支持正式生详情页聚合和退费金额校验。

ALTER TABLE public.transaction_records
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.formal_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_records_student_id
  ON public.transaction_records(student_id);

CREATE INDEX IF NOT EXISTS idx_transaction_records_order_id
  ON public.transaction_records(order_id);

COMMENT ON COLUMN public.transaction_records.student_id IS '关联学生ID，用于正式生详情与权限过滤';
COMMENT ON COLUMN public.transaction_records.order_id IS '关联正式订单ID，用于退费上限校验';



-- ============================================================
-- supabase/migrations/060_add_student_id_to_trial_lessons.sql
-- ============================================================

-- Link trial lessons created from formal student management back to the student.
ALTER TABLE public.trial_lessons
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trial_lessons_student_id
  ON public.trial_lessons(student_id);

COMMENT ON COLUMN public.trial_lessons.student_id IS '关联正式生ID，用于正式生详情中新试听和权限过滤';


-- ============================================================
-- supabase/migrations/061_add_teacher_code_generator.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/062_add_teacher_level_status_fields.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/063_add_teacher_form_candidate_once_index.sql
-- ============================================================

-- Keep one public teacher information submission per candidate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_details_candidate_once
  ON public.teacher_details(candidate_id)
  WHERE candidate_id IS NOT NULL;

COMMENT ON INDEX public.idx_teacher_details_candidate_once IS '同一个老师候选人只能提交一次公开信息采集表';


-- ============================================================
-- supabase/migrations/064_add_teacher_candidate_recruitment_notes.sql
-- ============================================================

-- 补齐老师候选人招聘流程组件使用的备注与评级字段
ALTER TABLE public.teacher_candidates
ADD COLUMN IF NOT EXISTS interview_notes TEXT,
ADD COLUMN IF NOT EXISTS interview_rating TEXT,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

COMMENT ON COLUMN public.teacher_candidates.interview_notes IS '约面/面试视频阶段备注';
COMMENT ON COLUMN public.teacher_candidates.interview_rating IS '教学复核面试评级';
COMMENT ON COLUMN public.teacher_candidates.review_notes IS '教学复核备注或拒绝原因';


-- ============================================================
-- supabase/migrations/065_add_teacher_candidate_salary_entry_fields.sql
-- ============================================================

-- Add salary entry fields used by the teacher recruitment finalization flow.
ALTER TABLE public.teacher_candidates
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS notes_external TEXT;

COMMENT ON COLUMN public.teacher_candidates.bank_account IS '老师入库银行卡号';
COMMENT ON COLUMN public.teacher_candidates.bank_account_name IS '老师入库银行卡持卡人姓名';
COMMENT ON COLUMN public.teacher_candidates.bank_name IS '老师入库开户银行';
COMMENT ON COLUMN public.teacher_candidates.bank_branch IS '老师入库开户支行';
COMMENT ON COLUMN public.teacher_candidates.notes_external IS '老师可见外显备注';


-- ============================================================
-- supabase/migrations/066_add_transaction_workflow_audit_fields.sql
-- ============================================================

-- Add workflow audit fields for transaction/refund review steps.
ALTER TABLE public.transaction_records
  ADD COLUMN IF NOT EXISTS academic_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS academic_verified_by UUID,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID,
  ADD COLUMN IF NOT EXISTS performance_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS performance_verified_by UUID;

COMMENT ON COLUMN public.transaction_records.academic_verified_at IS '教务核对金额时间';
COMMENT ON COLUMN public.transaction_records.academic_verified_by IS '教务核对金额操作人';
COMMENT ON COLUMN public.transaction_records.paid_at IS '财务打款时间';
COMMENT ON COLUMN public.transaction_records.paid_by IS '财务打款操作人';
COMMENT ON COLUMN public.transaction_records.performance_verified_at IS '人力业绩核对时间';
COMMENT ON COLUMN public.transaction_records.performance_verified_by IS '人力业绩核对操作人';


-- ============================================================
-- supabase/migrations/067_create_transaction_workflow_events.sql
-- ============================================================

-- Create an append-only workflow event table for refund/transaction audit trails.
CREATE TABLE IF NOT EXISTS public.transaction_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transaction_records(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL CHECK (
    action IN (
      'submitted',
      'verify_amount',
      'mark_paid',
      'verify_performance',
      'reject',
      'status_change'
    )
  ),
  from_status TEXT,
  to_status TEXT,
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_transaction_workflow_events_transaction_id
  ON public.transaction_workflow_events(transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_workflow_events_action
  ON public.transaction_workflow_events(action);

CREATE INDEX IF NOT EXISTS idx_transaction_workflow_events_actor_id
  ON public.transaction_workflow_events(actor_id);

ALTER TABLE public.transaction_workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transaction workflow events"
  ON public.transaction_workflow_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transaction workflow events"
  ON public.transaction_workflow_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.transaction_workflow_events IS '退费/异动流程操作流水';
COMMENT ON COLUMN public.transaction_workflow_events.transaction_id IS '关联退费/异动记录ID';
COMMENT ON COLUMN public.transaction_workflow_events.action IS '流程动作';
COMMENT ON COLUMN public.transaction_workflow_events.from_status IS '操作前状态';
COMMENT ON COLUMN public.transaction_workflow_events.to_status IS '操作后状态';
COMMENT ON COLUMN public.transaction_workflow_events.actor_id IS '操作人ID';
COMMENT ON COLUMN public.transaction_workflow_events.actor_name IS '操作人姓名';
COMMENT ON COLUMN public.transaction_workflow_events.actor_role IS '操作人角色';
COMMENT ON COLUMN public.transaction_workflow_events.note IS '操作备注';


-- ============================================================
-- supabase/migrations/068_create_classin_callback_events.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.classin_callback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  cmd TEXT NOT NULL,
  sid BIGINT,
  classin_uid BIGINT,
  course_id BIGINT,
  classroom_id BIGINT,
  activity_id BIGINT,
  session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  event_time TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_event_type
  ON public.classin_callback_events(event_type);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_cmd
  ON public.classin_callback_events(cmd);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_session_id
  ON public.classin_callback_events(session_id);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_course_id
  ON public.classin_callback_events(course_id);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_classroom_id
  ON public.classin_callback_events(classroom_id);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_classin_uid
  ON public.classin_callback_events(classin_uid);

CREATE INDEX IF NOT EXISTS idx_classin_callback_events_created_at
  ON public.classin_callback_events(created_at DESC);

ALTER TABLE public.classin_callback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ClassIn callback events" ON public.classin_callback_events;
CREATE POLICY "Authenticated users can view ClassIn callback events"
  ON public.classin_callback_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage ClassIn callback events" ON public.classin_callback_events;
CREATE POLICY "Service role can manage ClassIn callback events"
  ON public.classin_callback_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.classin_callback_events IS 'ClassIn 回调事件流水，保存实时互动、进出教室、录课、回放等非课堂结束类消息';
COMMENT ON COLUMN public.classin_callback_events.event_type IS '内部归类后的事件类型';
COMMENT ON COLUMN public.classin_callback_events.cmd IS 'ClassIn 原始 Cmd';
COMMENT ON COLUMN public.classin_callback_events.sid IS 'ClassIn 学校或学生 SID';
COMMENT ON COLUMN public.classin_callback_events.classin_uid IS 'ClassIn 用户 UID';
COMMENT ON COLUMN public.classin_callback_events.course_id IS 'ClassIn 课程 ID';
COMMENT ON COLUMN public.classin_callback_events.classroom_id IS 'ClassIn 课堂 ID';
COMMENT ON COLUMN public.classin_callback_events.activity_id IS 'ClassIn 活动 ID';
COMMENT ON COLUMN public.classin_callback_events.session_id IS '匹配到的本地课节 ID';
COMMENT ON COLUMN public.classin_callback_events.event_time IS '回调业务时间，优先使用 TimeStamp';
COMMENT ON COLUMN public.classin_callback_events.payload IS '去除 SafeKey 后的回调摘要和 Msg 解析结果';


-- ============================================================
-- supabase/migrations/069_create_teacher_exceptions.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/070_backfill_trial_lesson_student_id.sql
-- ============================================================

-- Backfill historical trial_lessons.student_id links.
-- Prefer authoritative formal order links, then low-risk unique student contact matches.

WITH order_trial_student AS (
  SELECT
    trial_lesson_id,
    MIN(student_id::text)::uuid AS student_id
  FROM public.formal_orders
  WHERE trial_lesson_id IS NOT NULL
    AND student_id IS NOT NULL
  GROUP BY trial_lesson_id
  HAVING COUNT(DISTINCT student_id) = 1
)
UPDATE public.trial_lessons AS tl
SET student_id = ots.student_id
FROM order_trial_student AS ots
WHERE tl.id = ots.trial_lesson_id
  AND tl.student_id IS NULL;

WITH normalized_students AS (
  SELECT
    id,
    lower(trim(student_name)) AS student_name_key,
    nullif(regexp_replace(trim(parent_phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.students
  WHERE parent_phone IS NOT NULL
    AND trim(parent_phone) <> ''
),
unique_contact_name_students AS (
  SELECT
    contact_key,
    student_name_key,
    MIN(id::text)::uuid AS student_id
  FROM normalized_students
  WHERE contact_key IS NOT NULL
    AND student_name_key IS NOT NULL
    AND student_name_key <> ''
  GROUP BY contact_key, student_name_key
  HAVING COUNT(DISTINCT id) = 1
),
normalized_trials AS (
  SELECT
    id,
    lower(trim(child_name)) AS child_name_key,
    nullif(regexp_replace(trim(phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.trial_lessons
  WHERE student_id IS NULL
    AND phone IS NOT NULL
    AND trim(phone) <> ''
)
UPDATE public.trial_lessons AS tl
SET student_id = ucns.student_id
FROM normalized_trials AS nt
JOIN unique_contact_name_students AS ucns
  ON ucns.contact_key = nt.contact_key
 AND ucns.student_name_key = nt.child_name_key
WHERE tl.id = nt.id
  AND tl.student_id IS NULL;
WITH normalized_students AS (
  SELECT
    id,
    nullif(regexp_replace(trim(parent_phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.students
  WHERE parent_phone IS NOT NULL
    AND trim(parent_phone) <> ''
),
unique_contact_students AS (
  SELECT
    contact_key,
    MIN(id::text)::uuid AS student_id
  FROM normalized_students
  WHERE contact_key IS NOT NULL
  GROUP BY contact_key
  HAVING COUNT(DISTINCT id) = 1
),
normalized_trials AS (
  SELECT
    id,
    nullif(regexp_replace(trim(phone), '[[:space:]-]+', '', 'g'), '') AS contact_key
  FROM public.trial_lessons
  WHERE student_id IS NULL
    AND phone IS NOT NULL
    AND trim(phone) <> ''
)
UPDATE public.trial_lessons AS tl
SET student_id = ucs.student_id
FROM normalized_trials AS nt
JOIN unique_contact_students AS ucs
  ON ucs.contact_key = nt.contact_key
WHERE tl.id = nt.id
  AND tl.student_id IS NULL;
