-- 为退费/异动记录补充正式生与订单关联，支持正式生详情页聚合和退费金额校验。

ALTER TABLE public.transaction_records
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.formal_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_records_student_id
  ON public.transaction_records(student_id);

CREATE INDEX IF NOT EXISTS idx_transaction_records_order_id
  ON public.transaction_records(order_id);

COMMENT ON COLUMN public.transaction_records.student_id IS '关联学生ID，用于正式生详情与权限过滤';
COMMENT ON COLUMN public.transaction_records.order_id IS '关联正式订单ID，用于退费上限校验';
