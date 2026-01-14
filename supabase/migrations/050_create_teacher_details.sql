-- 添加手机号和面试结果字段到 teacher_candidates 表
ALTER TABLE public.teacher_candidates
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS interview_result TEXT;

-- 添加注释
COMMENT ON COLUMN public.teacher_candidates.phone IS '手机号';
COMMENT ON COLUMN public.teacher_candidates.interview_result IS '面试结果';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_phone ON public.teacher_candidates(phone);
CREATE INDEX IF NOT EXISTS idx_teacher_candidates_interview_result ON public.teacher_candidates(interview_result);

-- 创建老师详细信息表
CREATE TABLE IF NOT EXISTS public.teacher_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 关联候选人（可选）
  candidate_id UUID REFERENCES public.teacher_candidates(id) ON DELETE SET NULL,

  -- 基本信息
  teacher_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  wechat TEXT NOT NULL,
  classin_phone TEXT NOT NULL,
  location TEXT NOT NULL,

  -- 教学相关
  subjects TEXT[] NOT NULL,
  grade_levels TEXT[] NOT NULL,
  used_classin TEXT NOT NULL,
  has_certificate TEXT NOT NULL,
  education TEXT NOT NULL,
  university TEXT NOT NULL,
  teaching_years NUMERIC NOT NULL,

  -- 可选信息（多选）
  available_times TEXT[] NOT NULL,
  textbook_versions TEXT[] NOT NULL,
  student_regions TEXT[] NOT NULL,
  student_levels TEXT[] NOT NULL,

  -- 文本描述
  teaching_style TEXT NOT NULL,
  teaching_experience TEXT NOT NULL,
  success_cases TEXT NOT NULL,
  notes TEXT,

  -- 文件
  photo_url TEXT NOT NULL,
  review_screenshots TEXT[]
);

-- 添加注释
COMMENT ON TABLE public.teacher_details IS '老师详细信息表';
COMMENT ON COLUMN public.teacher_details.candidate_id IS '关联的老师候选人ID';
COMMENT ON COLUMN public.teacher_details.teacher_name IS '老师姓名';
COMMENT ON COLUMN public.teacher_details.gender IS '性别';
COMMENT ON COLUMN public.teacher_details.wechat IS '微信号';
COMMENT ON COLUMN public.teacher_details.classin_phone IS 'ClassIn注册手机号';
COMMENT ON COLUMN public.teacher_details.location IS '老师所在地';
COMMENT ON COLUMN public.teacher_details.subjects IS '教授学科（数组）';
COMMENT ON COLUMN public.teacher_details.grade_levels IS '教授年级段（数组）';
COMMENT ON COLUMN public.teacher_details.used_classin IS '是否用过ClassIn';
COMMENT ON COLUMN public.teacher_details.has_certificate IS '是否有教资证';
COMMENT ON COLUMN public.teacher_details.education IS '学历';
COMMENT ON COLUMN public.teacher_details.university IS '毕业院校';
COMMENT ON COLUMN public.teacher_details.teaching_years IS '教学年限（年）';
COMMENT ON COLUMN public.teacher_details.available_times IS '可排课时间（数组）';
COMMENT ON COLUMN public.teacher_details.textbook_versions IS '熟悉的教材版本（数组）';
COMMENT ON COLUMN public.teacher_details.student_regions IS '带过学生地域（数组）';
COMMENT ON COLUMN public.teacher_details.student_levels IS '擅长的学生水平（数组）';
COMMENT ON COLUMN public.teacher_details.teaching_style IS '教学特点';
COMMENT ON COLUMN public.teacher_details.teaching_experience IS '教学经历';
COMMENT ON COLUMN public.teacher_details.success_cases IS '优秀学员提分案例';
COMMENT ON COLUMN public.teacher_details.notes IS '备注';
COMMENT ON COLUMN public.teacher_details.photo_url IS '老师形象照URL';
COMMENT ON COLUMN public.teacher_details.review_screenshots IS '提分/好评截图URL数组';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_details_created_at ON public.teacher_details(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_details_wechat ON public.teacher_details(wechat);
CREATE INDEX IF NOT EXISTS idx_teacher_details_candidate_id ON public.teacher_details(candidate_id);
CREATE INDEX IF NOT EXISTS idx_teacher_details_classin_phone ON public.teacher_details(classin_phone);

-- 启用 RLS
ALTER TABLE public.teacher_details ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- 允许所有人插入（公开表单，不需要登录）
CREATE POLICY "允许所有人提交表单"
ON public.teacher_details
FOR INSERT
TO public
WITH CHECK (true);

-- 允许认证用户读取
CREATE POLICY "允许认证用户读取老师详细信息"
ON public.teacher_details
FOR SELECT
TO authenticated
USING (true);

-- 允许管理员更新和删除
CREATE POLICY "允许管理员更新老师详细信息"
ON public.teacher_details
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

CREATE POLICY "允许管理员删除老师详细信息"
ON public.teacher_details
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);
