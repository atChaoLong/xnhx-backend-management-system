-- 线索列表查询优化索引
-- 在 Supabase Dashboard > SQL Editor 中执行

-- 1. leads 表：按 created_at 排序（列表分页最常用）
CREATE INDEX IF NOT EXISTS idx_leads_created_at_desc ON leads (created_at DESC);

-- 2. leads 表：sales 角色按 grab_user_id 筛选
CREATE INDEX IF NOT EXISTS idx_leads_grab_user_id ON leads (grab_user_id);

-- 3. leads 表：operator 角色按 operator_id 筛选
CREATE INDEX IF NOT EXISTS idx_leads_operator_id ON leads (operator_id);

-- 4. leads 表：public scope 按 grab_user_id + grab_wechat 筛选
CREATE INDEX IF NOT EXISTS idx_leads_grab_user_id_null ON leads (grab_user_id) WHERE grab_user_id IS NULL;

-- 5. trial_lessons 表：按 lead_id 关联查询
CREATE INDEX IF NOT EXISTS idx_trial_lessons_lead_id ON trial_lessons (lead_id);

-- 6. formal_orders 表：按 lead_id 关联查询
CREATE INDEX IF NOT EXISTS idx_formal_orders_lead_id ON formal_orders (lead_id);

-- 7. formal_orders 表：按 student_id 关联查询（班主任查询用）
CREATE INDEX IF NOT EXISTS idx_formal_orders_student_id ON formal_orders (student_id);

-- 8. students 表：按 head_teacher_id 关联查询
CREATE INDEX IF NOT EXISTS idx_students_head_teacher_id ON students (head_teacher_id);

-- 9. user_profiles 表：按 id 查询 name（operator map）
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles (id);
