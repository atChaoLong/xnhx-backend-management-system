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
