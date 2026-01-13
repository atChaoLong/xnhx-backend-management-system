-- 添加回 activity_id 字段（删除课堂时必需）
-- 之前误删了，现在添加回来

ALTER TABLE classroom_classin ADD COLUMN IF NOT EXISTS activity_id BIGINT;

-- 添加注释
COMMENT ON COLUMN classroom_classin.activity_id IS 'ClassIn 活动ID（用于删除课堂）';

-- 创建索引（可选，用于快速查询）
CREATE INDEX IF NOT EXISTS idx_classroom_classin_activity_id ON classroom_classin(activity_id);
