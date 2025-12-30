-- 为 leads 表添加创建人和更新人信息字段
-- 采用方案1：直接存储用户姓名（TEXT）

-- 添加字段
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by TEXT,              -- 创建人姓名
  ADD COLUMN IF NOT EXISTS updated_by TEXT;              -- 最后更新人姓名

-- 添加注释
COMMENT ON COLUMN public.leads.created_by IS '创建人姓名 - 记录谁创建的这条线索';
COMMENT ON COLUMN public.leads.updated_by IS '最后更新人姓名 - 记录谁最后修改了这条线索';

-- 验证字段
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('created_by', 'updated_by')
ORDER BY column_name;
