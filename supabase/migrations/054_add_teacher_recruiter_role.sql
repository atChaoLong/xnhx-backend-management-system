-- 支持独立招师角色 teacher_recruiter
-- 说明：
-- - teacher_recruiter: 招师，负责老师招聘、约面、初试、录像上传、谈薪入库推进
-- - hr: 人事，保留传统人力角色，不再承载招师流程

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS check_role;

ALTER TABLE user_profiles
  ADD CONSTRAINT check_role
  CHECK (
    role IN (
      'admin',
      'operator',
      'sales',
      'head_teacher',
      'teacher',
      'academic_affairs',
      'finance',
      'teacher_recruiter',
      'hr'
    )
  );

COMMENT ON COLUMN user_profiles.role IS '用户角色：admin(超级管理员), operator(运营), sales(销售), head_teacher(班主任), teacher(教师), academic_affairs(教务), finance(财务), teacher_recruiter(招师), hr(人事)';
