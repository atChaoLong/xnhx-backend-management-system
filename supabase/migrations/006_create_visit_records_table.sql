-- 创建回访记录表
-- 用于记录班主任对学生家长的回访情况

CREATE TABLE IF NOT EXISTS public.visit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 关联字段
  student_id UUID NOT NULL,              -- 学生ID
  order_id UUID,                         -- 订单ID（可选）
  course_id UUID,                        -- 课程ID（可选）

  -- 回访信息
  visit_date DATE NOT NULL,              -- 回访日期
  visit_method TEXT,                     -- 回访方式（微信/电话/上门等）
  parent_attitude TEXT,                  -- 家长态度（满意/一般/不满意等）
  visit_notes TEXT NOT NULL,             -- 回访记录内容

  -- 人员信息
  visit_personnel TEXT NOT NULL,         -- 回访人员姓名
  next_visit_date DATE,                  -- 下次回访计划日期

  -- 审计字段
  created_by TEXT,                       -- 创建人
  updated_by TEXT                        -- 更新人
);

-- 创建更新时间戳触发器
DROP TRIGGER IF EXISTS update_visit_records_updated_at ON public.visit_records;
CREATE TRIGGER update_visit_records_updated_at BEFORE UPDATE ON public.visit_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_visit_records_student_id ON public.visit_records(student_id);
CREATE INDEX IF NOT EXISTS idx_visit_records_order_id ON public.visit_records(order_id);
CREATE INDEX IF NOT EXISTS idx_visit_records_course_id ON public.visit_records(course_id);
CREATE INDEX IF NOT EXISTS idx_visit_records_visit_date ON public.visit_records(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visit_records_visit_personnel ON public.visit_records(visit_personnel);

-- 创建复合索引：查询学生本月回访次数
CREATE INDEX IF NOT EXISTS idx_visit_records_student_date ON public.visit_records(student_id, visit_date DESC);

-- 启用 RLS (Row Level Security)
ALTER TABLE public.visit_records ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Authenticated users can view visit records" ON public.visit_records;
DROP POLICY IF EXISTS "Authenticated users can insert visit records" ON public.visit_records;
DROP POLICY IF EXISTS "Authenticated users can update visit records" ON public.visit_records;
DROP POLICY IF EXISTS "Authenticated users can delete visit records" ON public.visit_records;

-- 创建策略：允许所有认证用户读取
CREATE POLICY "Authenticated users can view visit records" ON public.visit_records
    FOR SELECT USING (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户插入
CREATE POLICY "Authenticated users can insert visit records" ON public.visit_records
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户更新
CREATE POLICY "Authenticated users can update visit records" ON public.visit_records
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户删除
CREATE POLICY "Authenticated users can delete visit records" ON public.visit_records
    FOR DELETE USING (auth.role() = 'authenticated');

-- 添加注释
COMMENT ON TABLE public.visit_records IS '学生回访记录表';
COMMENT ON COLUMN public.visit_records.student_id IS '关联的学生ID';
COMMENT ON COLUMN public.visit_records.order_id IS '关联的订单ID（可选）';
COMMENT ON COLUMN public.visit_records.course_id IS '关联的课程ID（可选）';
COMMENT ON COLUMN public.visit_records.visit_date IS '回访日期';
COMMENT ON COLUMN public.visit_records.visit_method IS '回访方式（微信/电话/上门等）';
COMMENT ON COLUMN public.visit_records.parent_attitude IS '家长态度（满意/一般/不满意等）';
COMMENT ON COLUMN public.visit_records.visit_notes IS '回访记录内容';
COMMENT ON COLUMN public.visit_records.visit_personnel IS '回访人员姓名';
COMMENT ON COLUMN public.visit_records.next_visit_date IS '下次回访计划日期';
