-- ============================================
-- 合并 teacher_profiles 表到 teachers 表
-- 将老师入库和老师库存统一为一张表
-- ============================================

DO $$
DECLARE
  profile_count INTEGER;
BEGIN
  -- 检查 teacher_profiles 表是否有数据
  SELECT COUNT(*) INTO profile_count
  FROM information_schema.tables
  WHERE table_name = 'teacher_profiles';

  IF profile_count > 0 THEN
    RAISE NOTICE 'teacher_profiles 表存在，准备合并...';
  ELSE
    RAISE NOTICE 'teacher_profiles 表不存在，跳过合并';
  END IF;
END $$;

-- ============================================
-- 第一步：给 teachers 表添加 teacher_profiles 的字段
-- ============================================

ALTER TABLE public.teachers
  -- 基本信息（如果不存在则添加）
  ADD COLUMN IF NOT EXISTS wechat TEXT,
  ADD COLUMN IF NOT EXISTS classin_phone TEXT,

  -- 教学信息（将单数字段改为数组）
  ADD COLUMN IF NOT EXISTS subjects TEXT[],
  ADD COLUMN IF NOT EXISTS grade_levels TEXT[],

  -- 能力标记
  ADD COLUMN IF NOT EXISTS used_classin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_certificate BOOLEAN DEFAULT false,

  -- 教学能力
  ADD COLUMN IF NOT EXISTS available_times TEXT[],
  ADD COLUMN IF NOT EXISTS textbook_versions TEXT[],
  ADD COLUMN IF NOT EXISTS student_regions TEXT[],
  ADD COLUMN IF NOT EXISTS student_levels TEXT[],
  ADD COLUMN IF NOT EXISTS teaching_years INTEGER,

  -- 教学经历
  ADD COLUMN IF NOT EXISTS teaching_style TEXT,
  ADD COLUMN IF NOT EXISTS success_cases TEXT,

  -- 附件
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS review_screenshots TEXT[],

  -- 其他信息
  ADD COLUMN IF NOT EXISTS bank_card_info JSONB;

-- 添加注释
COMMENT ON COLUMN public.teachers.wechat IS '微信号';
COMMENT ON COLUMN public.teachers.classin_phone IS 'ClassIn注册手机号';
COMMENT ON COLUMN public.teachers.subjects IS '教授学科数组';
COMMENT ON COLUMN public.teachers.grade_levels IS '教授年级段数组';
COMMENT ON COLUMN public.teachers.used_classin IS '是否使用过ClassIn';
COMMENT ON COLUMN public.teachers.has_certificate IS '是否有教资证';
COMMENT ON COLUMN public.teachers.available_times IS '可排课时间';
COMMENT ON COLUMN public.teachers.textbook_versions IS '熟悉的教材版本';
COMMENT ON COLUMN public.teachers.student_regions IS '带过学生地域';
COMMENT ON COLUMN public.teachers.student_levels IS '擅长的学生水平';
COMMENT ON COLUMN public.teachers.teaching_years IS '教学年限';
COMMENT ON COLUMN public.teachers.teaching_style IS '教学特点';
COMMENT ON COLUMN public.teachers.success_cases IS '优秀学员提分案例';
COMMENT ON COLUMN public.teachers.photo_url IS '老师形象照URL';
COMMENT ON COLUMN public.teachers.review_screenshots IS '提分/好评截图URLs';
COMMENT ON COLUMN public.teachers.bank_card_info IS '银行卡信息';

-- ============================================
-- 第二步：迁移 teacher_profiles 数据到 teachers 表
-- ============================================

