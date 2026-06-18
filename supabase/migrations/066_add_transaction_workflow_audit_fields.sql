-- Add workflow audit fields for transaction/refund review steps.
ALTER TABLE public.transaction_records
  ADD COLUMN IF NOT EXISTS academic_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS academic_verified_by UUID,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID,
  ADD COLUMN IF NOT EXISTS performance_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS performance_verified_by UUID;

COMMENT ON COLUMN public.transaction_records.academic_verified_at IS '教务核对金额时间';
COMMENT ON COLUMN public.transaction_records.academic_verified_by IS '教务核对金额操作人';
COMMENT ON COLUMN public.transaction_records.paid_at IS '财务打款时间';
COMMENT ON COLUMN public.transaction_records.paid_by IS '财务打款操作人';
COMMENT ON COLUMN public.transaction_records.performance_verified_at IS '人力业绩核对时间';
COMMENT ON COLUMN public.transaction_records.performance_verified_by IS '人力业绩核对操作人';
