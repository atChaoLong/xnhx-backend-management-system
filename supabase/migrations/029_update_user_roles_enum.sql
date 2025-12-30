-- 更新 user_profiles 表的 role 字段枚举类型
-- 支持的角色：admin, operator, sales, head_teacher, teacher, academic_affairs, finance, hr

-- 1. 先将现有的 role 字段改为普通 TEXT（如果已经是枚举）
DO $$
BEGIN
  -- 检查当前 role 列的类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'role'
      AND data_type = 'USER-DEFINED'
  ) THEN
    -- 如果是枚举类型，先转换为 TEXT
    ALTER TABLE user_profiles ALTER COLUMN role TYPE TEXT USING role::text;
    RAISE NOTICE 'role 列已从枚举转换为 TEXT';
  ELSE
    RAISE NOTICE 'role 列不是枚举类型，无需转换';
  END IF;
END $$;

-- 2. 删除旧的约束（如果存在）
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS check_role;

-- 3. 添加新的约束确保只允许有效的角色值
ALTER TABLE user_profiles
  ADD CONSTRAINT check_role
  CHECK (role IN ('admin', 'operator', 'sales', 'head_teacher', 'teacher', 'academic_affairs', 'finance', 'hr'));

-- 4. 添加注释
COMMENT ON COLUMN user_profiles.role IS '用户角色：admin(超级管理员), operator(运营), sales(销售), head_teacher(班主任), teacher(教师), academic_affairs(教务), finance(财务), hr(人事)';

-- 5. 验证约束
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass
  AND conname = 'check_role';