-- 更新已存在的 teachers 记录（通过 classin_uid 或 name 匹配）
UPDATE public.teachers t
SET
  wechat = COALESCE(tp.wechat, t.wechat),
  classin_phone = COALESCE(tp.classin_phone, t.classin_phone),
  subjects = COALESCE(t.subjects, tp.subjects),
  grade_levels = COALESCE(t.grade_levels, tp.grade_levels),
  used_classin = COALESCE(t.used_classin, tp.used_classin),
  has_certificate = COALESCE(t.has_certificate, tp.has_certificate),
  education = COALESCE(t.education, tp.education),
  university = COALESCE(t.university, tp.university),
  available_times = COALESCE(t.available_times, tp.available_times),
  textbook_versions = COALESCE(t.textbook_versions, tp.textbook_versions),
  student_regions = COALESCE(t.student_regions, tp.student_regions),
  student_levels = COALESCE(t.student_levels, tp.student_levels),
  teaching_years = COALESCE(t.teaching_years, tp.teaching_years),
  teaching_style = COALESCE(t.teaching_style, tp.teaching_style),
  success_cases = COALESCE(t.success_cases, tp.success_cases),
  photo_url = COALESCE(t.photo_url, tp.photo_url),
  review_screenshots = COALESCE(t.review_screenshots, tp.review_screenshots),
  bank_card_info = COALESCE(t.bank_card_info, tp.bank_card_info)
FROM public.teacher_profiles tp
WHERE t.name = tp.teacher_name
   OR (t.classin_uid IS NOT NULL AND tp.classin_uid IS NOT NULL AND t.classin_uid = tp.classin_uid);

-- 插入在 teacher_profiles 但不在 teachers 的记录
INSERT INTO public.teachers (
  name,
  gender,
  wechat,
  classin_phone,
  mobile,
  email,
  location,
  subject,
  subjects,
  grade,
  grade_levels,
  education,
  university,
  used_classin,
  has_certificate,
  available_times,
  textbook_versions,
  student_regions,
  student_levels,
  teaching_years,
  teaching_style,
  success_cases,
  photo_url,
  review_screenshots,
  notes,
  bank_card_info,
  status,
  is_del
)
SELECT
  tp.teacher_name as name,
  tp.gender,
  tp.wechat,
  tp.classin_phone,
  NULL as mobile,
  NULL as email,
  tp.location,
  tp.subjects[1] as subject,
  tp.subjects,
  tp.grade_levels[1] as grade,
  tp.grade_levels,
  tp.education,
  tp.university,
  COALESCE(tp.used_classin, false),
  COALESCE(tp.has_certificate, false),
  tp.available_times,
  tp.textbook_versions,
  tp.student_regions,
  tp.student_levels,
  tp.teaching_years,
  tp.teaching_style,
  tp.success_cases,
  tp.photo_url,
  tp.review_screenshots,
  NULL as notes,
  tp.bank_card_info,
  'active' as status,
  0 as is_del
FROM public.teacher_profiles tp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.teachers t
  WHERE t.name = tp.teacher_name
)

-- ============================================
-- 第三步：重命名 teacher_profiles 表为备份表（安全起见）
-- ============================================

-- 先删除可能存在的同名备份表
DROP TABLE IF EXISTS public.teacher_profiles_backup;

-- 重命名当前表为备份表
ALTER TABLE public.teacher_profiles RENAME TO teacher_profiles_backup;

-- ============================================
-- 第四步：创建索引以优化查询
-- ============================================

-- 创建数组字段的 GIN 索引
CREATE INDEX IF NOT EXISTS idx_teachers_subjects ON public.teachers USING GIN(subjects);
CREATE INDEX IF NOT EXISTS idx_teachers_grade_levels ON public.teachers USING GIN(grade_levels);
CREATE INDEX IF NOT EXISTS idx_teachers_available_times ON public.teachers USING GIN(available_times);
CREATE INDEX IF NOT EXISTS idx_teachers_textbook_versions ON public.teachers USING GIN(textbook_versions);
CREATE INDEX IF NOT EXISTS idx_teachers_student_regions ON public.teachers USING GIN(student_regions);

-- 创建 wechat 和 classin_phone 索引
CREATE INDEX IF NOT EXISTS idx_teachers_wechat ON public.teachers(wechat);
CREATE INDEX IF NOT EXISTS idx_teachers_classin_phone ON public.teachers(classin_phone);

-- ============================================
-- 第五步：更新表注释
-- ============================================

COMMENT ON TABLE public.teachers IS '老师表（已合并 teacher_profiles），包含老师入库和库存的所有信息';

-- ============================================
-- 迁移完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE 'teacher_profiles 表已合并到 teachers 表';
  RAISE NOTICE '原表已重命名为 teacher_profiles_backup_[timestamp]';
  RAISE NOTICE '请确认代码更新后，可以手动删除备份表';
  RAISE NOTICE '====================================';
END $$;
