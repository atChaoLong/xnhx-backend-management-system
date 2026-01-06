-- 为 formal_orders 添加关联线索与续费关联订单字段
ALTER TABLE public.formal_orders
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS previous_order_id UUID REFERENCES public.formal_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.formal_orders.lead_id IS '关联线索ID（新签/扩课时填写）';
COMMENT ON COLUMN public.formal_orders.previous_order_id IS '关联之前订单ID（续费时填写）';

