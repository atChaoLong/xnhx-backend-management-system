-- 为 teacher_candidates 表添加招聘流程字段
-- 用于跟踪教师在招聘流程中的位置

ALTER TABLE public.teacher_candidates
ADD COLUMN IF NOT EXISTS recruitment_step VARCHAR(50) DEFAULT 'scheduling',
ADD COLUMN IF NOT EXISTS recruitment_status VARCHAR(50) DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS video_reviewed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS reviewed_by_id UUID NULL,
ADD COLUMN IF NOT EXISTS salary_confirmed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS salary_confirmed_by_id UUID NULL;

-- 添加注释
COMMENT ON COLUMN public.teacher_candidates.recruitment_step IS '招聘流程步骤: scheduling|interview_video|teaching_review|salary_negotiation|final_entry|rejected';
COMMENT ON COLUMN public.teacher_candidates.recruitment_status IS '招聘状态: waiting_contact|scheduled|video_uploaded|pending_teaching_review|teaching_review_approved|pending_salary|in_teacher_pool|review_rejected';
COMMENT ON COLUMN public.teacher_candidates.video_reviewed_at IS '教学复核完成时间';
COMMENT ON COLUMN public.teacher_candidates.reviewed_by_id IS '教学复核人ID';
COMMENT ON COLUMN public.teacher_candidates.salary_confirmed_at IS '薪资确认时间';
COMMENT ON COLUMN public.teacher_candidates.salary_confirmed_by_id IS '薪资确认人ID';

-- 为查询效率添加索引
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_recruitment_step ON public.teacher_candidates(recruitment_step);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_recruitment_status ON public.teacher_candidates(recruitment_status);
