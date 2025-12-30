-- 修复 user_profiles 表的 RLS 策略
-- 问题：supabaseServer 客户端无法读取 user_profiles，导致 API 返回 adminCount: 0
-- 但实际上 admin 用户已存在（使用 service_role key 可以查询到）

-- 1. 首先检查现有的 RLS 策略
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'user_profiles';

  IF rls_enabled THEN
    RAISE NOTICE 'RLS 已启用在 user_profiles 表';
  ELSE
    RAISE NOTICE 'RLS 未启用，正在启用...';
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 2. 删除所有旧的 RLS 策略（如果有）
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;

-- 3. 创建新的 RLS 策略

-- 3.1 所有认证用户都可以查看所有 profiles（用于账号管理页面）
CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 3.2 超级管理员可以插入（创建）新用户
CREATE POLICY "Admins can insert profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 3.3 超级管理员可以更新用户档案
CREATE POLICY "Admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 3.4 超级管理员可以删除用户
CREATE POLICY "Admins can delete profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 4. 验证策略已创建
SELECT
  'RLS 策略已创建' as status,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
AND schemaname = 'public';

COMMENT ON POLICY "Authenticated users can view all profiles" ON user_profiles IS '允许所有登录用户查看用户档案列表（用于账号管理）';
COMMENT ON POLICY "Admins can insert profiles" ON user_profiles IS '仅允许超级管理员创建新用户档案';
COMMENT ON POLICY "Admins can update profiles" ON user_profiles IS '仅允许超级管理员更新用户档案';
COMMENT ON POLICY "Admins can delete profiles" ON user_profiles IS '仅允许超级管理员删除用户档案';
