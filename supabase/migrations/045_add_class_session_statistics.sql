-- ============================================
-- 创建课堂统计表
-- 用于存储 ClassIn 课堂结束回调的详细统计数据
-- ============================================

-- 创建课堂统计表
CREATE TABLE IF NOT EXISTS public.class_session_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,                    -- 关联 class_sessions.id
  classroom_id TEXT NOT NULL,                  -- ClassIn 课堂 ID
  student_id INTEGER,                          -- 学生 ID (ClassIn SID)
  statistics JSONB NOT NULL,                   -- 完整的统计数据 JSON

  -- 提取的关键指标（便于查询和统计）
  stage_up_total JSONB,                        -- 上讲台统计
  inout_details JSONB,                         -- 进出课堂详情
  equipment_usage JSONB,                       -- 设备使用情况
  screen_sharing JSONB,                        -- 屏幕共享统计

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- 外键约束
  CONSTRAINT fk_session_id FOREIGN KEY (session_id)
    REFERENCES public.class_sessions(id)
    ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_class_session_stats_session_id
  ON public.class_session_statistics(session_id);

CREATE INDEX IF NOT EXISTS idx_class_session_stats_classroom_id
  ON public.class_session_statistics(classroom_id);

CREATE INDEX IF NOT EXISTS idx_class_session_stats_student_id
  ON public.class_session_statistics(student_id);

CREATE INDEX IF NOT EXISTS idx_class_session_stats_created_at
  ON public.class_session_statistics(created_at DESC);

-- 添加注释
COMMENT ON TABLE public.class_session_statistics IS '课堂统计数据 - 存储ClassIn课堂结束回调的详细统计';

COMMENT ON COLUMN public.class_session_statistics.session_id IS '关联的课节ID';
COMMENT ON COLUMN public.class_session_statistics.classroom_id IS 'ClassIn课堂ID';
COMMENT ON COLUMN public.class_session_statistics.student_id IS '学生ID (ClassIn SID)';
COMMENT ON COLUMN public.class_session_statistics.statistics IS '完整的统计数据JSON，包含stageEnd, silenceEnd, screenchangeEnd等';
COMMENT ON COLUMN public.class_session_statistics.stage_up_total IS '上讲台统计 - 便于快速查询';
COMMENT ON COLUMN public.class_session_statistics.inout_details IS '进出课堂详情 - 便于快速查询';
COMMENT ON COLUMN public.class_session_statistics.equipment_usage IS '设备使用情况 - 便于快速查询';
COMMENT ON COLUMN public.class_session_statistics.screen_sharing IS '屏幕共享统计 - 便于快速查询';

-- 启用 RLS（行级安全）
ALTER TABLE public.class_session_statistics ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：只有认证用户可以读取
CREATE POLICY "Authenticated users can view session statistics"
  ON public.class_session_statistics
  FOR SELECT
  TO authenticated
  USING (true);

-- 创建 RLS 策略：只有认证用户可以插入（通过API）
CREATE POLICY "Authenticated users can insert session statistics"
  ON public.class_session_statistics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 创建 RLS 策略：只有认证用户可以更新
CREATE POLICY "Authenticated users can update session statistics"
  ON public.class_session_statistics
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
