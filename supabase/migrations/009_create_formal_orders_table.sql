-- 创建正式订单表
CREATE TABLE IF NOT EXISTS public.formal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 关联字段
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,

    -- 订单基本信息
    order_number TEXT NOT NULL UNIQUE,
    order_type TEXT NOT NULL,
    consultant_teacher TEXT NOT NULL,
    order_notes TEXT,

    -- 课程安排
    teacher_names TEXT[] NOT NULL,
    subjects TEXT[] NOT NULL,
    total_sessions INTEGER NOT NULL,
    session_duration DECIMAL(10, 2) NOT NULL,
    fixed_mode TEXT NOT NULL,
    frequency TEXT NOT NULL,
    official_start_time TIMESTAMPTZ NOT NULL,
    first_class_time TIMESTAMPTZ NOT NULL,

    -- 费用信息
    total_hours DECIMAL(10, 2) NOT NULL,
    payment_channel TEXT NOT NULL,
    payment_amount DECIMAL(10, 2) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    payment_proof TEXT NOT NULL,
    payment_time TIMESTAMPTZ NOT NULL,

    -- 状态管理
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'suspended'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_formal_orders_student_id ON public.formal_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_formal_orders_order_number ON public.formal_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_formal_orders_teacher_names ON public.formal_orders USING GIN(teacher_names);
CREATE INDEX IF NOT EXISTS idx_formal_orders_subjects ON public.formal_orders USING GIN(subjects);
CREATE INDEX IF NOT EXISTS idx_formal_orders_status ON public.formal_orders(status);
CREATE INDEX IF NOT EXISTS idx_formal_orders_payment_time ON public.formal_orders(payment_time DESC);
CREATE INDEX IF NOT EXISTS idx_formal_orders_first_class_time ON public.formal_orders(first_class_time DESC);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_formal_orders_updated_at
    BEFORE UPDATE ON public.formal_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE public.formal_orders IS '正式订单表';
COMMENT ON COLUMN public.formal_orders.student_id IS '学生ID（外键）';
COMMENT ON COLUMN public.formal_orders.order_number IS '订单号（唯一）';
COMMENT ON COLUMN public.formal_orders.order_type IS '订单类型';
COMMENT ON COLUMN public.formal_orders.consultant_teacher IS '签约顾问/班主任';
COMMENT ON COLUMN public.formal_orders.order_notes IS '订单备注';
COMMENT ON COLUMN public.formal_orders.teacher_names IS '老师姓名数组';
COMMENT ON COLUMN public.formal_orders.subjects IS '学科数组';
COMMENT ON COLUMN public.formal_orders.total_sessions IS '总课时数';
COMMENT ON COLUMN public.formal_orders.session_duration IS '单课时长（小时）';
COMMENT ON COLUMN public.formal_orders.fixed_mode IS '固定模式';
COMMENT ON COLUMN public.formal_orders.frequency IS '频次';
COMMENT ON COLUMN public.formal_orders.official_start_time IS '正式上课时间';
COMMENT ON COLUMN public.formal_orders.first_class_time IS '首次课时间';
COMMENT ON COLUMN public.formal_orders.total_hours IS '总课时（小时）';
COMMENT ON COLUMN public.formal_orders.payment_channel IS '付款渠道';
COMMENT ON COLUMN public.formal_orders.payment_amount IS '付款金额';
COMMENT ON COLUMN public.formal_orders.hourly_rate IS '小时单价';
COMMENT ON COLUMN public.formal_orders.payment_proof IS '付款凭证URL';
COMMENT ON COLUMN public.formal_orders.payment_time IS '付费时间';
COMMENT ON COLUMN public.formal_orders.status IS '状态: active-进行中, completed-已完成, cancelled-已取消, suspended-已暂停';
