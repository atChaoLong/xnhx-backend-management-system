-- Add salary entry fields used by the teacher recruitment finalization flow.
ALTER TABLE public.teacher_candidates
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS notes_external TEXT;

COMMENT ON COLUMN public.teacher_candidates.bank_account IS '老师入库银行卡号';
COMMENT ON COLUMN public.teacher_candidates.bank_account_name IS '老师入库银行卡持卡人姓名';
COMMENT ON COLUMN public.teacher_candidates.bank_name IS '老师入库开户银行';
COMMENT ON COLUMN public.teacher_candidates.bank_branch IS '老师入库开户支行';
COMMENT ON COLUMN public.teacher_candidates.notes_external IS '老师可见外显备注';
