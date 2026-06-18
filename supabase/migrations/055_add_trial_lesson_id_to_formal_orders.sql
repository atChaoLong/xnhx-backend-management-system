-- 为正式订单补充来源试听关联，支持试听转正式和防重复转化
ALTER TABLE public.formal_orders
ADD COLUMN IF NOT EXISTS trial_lesson_id UUID REFERENCES public.trial_lessons(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_formal_orders_trial_lesson_id_unique
ON public.formal_orders(trial_lesson_id)
WHERE trial_lesson_id IS NOT NULL;

COMMENT ON COLUMN public.formal_orders.trial_lesson_id IS '来源试听课程ID（试听转正式时填写）';
