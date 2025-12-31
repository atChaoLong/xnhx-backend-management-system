-- 为 leads 表添加审计字段
-- 添加创建人和更新人字段

-- 添加字段
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_updated_by ON public.leads(updated_by);

-- 添加注释
COMMENT ON COLUMN public.leads.created_by IS '创建人姓名';
COMMENT ON COLUMN public.leads.updated_by IS '最后更新人姓名';
