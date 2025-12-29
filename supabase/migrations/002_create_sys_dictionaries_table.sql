-- 创建系统字典表
CREATE TABLE IF NOT EXISTS public.sys_dictionaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 字段定义
    category TEXT NOT NULL,               -- 字典分类
    code TEXT NOT NULL,                   -- 字典项代码
    label TEXT NOT NULL,                  -- 字典项标签
    sort_order INTEGER DEFAULT 0,          -- 排序顺序
    is_active BOOLEAN DEFAULT true         -- 是否启用
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
DROP TRIGGER IF EXISTS update_sys_dictionaries_updated_at ON public.sys_dictionaries;
CREATE TRIGGER update_sys_dictionaries_updated_at
    BEFORE UPDATE ON public.sys_dictionaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_sys_dictionaries_category ON public.sys_dictionaries(category);
CREATE INDEX IF NOT EXISTS idx_sys_dictionaries_is_active ON public.sys_dictionaries(is_active);
CREATE INDEX IF NOT EXISTS idx_sys_dictionaries_category_active ON public.sys_dictionaries(category, is_active);

-- 添加唯一约束（同一分类下代码唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_dictionaries_category_code
    ON public.sys_dictionaries(category, code)
    WHERE is_active = true;

-- 启用 RLS (Row Level Security)
ALTER TABLE public.sys_dictionaries ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Authenticated users can view dictionaries" ON public.sys_dictionaries;
DROP POLICY IF EXISTS "Authenticated users can insert dictionaries" ON public.sys_dictionaries;
DROP POLICY IF EXISTS "Authenticated users can update dictionaries" ON public.sys_dictionaries;
DROP POLICY IF EXISTS "Authenticated users can delete dictionaries" ON public.sys_dictionaries;

