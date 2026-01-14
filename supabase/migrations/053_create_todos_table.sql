-- 创建待办事项表
CREATE TABLE IF NOT EXISTS public.todos (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 审计字段
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  completed_at TIMESTAMPTZ,

  -- 分配信息
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,

  -- 待办内容
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',

  -- 业务关联（可选）
  entity_type TEXT,
  entity_id TEXT,

  -- 状态管理
  status TEXT DEFAULT 'pending',
  due_date TIMESTAMPTZ,

  -- 元数据
  metadata JSONB,

  -- 自动化标识
  is_auto_created BOOLEAN DEFAULT false,
  auto_trigger_type TEXT
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON public.todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_status ON public.todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON public.todos(created_by);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON public.todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_entity ON public.todos(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON public.todos(due_date);

-- 添加字段注释
COMMENT ON TABLE public.todos IS '待办事项表';
COMMENT ON COLUMN public.todos.id IS '主键ID';
COMMENT ON COLUMN public.todos.created_at IS '创建时间';
COMMENT ON COLUMN public.todos.updated_at IS '更新时间';
COMMENT ON COLUMN public.todos.created_by IS '创建人用户ID';
COMMENT ON COLUMN public.todos.completed_at IS '完成时间';
COMMENT ON COLUMN public.todos.assigned_to IS '分配给谁的用户ID';
COMMENT ON COLUMN public.todos.assigned_by IS '分配人用户ID';
COMMENT ON COLUMN public.todos.title IS '待办标题';
COMMENT ON COLUMN public.todos.description IS '详细描述';
COMMENT ON COLUMN public.todos.priority IS '优先级：low, medium, high, urgent';
COMMENT ON COLUMN public.todos.entity_type IS '关联实体类型：lead, student, trial_lesson, formal_order';
COMMENT ON COLUMN public.todos.entity_id IS '关联实体ID';
COMMENT ON COLUMN public.todos.status IS '状态：pending, completed, cancelled';
COMMENT ON COLUMN public.todos.due_date IS '到期时间';
COMMENT ON COLUMN public.todos.metadata IS '额外信息（JSON格式）';
COMMENT ON COLUMN public.todos.is_auto_created IS '是否自动创建';
COMMENT ON COLUMN public.todos.auto_trigger_type IS '自动触发类型标识';

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_todos_updated_at ON public.todos;
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能看到分配给自己的待办
CREATE POLICY "用户只能看到分配给自己的待办"
  ON public.todos FOR SELECT
  USING (assigned_to = (SELECT id FROM auth.users WHERE id = auth.uid()));

-- RLS 策略：用户可以更新分配给自己的待办（标记完成等）
CREATE POLICY "用户可以更新分配给自己的待办"
  ON public.todos FOR UPDATE
  USING (assigned_to = (SELECT id FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (assigned_to = (SELECT id FROM auth.users WHERE id = auth.uid()));

-- RLS 策略：运营和管理员可以创建待办并分配给其他人
CREATE POLICY "运营和管理员可以创建待办"
  ON public.todos FOR INSERT
  WITH CHECK (
    -- 创建人必须是当前用户
    created_by = (SELECT id FROM auth.users WHERE id = auth.uid())
    AND assigned_by = (SELECT id FROM auth.users WHERE id = auth.uid())
  );

-- RLS 策略：管理员可以查看所有待办
CREATE POLICY "管理员可以查看所有待办"
  ON public.todos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT id FROM auth.users WHERE id = auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- RLS 策略：创建人可以删除自己创建的待办
CREATE POLICY "创建人可以删除自己的待办"
  ON public.todos FOR DELETE
  USING (
    created_by = (SELECT id FROM auth.users WHERE id = auth.uid())
  );
