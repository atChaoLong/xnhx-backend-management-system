-- 创建线索表（与在线数据库结构一致）
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 必填字段
  report_number TEXT NOT NULL,          -- 报单序号
  entry_date DATE NOT NULL,             -- 录单日期
  xhs_source TEXT NOT NULL,             -- 小红书账号来源
  grade_code TEXT NOT NULL,             -- 年级代码
  add_method_code TEXT NOT NULL,        -- 添加方式代码
  operator_id TEXT NOT NULL,            -- 运营人员ID

  -- 可选字段
  subject_codes TEXT[],                 -- 学科代码数组
  region_ip TEXT,                       -- 地域IP
  parent_wechat TEXT,                   -- 家长微信号
  chat_screenshots TEXT,                -- 聊天截图 (URL或路径)

  -- 业务字段
  duplicate_mark BOOLEAN DEFAULT false, -- 重复标记
  collision_operator TEXT,              -- 冲突运营人员
  grab_wechat TEXT,                     -- 抢单微信号
  grab_user_id TEXT,                    -- 抢单用户ID
  add_feedback TEXT,                    -- 添加反馈
  feedback_time TIMESTAMPTZ,            -- 反馈时间
  add_status TEXT,                      -- 添加状态
  conversion_status TEXT,               -- 转化状态
  remark TEXT                           -- 备注
);

-- 创建每日线索表（招聘线索）
CREATE TABLE IF NOT EXISTS public.daily_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    name TEXT NOT NULL,
    wechat_number TEXT NOT NULL,
    assigned_person TEXT NOT NULL,
    received_date DATE NOT NULL,
    is_added BOOLEAN DEFAULT false,
    resume_attachment TEXT,
    notes TEXT
);

-- 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 leads 表添加触发器
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为 daily_leads 表添加触发器
DROP TRIGGER IF EXISTS update_daily_leads_updated_at ON public.daily_leads;
CREATE TRIGGER update_daily_leads_updated_at BEFORE UPDATE ON public.daily_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_leads_entry_date ON public.leads(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_report_number ON public.leads(report_number);
CREATE INDEX IF NOT EXISTS idx_leads_conversion_status ON public.leads(conversion_status);
CREATE INDEX IF NOT EXISTS idx_leads_add_status ON public.leads(add_status);

CREATE INDEX IF NOT EXISTS idx_daily_leads_received_date ON public.daily_leads(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_leads_is_added ON public.daily_leads(is_added);

-- 启用 RLS (Row Level Security)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_leads ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Enable update access for all authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Enable delete access for all authenticated users" ON public.leads;

DROP POLICY IF EXISTS "Authenticated users can view daily leads" ON public.daily_leads;
DROP POLICY IF EXISTS "Authenticated users can insert daily leads" ON public.daily_leads;
DROP POLICY IF EXISTS "Authenticated users can update daily leads" ON public.daily_leads;
DROP POLICY IF EXISTS "Authenticated users can delete daily leads" ON public.daily_leads;

-- 创建策略：允许所有认证用户读取
CREATE POLICY "Enable read access for all authenticated users" ON public.leads
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view daily leads" ON public.daily_leads
    FOR SELECT USING (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户插入
CREATE POLICY "Enable insert access for all authenticated users" ON public.leads
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert daily leads" ON public.daily_leads
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户更新
CREATE POLICY "Enable update access for all authenticated users" ON public.leads
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update daily leads" ON public.daily_leads
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户删除
CREATE POLICY "Enable delete access for all authenticated users" ON public.leads
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete daily leads" ON public.daily_leads
    FOR DELETE USING (auth.role() = 'authenticated');
