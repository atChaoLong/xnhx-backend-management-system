-- 创建试听课程表
CREATE TABLE IF NOT EXISTS public.trial_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 基本信息
    child_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

    -- 课程信息
    region TEXT NOT NULL,
    grade TEXT NOT NULL,
    trial_subject TEXT NOT NULL,
    trial_time TIMESTAMPTZ NOT NULL,
    trial_duration DECIMAL(10, 2) NOT NULL,

    -- 联系信息
    phone TEXT NOT NULL,
    channel TEXT NOT NULL,

    -- 财务信息
    trial_amount DECIMAL(10, 2),
    payment_proof TEXT NOT NULL,

    -- 优先级
    urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),

    -- 业务信息
    notes TEXT,
    assigned_consultant TEXT,
    course_status TEXT,
    student_type TEXT,

    -- 教务信息
    matched_teacher TEXT,
    confirmed_teacher TEXT,
    class_link TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_trial_lessons_child_name ON public.trial_lessons(child_name);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_lead_id ON public.trial_lessons(lead_id);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_status ON public.trial_lessons(status);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_trial_time ON public.trial_lessons(trial_time DESC);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_region ON public.trial_lessons(region);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_grade ON public.trial_lessons(grade);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_urgency ON public.trial_lessons(urgency_level);
CREATE INDEX IF NOT EXISTS idx_trial_lessons_class_link ON public.trial_lessons(class_link);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trial_lessons_updated_at
    BEFORE UPDATE ON public.trial_lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE public.trial_lessons IS '试听课程表';
COMMENT ON COLUMN public.trial_lessons.child_name IS '孩子称呼';
COMMENT ON COLUMN public.trial_lessons.status IS '状态: pending-待确认, confirmed-已确认, completed-已完成, cancelled-已取消';
COMMENT ON COLUMN public.trial_lessons.lead_id IS '关联线索ID';
COMMENT ON COLUMN public.trial_lessons.region IS '地域';
COMMENT ON COLUMN public.trial_lessons.grade IS '年级';
COMMENT ON COLUMN public.trial_lessons.trial_subject IS '试听科目';
COMMENT ON COLUMN public.trial_lessons.trial_time IS '试听时间';
COMMENT ON COLUMN public.trial_lessons.trial_duration IS '试听时长（小时）';
COMMENT ON COLUMN public.trial_lessons.phone IS '手机号';
COMMENT ON COLUMN public.trial_lessons.channel IS '渠道';
COMMENT ON COLUMN public.trial_lessons.trial_amount IS '试听金额';
COMMENT ON COLUMN public.trial_lessons.payment_proof IS '付款凭证URL';
COMMENT ON COLUMN public.trial_lessons.urgency_level IS '紧急程度: low-低, medium-中, high-高, urgent-紧急';
COMMENT ON COLUMN public.trial_lessons.notes IS '备注';
COMMENT ON COLUMN public.trial_lessons.assigned_consultant IS '对应顾问';
COMMENT ON COLUMN public.trial_lessons.course_status IS '课程状态';
COMMENT ON COLUMN public.trial_lessons.student_type IS '学生类型';
COMMENT ON COLUMN public.trial_lessons.matched_teacher IS '匹配老师';
COMMENT ON COLUMN public.trial_lessons.confirmed_teacher IS '确认老师（教务）';
COMMENT ON COLUMN public.trial_lessons.class_link IS '上课链接';
