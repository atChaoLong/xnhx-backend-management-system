-- 为 teachers 表添加老师表单所需的所有字段
DO $$
BEGIN
  -- 基本信息
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS wechat TEXT;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS classin_phone TEXT;

  -- 教学信息（数组类型）
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS subjects TEXT[];
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS grade_levels TEXT[];

  -- 布尔类型字段
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS used_classin BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS has_certificate BOOLEAN DEFAULT FALSE;

  -- 教学经验
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS teaching_years NUMERIC;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS teaching_style TEXT;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS success_cases TEXT;

  -- 可选信息（多选）
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS available_times TEXT[];
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS textbook_versions TEXT[];
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS student_regions TEXT[];
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS student_levels TEXT[];

  -- 文件
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS photo_url TEXT;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS review_screenshots TEXT[];

  -- 银行卡信息
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS bank_card_info JSONB;

  -- 删除已废弃的 interview_link 字段（如果存在）
  ALTER TABLE public.teachers DROP COLUMN IF EXISTS interview_link;

END $$;

-- 添加字段注释
COMMENT ON COLUMN public.teachers.wechat IS '微信号';
COMMENT ON COLUMN public.teachers.classin_phone IS 'ClassIn注册手机号';
COMMENT ON COLUMN public.teachers.subjects IS '教授学科（数组）';
COMMENT ON COLUMN public.teachers.grade_levels IS '教授年级段（数组）';
COMMENT ON COLUMN public.teachers.used_classin IS '是否用过ClassIn';
COMMENT ON COLUMN public.teachers.has_certificate IS '是否有教资证';
COMMENT ON COLUMN public.teachers.teaching_years IS '教学年限（年）';
COMMENT ON COLUMN public.teachers.teaching_style IS '教学特点';
COMMENT ON COLUMN public.teachers.success_cases IS '优秀学员提分案例';
COMMENT ON COLUMN public.teachers.available_times IS '可排课时间（数组）';
COMMENT ON COLUMN public.teachers.textbook_versions IS '熟悉的教材版本（数组）';
COMMENT ON COLUMN public.teachers.student_regions IS '带过学生地域（数组）';
COMMENT ON COLUMN public.teachers.student_levels IS '擅长的学生水平（数组）';
COMMENT ON COLUMN public.teachers.photo_url IS '老师形象照URL';
COMMENT ON COLUMN public.teachers.review_screenshots IS '提分/好评截图URL数组';
COMMENT ON COLUMN public.teachers.bank_card_info IS '银行卡信息（JSON格式）';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teachers_wechat ON public.teachers(wechat);
CREATE INDEX IF NOT EXISTS idx_teachers_classin_phone ON public.teachers(classin_phone);
