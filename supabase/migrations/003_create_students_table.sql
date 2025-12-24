-- 创建学生表（与在线数据库结构一致）
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 基本信息
  student_number TEXT,               -- 学生学号
  student_name TEXT NOT NULL,         -- 学生姓名（必填）
  grade_code TEXT,                    -- 年级代码
  region TEXT,                        -- 地域
  school TEXT,                        -- 学校
  parent_phone TEXT,                  -- 家长电话
  head_teacher_id TEXT,               -- 班主任ID
  status TEXT DEFAULT 'active'        -- 状态（默认active）
);

-- 确保 update_updated_at_column 函数存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建更新时间戳触发器
DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_students_student_number ON public.students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_grade_code ON public.students(grade_code);
CREATE INDEX IF NOT EXISTS idx_students_region ON public.students(region);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON public.students(created_at DESC);

-- 启用 RLS (Row Level Security)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can insert students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can update students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;

-- 创建策略：允许所有认证用户读取
CREATE POLICY "Authenticated users can view students" ON public.students
    FOR SELECT USING (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户插入
CREATE POLICY "Authenticated users can insert students" ON public.students
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户更新
CREATE POLICY "Authenticated users can update students" ON public.students
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户删除
CREATE POLICY "Authenticated users can delete students" ON public.students
    FOR DELETE USING (auth.role() = 'authenticated');
