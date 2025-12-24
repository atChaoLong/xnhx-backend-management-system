-- 老师管理表（已入库老师信息管理）
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 基本信息
  teacher_name TEXT NOT NULL,            -- 老师姓名
  gender TEXT NOT NULL,                  -- 性别
  wechat TEXT NOT NULL,                  -- 微信号
  classin_phone TEXT NOT NULL,           -- Classin注册手机号
  location TEXT NOT NULL,                -- 老师所在地

  -- 教学信息
  subjects TEXT[] NOT NULL,              -- 教授学科
  grade_levels TEXT[] NOT NULL,          -- 教授年级段
  used_classin BOOLEAN DEFAULT false,    -- 是否用过Classin
  has_certificate BOOLEAN DEFAULT false, -- 是否有教资证

  -- 学历背景
  education TEXT NOT NULL,               -- 学历
  university TEXT NOT NULL,              -- 毕业院校

  -- 教学能力
  available_times TEXT[],                -- 可排课时间
  textbook_versions TEXT[],              -- 熟悉的教材版本
  student_regions TEXT[],                -- 带过学生地域
  student_levels TEXT[],                 -- 擅长的学生水平
  teaching_years INTEGER,                -- 教学年限

  -- 教学经历
  teaching_style TEXT,                   -- 教学特点
  teaching_experience TEXT,              -- 教学经历
  success_cases TEXT,                    -- 优秀学员提分案例

  -- 附件
  photo_url TEXT,                        -- 老师形象照URL
  review_screenshots TEXT[],             -- 提分/好评截图URLs

  -- 其他
  notes TEXT,                            -- 备注
  bank_card_info JSONB                   -- 银行卡信息
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_teacher_name ON public.teacher_profiles(teacher_name);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_wechat ON public.teacher_profiles(wechat);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_location ON public.teacher_profiles(location);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_subjects ON public.teacher_profiles USING GIN(subjects);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_grade_levels ON public.teacher_profiles USING GIN(grade_levels);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_teacher_profiles_updated_at ON public.teacher_profiles;
CREATE TRIGGER update_teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teacher_profiles"
  ON public.teacher_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teacher_profiles"
  ON public.teacher_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teacher_profiles"
  ON public.teacher_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete teacher_profiles"
  ON public.teacher_profiles FOR DELETE
  TO authenticated
  USING (true);

-- 创建存储桶用于老师照片
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-photos', 'teacher-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 存储策略：允许公开访问老师照片
CREATE POLICY "Public access to teacher photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'teacher-photos');

CREATE POLICY "Authenticated users can upload teacher photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'teacher-photos');

CREATE POLICY "Authenticated users can delete teacher photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'teacher-photos');
