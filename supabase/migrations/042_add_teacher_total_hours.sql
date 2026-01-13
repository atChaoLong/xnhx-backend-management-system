-- 为 teachers 表添加累计课时字段
-- 用于记录老师的累计授课时长

-- 添加 total_hours 字段
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS total_hours DECIMAL(10, 2) DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN public.teachers.total_hours IS '累计授课时长（小时），保留2位小数';

-- 创建索引以便快速查询高课时老师
CREATE INDEX IF NOT EXISTS idx_teachers_total_hours ON public.teachers(total_hours DESC);