-- 创建策略：允许所有认证用户读取
CREATE POLICY "Authenticated users can view dictionaries" ON public.sys_dictionaries
    FOR SELECT USING (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户插入
CREATE POLICY "Authenticated users can insert dictionaries" ON public.sys_dictionaries
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户更新
CREATE POLICY "Authenticated users can update dictionaries" ON public.sys_dictionaries
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 创建策略：允许所有认证用户删除
CREATE POLICY "Authenticated users can delete dictionaries" ON public.sys_dictionaries
    FOR DELETE USING (auth.role() = 'authenticated');

-- 插入默认字典数据
INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
-- 学科
('subject', 'chinese', '语文', 1, true),
('subject', 'math', '数学', 2, true),
('subject', 'english', '英语', 3, true),
('subject', 'physics', '物理', 4, true),
('subject', 'chemistry', '化学', 5, true),
('subject', 'biology', '生物', 6, true),
('subject', 'history', '历史', 7, true),
('subject', 'geography', '地理', 8, true),
('subject', 'politics', '政治', 9, true),

-- 年级
('grade', 'primary_1', '小学一年级', 1, true),
('grade', 'primary_2', '小学二年级', 2, true),
('grade', 'primary_3', '小学三年级', 3, true),
('grade', 'primary_4', '小学四年级', 4, true),
('grade', 'primary_5', '小学五年级', 5, true),
('grade', 'primary_6', '小学六年级', 6, true),
('grade', 'junior_1', '初中一年级', 7, true),
('grade', 'junior_2', '初中二年级', 8, true),
('grade', 'junior_3', '初中三年级', 9, true),
('grade', 'senior_1', '高中一年级', 10, true),
('grade', 'senior_2', '高中二年级', 11, true),
('grade', 'senior_3', '高中三年级', 12, true),

-- 添加方式
('add_method', 'active', '主动添加', 1, true),
('add_method', 'passive', '被动添加', 2, true),
('add_method', 'referral', '转介绍', 3, true),

-- 小红书账号来源
('xhs_source', 'official', '小红书官方账号', 1, true),
('xhs_source', 'individual_1', '个人账号1', 2, true),
('xhs_source', 'individual_2', '个人账号2', 3, true),

-- 省份
('province', 'beijing', '北京市', 1, true),
('province', 'shanghai', '上海市', 2, true),
('province', 'tianjin', '天津市', 3, true),
('province', 'chongqing', '重庆市', 4, true),
('province', 'guangdong', '广东省', 5, true),
('province', 'jiangsu', '江苏省', 6, true),
('province', 'zhejiang', '浙江省', 7, true),
('province', 'shandong', '山东省', 8, true),
('province', 'henan', '河南省', 9, true),
('province', 'sichuan', '四川省', 10, true),
('province', 'hubei', '湖北省', 11, true),
('province', 'hunan', '湖南省', 12, true),
('province', 'hebei', '河北省', 13, true),
('province', 'fujian', '福建省', 14, true),
('province', 'shanxi', '山西省', 15, true),
('province', 'shaanxi', '陕西省', 16, true),
('province', 'anhui', '安徽省', 17, true),
('province', 'jiangxi', '江西省', 18, true),
('province', 'liaoning', '辽宁省', 19, true),
('province', 'other', '其他', 99, true),

-- 教材版本
('textbook_version', 'renjiao', '人教版', 1, true),
('textbook_version', 'su', '苏教版', 2, true),
('textbook_version', 'beijing', '北师大版', 3, true),
('textbook_version', 'hua', '华师大版', 4, true),
('textbook_version', 'shanghai', '沪教版', 5, true),
('textbook_version', 'other', '其他版本', 99, true),

-- 订单类型
('order_type', 'trial', '试听订单', 1, true),
('order_type', 'formal', '正式订单', 2, true),
('order_type', 'renewal', '续费订单', 3, true),

-- 付款渠道
('payment_channel', 'wechat', '微信支付', 1, true),
('payment_channel', 'alipay', '支付宝', 2, true),
('payment_channel', 'bank', '银行转账', 3, true),
('payment_channel', 'cash', '现金', 4, true),

-- 付款类型
('payment_type', 'full', '全款', 1, true),
('payment_type', 'deposit', '定金', 2, true),
('payment_type', 'installment', '分期', 3, true),

-- 顾问
('consultant', 'c1', '顾问A', 1, true),
('consultant', 'c2', '顾问B', 2, true),
('consultant', 'c3', '顾问C', 3, true),

-- 顾问（同consultant，用于不同场景）
('advisor', 'a1', '顾问A', 1, true),
('advisor', 'a2', '顾问B', 2, true),
('advisor', 'a3', '顾问C', 3, true),

-- 课时长
('class_duration', '30', '30分钟', 1, true),
('class_duration', '45', '45分钟', 2, true),
('class_duration', '60', '60分钟', 3, true),
('class_duration', '90', '90分钟', 4, true),
('class_duration', '120', '120分钟', 5, true),

-- 固定模式
('fixed_mode', 'fixed', '固定时间', 1, true),
('fixed_mode', 'flexible', '灵活时间', 2, true),

-- 频次
('class_frequency', 'weekly_1', '每周1次', 1, true),
('class_frequency', 'weekly_2', '每周2次', 2, true),
('class_frequency', 'weekly_3', '每周3次', 3, true),
('class_frequency', 'monthly_4', '每月4次', 4, true),
('class_frequency', 'other', '其他', 99, true),

-- 教师特点
('teacher_feature', 'patient', '耐心', 1, true),
('teacher_feature', 'strict', '严格', 2, true),
('teacher_feature', 'humorous', '幽默', 3, true),
('teacher_feature', 'experienced', '经验丰富', 4, true),
('teacher_feature', 'young', '年轻活力', 5, true),

-- 排课模式
('scheduling_mode', 'auto', '系统排课', 1, true),
('scheduling_mode', 'manual', '手动排课', 2, true),

-- 空闲时间
('free_time', 'weekday_morning', '工作日早上', 1, true),
('free_time', 'weekday_afternoon', '工作日下午', 2, true),
('free_time', 'weekday_evening', '工作日晚上', 3, true),
('free_time', 'weekend_morning', '周末早上', 4, true),
('free_time', 'weekend_afternoon', '周末下午', 5, true),
('free_time', 'weekend_evening', '周末晚上', 6, true),

-- 教师类型
('teacher_type', 'full_time', '全职教师', 1, true),
('teacher_type', 'part_time', '兼职教师', 2, true),
('teacher_type', 'college', '大学生教师', 3, true),

-- 学生类型
('student_type', 'primary', '小学生', 1, true),
('student_type', 'junior', '初中生', 2, true),
('student_type', 'senior', '高中生', 3, true),

-- 教师等级
('teacher_level', 'junior', '初级教师', 1, true),
('teacher_level', 'intermediate', '中级教师', 2, true),
('teacher_level', 'senior', '高级教师', 3, true),
('teacher_level', 'expert', '专家教师', 4, true),

-- 普通话等级
('mandarin_level', 'level_1a', '一级甲等', 1, true),
('mandarin_level', 'level_1b', '一级乙等', 2, true),
('mandarin_level', 'level_2a', '二级甲等', 3, true),
('mandarin_level', 'level_2b', '二级乙等', 4, true),

-- 访问类型
('visit_type', 'first', '首次访问', 1, true),
('visit_type', 'return', '再次访问', 2, true),
('visit_type', 'consult', '咨询访问', 3, true),

-- 招聘人
('recruiter', 'hr1', '招聘专员A', 1, true),
('recruiter', 'hr2', '招聘专员B', 2, true),
('recruiter', 'hr3', '招聘专员C', 3, true)

ON CONFLICT (category, code) DO NOTHING;
