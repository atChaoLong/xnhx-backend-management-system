-- 微信号管理表
CREATE TABLE IF NOT EXISTS public.wechat_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  priority INTEGER NOT NULL DEFAULT 0,       -- 优先级（数字越大优先级越高）
  wechat_id TEXT NOT NULL UNIQUE,            -- 微信号
  wechat_name TEXT NOT NULL,                 -- 微信昵称
  responsible_consultant TEXT,               -- 负责顾问
  team TEXT,                                 -- 所属团队
  account_type TEXT NOT NULL,                -- 账号类型
  phone TEXT NOT NULL,                       -- 手机号
  login_password TEXT NOT NULL,               -- 登录密码
  payment_password TEXT NOT NULL,             -- 支付密码
  real_name_person TEXT NOT NULL,             -- 实名人

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))  -- 状态
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_wechat_accounts_priority ON public.wechat_accounts(priority DESC);
CREATE INDEX IF NOT EXISTS idx_wechat_accounts_team ON public.wechat_accounts(team);
CREATE INDEX IF NOT EXISTS idx_wechat_accounts_status ON public.wechat_accounts(status);
CREATE INDEX IF NOT EXISTS idx_wechat_accounts_wechat_id ON public.wechat_accounts(wechat_id);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_wechat_accounts_updated_at ON public.wechat_accounts;
CREATE TRIGGER update_wechat_accounts_updated_at
  BEFORE UPDATE ON public.wechat_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.wechat_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wechat accounts"
  ON public.wechat_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert wechat accounts"
  ON public.wechat_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update wechat accounts"
  ON public.wechat_accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete wechat accounts"
  ON public.wechat_accounts FOR DELETE
  TO authenticated
  USING (true);

-- 添加注释
COMMENT ON TABLE public.wechat_accounts IS '微信号管理表：管理企业微信账号信息';
COMMENT ON COLUMN public.wechat_accounts.priority IS '优先级，数字越大优先级越高，用于分配时的排序';
COMMENT ON COLUMN public.wechat_accounts.wechat_id IS '微信号，唯一标识';
COMMENT ON COLUMN public.wechat_accounts.wechat_name IS '微信昵称';
COMMENT ON COLUMN public.wechat_accounts.responsible_consultant IS '负责顾问';
COMMENT ON COLUMN public.wechat_accounts.team IS '所属团队';
COMMENT ON COLUMN public.wechat_accounts.account_type IS '账号类型（个人号、企业号等）';
COMMENT ON COLUMN public.wechat_accounts.status IS '状态（active=启用, inactive=停用）';
