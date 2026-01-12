-- 添加回访相关字典

-- 回访方式
INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
('visit_method', 'wechat', '微信沟通', 1, true),
('visit_method', 'phone', '电话沟通', 2, true),
('visit_method', 'offline', '线下沟通', 3, true),
('visit_method', 'video', '视频沟通', 4, true)
ON CONFLICT (category, code) DO NOTHING;

-- 家长态度
INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
('parent_attitude', 'very_satisfied', '较好', 1, true),
('parent_attitude', 'satisfied', '满意', 2, true),
('parent_attitude', 'neutral', '略不满意', 3, true),
('parent_attitude', 'dissatisfied', '不满意', 4, true)
ON CONFLICT (category, code) DO NOTHING;

-- 添加注释
COMMENT ON TABLE public.sys_dictionaries IS '系统字典表';
