-- Add missing dictionary entries for teacher candidates recruitment

-- Teacher types for recruitment (more detailed than general teacher_type)
INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
('teacher_type_recruitment', 'institution_k12', '机构老师（k12）', 1, true),
('teacher_type_recruitment', 'institution_non_k12', '机构老师（非k12）', 2, true),
('teacher_type_recruitment', 'school_teacher', '学校老师', 3, true),
('teacher_type_recruitment', 'graduate_student', '研究生', 4, true),
('teacher_type_recruitment', 'college_student', '大学生', 5, true),
('teacher_type_recruitment', 'other', '其他', 6, true),

-- Interview initial evaluation levels
('interview_initial_eval', 'excellent', '优秀', 1, true),
('interview_initial_eval', 'good', '良好', 2, true),
('interview_initial_eval', 'average', '一般', 3, true),
('interview_initial_eval', 'poor', '较差', 4, true),

-- Evaluation levels for quality assessment
('evaluation_level', 'excellent', '强', 1, true),
('evaluation_level', 'good', '较强', 2, true),
('evaluation_level', 'average', '一般', 3, true),
('evaluation_level', 'weak', '较弱', 4, true),
('evaluation_level', 'not_evaluated', '未评', 5, true),

-- Research ability levels for teacher evaluation
('research_ability', 'excellent', '强', 1, true),
('research_ability', 'good', '较强', 2, true),
('research_ability', 'average', '一般', 3, true),
('research_ability', 'weak', '较弱', 4, true),
('research_ability', 'not_evaluated', '未评', 5, true),

-- Service awareness levels for teacher evaluation
('service_awareness', 'excellent', '强', 1, true),
('service_awareness', 'good', '较强', 2, true),
('service_awareness', 'average', '一般', 3, true),
('service_awareness', 'weak', '较弱', 4, true),
('service_awareness', 'not_evaluated', '未评', 5, true),

-- Affinity levels for teacher evaluation
('affinity_level', 'excellent', '强', 1, true),
('affinity_level', 'good', '较强', 2, true),
('affinity_level', 'average', '一般', 3, true),
('affinity_level', 'weak', '较弱', 4, true),
('affinity_level', 'not_evaluated', '未评', 5, true),

-- Review results for teacher candidate review
('review_result', 'pass', '通过', 1, true),
('review_result', 'fail', '不通过', 2, true)

ON CONFLICT (category, code) DO NOTHING;
