-- 为 teacher_candidates 表添加抢单字段
-- 用于老师约面抢单功能（类似公共线索池）

ALTER TABLE public.teacher_candidates
  ADD COLUMN IF NOT EXISTS grab_user_id UUID,
  ADD COLUMN IF NOT EXISTS grab_user_name TEXT,
  ADD COLUMN IF NOT EXISTS grabbed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.teacher_candidates.grab_user_id IS '抢单用户ID';
COMMENT ON COLUMN public.teacher_candidates.grab_user_name IS '抢单用户名';
COMMENT ON COLUMN public.teacher_candidates.grabbed_at IS '抢单时间';
