-- 补齐老师候选人招聘流程组件使用的备注与评级字段
ALTER TABLE public.teacher_candidates
ADD COLUMN IF NOT EXISTS interview_notes TEXT,
ADD COLUMN IF NOT EXISTS interview_rating TEXT,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

COMMENT ON COLUMN public.teacher_candidates.interview_notes IS '约面/面试视频阶段备注';
COMMENT ON COLUMN public.teacher_candidates.interview_rating IS '教学复核面试评级';
COMMENT ON COLUMN public.teacher_candidates.review_notes IS '教学复核备注或拒绝原因';
