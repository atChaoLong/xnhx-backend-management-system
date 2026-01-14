-- ============================================
-- 更新学生状态字段
-- 明确状态的可选值和业务含义
-- ============================================

-- 添加状态字段注释
COMMENT ON COLUMN public.students.status IS '学生状态：studying(在读), suspended(停课), completed(结课), refunded(退费)';

-- 更新现有状态（如果是旧数据，将 active 转换为 studying）
DO $$
BEGIN
  -- 检查是否有旧的状态值
  IF EXISTS (SELECT 1 FROM public.students WHERE status = 'active') THEN
    -- 将 active 转换为 studying
    UPDATE public.students SET status = 'studying' WHERE status = 'active';
    RAISE NOTICE '已将旧状态 active 转换为 studying';
  END IF;
END $$;

-- 创建学生状态枚举类型（可选，用于更严格的约束）
CREATE TYPE student_status_enum AS ENUM (
  'studying',   -- 在读
  'suspended',  -- 停课
  'completed',  -- 结课
  'refunded'    -- 退费
);

-- 注意：如果要使用严格的枚举约束，可以取消注释下面的语句
-- ALTER TABLE public.students ALTER COLUMN status TYPE student_status_enum USING status::student_status_enum;

-- 添加状态变更记录表（用于追踪状态历史）
CREATE TABLE IF NOT EXISTS public.student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,

  -- 状态变更信息
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,                    -- 变更原因

  -- 操作信息
  changed_by UUID,                -- 操作人ID
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- 外键约束
  CONSTRAINT fk_student_status_history_student
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_student_status_history_student_id
  ON public.student_status_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_status_history_changed_at
  ON public.student_status_history(changed_at DESC);

-- 添加注释
COMMENT ON TABLE public.student_status_history IS '学生状态变更历史';
COMMENT ON COLUMN public.student_status_history.student_id IS '学生ID';
COMMENT ON COLUMN public.student_status_history.old_status IS '变更前状态';
COMMENT ON COLUMN public.student_status_history.new_status IS '变更后状态';
COMMENT ON COLUMN public.student_status_history.reason IS '变更原因';
COMMENT ON COLUMN public.student_status_history.changed_by IS '操作人ID';
COMMENT ON COLUMN public.student_status_history.changed_at IS '变更时间';

-- 启用 RLS
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Authenticated users can view student status history"
  ON public.student_status_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert student status history"
  ON public.student_status_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- 创建触发器：自动记录状态变更
CREATE OR REPLACE FUNCTION log_student_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 只在状态真正改变时记录
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.student_status_history (
      student_id,
      old_status,
      new_status,
      reason,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.status_change_reason,
      NEW.status_changed_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（需要先在 students 表添加相关字段）
-- DROP TRIGGER IF EXISTS trigger_log_student_status_change ON public.students;
-- CREATE TRIGGER trigger_log_student_status_change
--   AFTER UPDATE OF status ON public.students
--   FOR EACH ROW EXECUTE FUNCTION log_student_status_change();
