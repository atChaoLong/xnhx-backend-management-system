-- ============================================
-- 为 courses 和 class_sessions 表添加 RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- courses 表的 RLS 策略
-- ============================================

-- 策略1：所有认证用户可以查看课程（用于学生详情等）
CREATE POLICY "所有认证用户可查看课程"
ON courses FOR SELECT
TO authenticated
USING (true);

-- 策略2：所有认证用户可以插入课程
CREATE POLICY "所有认证用户可创建课程"
ON courses FOR INSERT
TO authenticated
WITH CHECK (true);

-- 策略3：所有认证用户可以更新课程
CREATE POLICY "所有认证用户可更新课程"
ON courses FOR UPDATE
TO authenticated
USING (true);

-- 策略4：所有认证用户可以删除课程
CREATE POLICY "所有认证用户可删除课程"
ON courses FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- class_sessions 表的 RLS 策略
-- ============================================

-- 策略1：所有认证用户可以查看课时
CREATE POLICY "所有认证用户可查看课时"
ON class_sessions FOR SELECT
TO authenticated
USING (true);

-- 策略2：所有认证用户可以插入课时
CREATE POLICY "所有认证用户可创建课时"
ON class_sessions FOR INSERT
TO authenticated
WITH CHECK (true);

-- 策略3：所有认证用户可以更新课时
CREATE POLICY "所有认证用户可更新课时"
ON class_sessions FOR UPDATE
TO authenticated
USING (true);

-- 策略4：所有认证用户可以删除课时
CREATE POLICY "所有认证用户可删除课时"
ON class_sessions FOR DELETE
TO authenticated
USING (true);

-- 添加注释
COMMENT ON POLICY "所有认证用户可查看课程" ON courses IS '允许所有认证用户查看课程记录';
COMMENT ON POLICY "所有认证用户可创建课程" ON courses IS '允许所有认证用户创建课程记录';
COMMENT ON POLICY "所有认证用户可查看课时" ON class_sessions IS '允许所有认证用户查看课时记录';
