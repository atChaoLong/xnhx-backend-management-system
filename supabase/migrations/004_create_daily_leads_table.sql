-- 创建每日线索表
CREATE TABLE IF NOT EXISTS public.daily_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 基本信息
  name TEXT NOT NULL,                -- 姓名
  wechat_number TEXT NOT NULL,       -- 微信号
  assigned_person TEXT NOT NULL,     -- 归属人员
  received_date DATE NOT NULL,       -- 领取日期

  -- 状态和附件
  is_added BOOLEAN DEFAULT false,    -- 是否已添加
  resume_attachment TEXT,            -- 简历附件URL
  notes TEXT                         -- 备注
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_daily_leads_name ON public.daily_leads(name);
CREATE INDEX IF NOT EXISTS idx_daily_leads_wechat_number ON public.daily_leads(wechat_number);
CREATE INDEX IF NOT EXISTS idx_daily_leads_assigned_person ON public.daily_leads(assigned_person);
CREATE INDEX IF NOT EXISTS idx_daily_leads_received_date ON public.daily_leads(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_leads_is_added ON public.daily_leads(is_added);

-- 添加注释
COMMENT ON TABLE public.daily_leads IS '每日线索表：管理招聘线索信息';
COMMENT ON COLUMN public.daily_leads.name IS '线索姓名';
COMMENT ON COLUMN public.daily_leads.wechat_number IS '微信号';
COMMENT ON COLUMN public.daily_leads.assigned_person IS '归属人员（负责人）';
COMMENT ON COLUMN public.daily_leads.received_date IS '领取日期';
COMMENT ON COLUMN public.daily_leads.is_added IS '是否已添加（转为候选人）';
COMMENT ON COLUMN public.daily_leads.resume_attachment IS '简历附件URL';
COMMENT ON COLUMN public.daily_leads.notes IS '备注信息';

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_daily_leads_updated_at ON public.daily_leads;
CREATE TRIGGER update_daily_leads_updated_at
  BEFORE UPDATE ON public.daily_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.daily_leads ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：允许认证用户完整CRUD
CREATE POLICY "Authenticated users can view daily_leads"
  ON public.daily_leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert daily_leads"
  ON public.daily_leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily_leads"
  ON public.daily_leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete daily_leads"
  ON public.daily_leads FOR DELETE
  TO authenticated
  USING (true);
