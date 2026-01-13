-- 添加 student_id 冗余字段到 courses 表
ALTER TABLE courses ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_courses_student_id ON courses(student_id);

-- 添加注释
COMMENT ON COLUMN courses.student_id IS '学生ID';

-- 为现有记录填充 student_id（从 orders 关联）
UPDATE courses
SET student_id = (
  SELECT student_id
  FROM formal_orders
  WHERE formal_orders.id = courses.order_id
)
WHERE student_id IS NULL;
