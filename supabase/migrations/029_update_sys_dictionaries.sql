-- 更新系统字典：新增分类与项，并停用顾问/招聘人
DO $$
BEGIN
  -- 角色
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('role', 'operator', '运营', 1, true),
    ('role', 'sales', '销售', 2, true),
    ('role', 'head_teacher', '班主任', 3, true),
    ('role', 'teacher', '老师', 4, true),
    ('role', 'student', '学生', 5, true),
    ('role', 'academic_affairs', '教务', 6, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 课程类型
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('course_type', 'trial', '试听课', 1, true),
    ('course_type', 'formal', '正式课', 2, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 年级段（组）
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('grade_group', 'primary', '小学', 1, true),
    ('grade_group', 'junior', '初中', 2, true),
    ('grade_group', 'senior', '高中', 3, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 初试评价
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('interview_initial_eval', 'excellent', '优秀', 1, true),
    ('interview_initial_eval', 'good', '较好', 2, true),
    ('interview_initial_eval', 'average', '平庸', 3, true),
    ('interview_initial_eval', 'poor', '较差', 4, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 教研能力
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('research_ability', 'yes', '有', 1, true),
    ('research_ability', 'no', '无', 2, true),
    ('research_ability', 'unknown', '不确定', 3, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 服务意识
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('service_awareness', 'yes', '有', 1, true),
    ('service_awareness', 'no', '无', 2, true),
    ('service_awareness', 'unknown', '不确定', 3, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 老师级别（简化）
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('teacher_level_simple', 's1', 'S1', 1, true),
    ('teacher_level_simple', 's2', 'S2', 2, true),
    ('teacher_level_simple', 'a', 'A', 3, true),
    ('teacher_level_simple', 'b', 'B', 4, true),
    ('teacher_level_simple', 'c', 'C', 5, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 复核结果
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('review_result', 'pass', '通过', 1, true),
    ('review_result', 'fail', '不通过', 2, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 是否入库
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('hiring_status', 'in_store', '是', 1, true),
    ('hiring_status', 'reserve', '储备', 2, true),
    ('hiring_status', 'salary_issue', '薪资有问题', 3, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 学生类型（扩展）
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('student_type_ext', 'new_trial', '新生试听', 1, true),
    ('student_type_ext', 'referral', '转介绍', 2, true),
    ('student_type_ext', 'expand_subject', '老生扩科', 3, true),
    ('student_type_ext', 'change_teacher', '老师换老师', 4, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 课程状态（试听）
  INSERT INTO public.sys_dictionaries (category, code, label, sort_order, is_active) VALUES
    ('trial_course_status', 'confirmed', '已确认', 1, true),
    ('trial_course_status', 'intended_unconfirmed', '有意向未确认', 2, true),
    ('trial_course_status', 'cancelled', '取消试听', 3, true)
  ON CONFLICT (category, code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

  -- 停用顾问/招聘人字典
  UPDATE public.sys_dictionaries SET is_active = false WHERE category IN ('consultant', 'advisor', 'recruiter') AND is_active = true;
END $$;

