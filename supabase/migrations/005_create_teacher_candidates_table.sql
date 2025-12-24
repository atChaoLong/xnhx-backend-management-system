-- 老师候选人表（招聘流程）
CREATE TABLE IF NOT EXISTS public.teacher_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 基本信息
  name TEXT NOT NULL,
  wechat_id TEXT NOT NULL UNIQUE,
  daily_lead_id UUID REFERENCES public.daily_leads(id),
  resume_url TEXT,
  profile_photo_url TEXT,

  -- 岗位信息
  grade_level TEXT,
  subjects_taught TEXT[],
  teacher_type TEXT,

  -- 约面信息
  interview_date DATE,
  interviewer_name TEXT,
  interview_time TIME,
  interview_link TEXT,
  interview_officer TEXT,

  -- 面试过程
  interview_exception TEXT,
  video_recording_url TEXT,
  trial_subject TEXT,
  trial_video_url TEXT,
  teaching_style TEXT,

  -- 面试评分
  interview_month TEXT,
  interview_week INTEGER,
  appointment_week INTEGER,
  registration_date DATE,
  interview_score DECIMAL(5,2),
  interview_score_total DECIMAL(5,2),
  logical_expression_score DECIMAL(5,2),
  dress_appearance_score DECIMAL(5,2),
  material_preparation_score DECIMAL(5,2),
  exam_score TEXT,

  -- 素质评价
  initial_evaluation TEXT,
  interview_evaluation TEXT,
  teacher_characteristics TEXT,
  mandarin_level TEXT,
  research_ability TEXT,
  service_awareness TEXT,
  affinity TEXT,

  -- 复核状态
  review_status TEXT DEFAULT '待复核' CHECK (review_status IN ('待复核', '已复核', '不符合')),
  reviewer_name TEXT,
  review_result TEXT,
  review_evaluation_comment TEXT,
  review_date DATE,
  reviewed_by UUID REFERENCES auth.users(id),

  -- 薪资信息
  current_rate DECIMAL(10,2),
  approved_hourly_rate DECIMAL(10,2),

  -- 招聘决定
  is_hired BOOLEAN DEFAULT false,
  teacher_feeling TEXT,
  suitable_for_students TEXT,
  scheduling_preference TEXT,
  enrolled_teacher_name TEXT,
  hired_notes TEXT,
  teacher_level TEXT,
  can_teach_graduation_class BOOLEAN,
  qr_code TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_name ON public.teacher_candidates(name);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_wechat_id ON public.teacher_candidates(wechat_id);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_daily_lead_id ON public.teacher_candidates(daily_lead_id);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_interview_date ON public.teacher_candidates(interview_date);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_review_status ON public.teacher_candidates(review_status);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_is_hired ON public.teacher_candidates(is_hired);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_teacher_candidates_updated_at ON public.teacher_candidates;
CREATE TRIGGER update_teacher_candidates_updated_at
  BEFORE UPDATE ON public.teacher_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE public.teacher_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teacher candidates"
  ON public.teacher_candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teacher candidates"
  ON public.teacher_candidates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teacher candidates"
  ON public.teacher_candidates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete teacher candidates"
  ON public.teacher_candidates FOR DELETE
  TO authenticated
  USING (true);
