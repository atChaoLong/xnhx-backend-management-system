-- 创建异动表（退费相关）
CREATE TABLE IF NOT EXISTS public.transaction_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    creation_date DATE NOT NULL,
    course_name TEXT,
    student_name TEXT NOT NULL,
    teacher_name TEXT,
    schedule_consumption DECIMAL(10, 2),
    order_type TEXT,
    original_consultant TEXT,
    class_teacher TEXT,
    refund_reason TEXT,
    transaction_type TEXT NOT NULL,
    remaining_duration DECIMAL(10, 2),
    refund_amount DECIMAL(10, 2),
    bank_card_name TEXT,
    bank_card_number TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    unit_price DECIMAL(10, 2)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_transaction_records_creation_date ON public.transaction_records(creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_records_student_name ON public.transaction_records(student_name);
CREATE INDEX IF NOT EXISTS idx_transaction_records_teacher_name ON public.transaction_records(teacher_name);
CREATE INDEX IF NOT EXISTS idx_transaction_records_transaction_type ON public.transaction_records(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transaction_records_status ON public.transaction_records(status);
CREATE INDEX IF NOT EXISTS idx_transaction_records_order_type ON public.transaction_records(order_type);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_transaction_records_updated_at ON public.transaction_records;
CREATE TRIGGER update_transaction_records_updated_at
    BEFORE UPDATE ON public.transaction_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE public.transaction_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transaction records"
    ON public.transaction_records FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert transaction records"
    ON public.transaction_records FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update transaction records"
    ON public.transaction_records FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transaction records"
    ON public.transaction_records FOR DELETE
    TO authenticated
    USING (true);

-- 添加注释
COMMENT ON TABLE public.transaction_records IS '退费异动表';
COMMENT ON COLUMN public.transaction_records.creation_date IS '创建日期';
COMMENT ON COLUMN public.transaction_records.course_name IS '课程名称';
COMMENT ON COLUMN public.transaction_records.student_name IS '学生姓名';
COMMENT ON COLUMN public.transaction_records.teacher_name IS '老师姓名';
COMMENT ON COLUMN public.transaction_records.schedule_consumption IS '课时消耗';
COMMENT ON COLUMN public.transaction_records.order_type IS '订单类型';
COMMENT ON COLUMN public.transaction_records.original_consultant IS '原顾问';
COMMENT ON COLUMN public.transaction_records.class_teacher IS '班主任';
COMMENT ON COLUMN public.transaction_records.refund_reason IS '退费原因';
COMMENT ON COLUMN public.transaction_records.transaction_type IS '异动类型';
COMMENT ON COLUMN public.transaction_records.remaining_duration IS '剩余课时';
COMMENT ON COLUMN public.transaction_records.refund_amount IS '退费金额';
COMMENT ON COLUMN public.transaction_records.bank_card_name IS '银行卡户名';
COMMENT ON COLUMN public.transaction_records.bank_card_number IS '银行卡号';
COMMENT ON COLUMN public.transaction_records.bank_name IS '开户银行';
COMMENT ON COLUMN public.transaction_records.bank_branch IS '开户支行';
COMMENT ON COLUMN public.transaction_records.status IS '状态: pending-待处理, processing-处理中, completed-已完成, rejected-已拒绝';
COMMENT ON COLUMN public.transaction_records.unit_price IS '单价';
