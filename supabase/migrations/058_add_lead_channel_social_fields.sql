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
