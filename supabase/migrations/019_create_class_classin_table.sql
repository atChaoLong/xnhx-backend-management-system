-- 创建 class_classin 表
-- 完全按照 ClassIn API 返回的原始字段结构

CREATE TABLE IF NOT EXISTS public.class_classin (
  course_id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 原始字段
  course_name TEXT NOT NULL,                -- 班级名称
  school_uid BIGINT,                        -- 学校编号
  web_cast TEXT,                            -- webcast链接
  live_host TEXT,                           -- 直播主机
  course_type INTEGER,                      -- 课程类型
  cover_img TEXT,                           -- 封面图片
  creater_name TEXT,                        -- 创建者名称
  add_time BIGINT,                          -- 添加时间 (Unix时间戳)
  creator_uid BIGINT,                       -- 创建者UID
  end_uid BIGINT DEFAULT 0,                 -- 结束UID
  end_name TEXT DEFAULT '',                 -- 结束名称
  end_time BIGINT DEFAULT 0,                -- 结束时间
  subject_id BIGINT DEFAULT 0,              -- 科目ID
  course_state INTEGER,                     -- 课程状态 (1=进行中)
  first_class_begin_time BIGINT,            -- 第一次上课时间
  teacher_num INTEGER DEFAULT 0,            -- 老师数量
  student_num INTEGER DEFAULT 0,            -- 学生数量
  audit_num INTEGER DEFAULT 0,              -- 听课人数
  expiry_time BIGINT DEFAULT 0,             -- 过期时间
  cloud_folder INTEGER DEFAULT 0,           -- 云文件夹
  skin_id BIGINT DEFAULT 0,                 -- 皮肤ID

  -- 统计字段
  complete_class_num INTEGER DEFAULT 0,     -- 完成的课节数
  total_class_num INTEGER DEFAULT 0,        -- 总课节数
  record_num INTEGER DEFAULT 0,             -- 录播数量
  live_num INTEGER DEFAULT 0,               -- 直播数量
  open_num INTEGER DEFAULT 0,               -- 公开课数量
  homework_num INTEGER DEFAULT 0,           -- 作业数量
  exam_num INTEGER DEFAULT 0,               -- 考试数量

  -- JSONB 字段
  head_img JSONB,                           -- 头图信息
  course_img JSONB,                         -- 课程图片
  setting JSONB,                            -- 设置信息
  main_user_info JSONB,                     -- 主用户信息
  teachers JSONB,                           -- 老师列表
  labels JSONB,                             -- 标签
  cat_info JSONB,                           -- 分类信息
  cloud_folder_info JSONB,                  -- 云文件夹信息
  skin_info JSONB,                          -- 皮肤信息

  -- 同步相关字段
  sync_time TIMESTAMPTZ,                    -- 最后同步时间
  notes TEXT                                -- 备注
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_class_classin_school_uid ON public.class_classin(school_uid);
CREATE INDEX IF NOT EXISTS idx_class_classin_course_state ON public.class_classin(course_state);
CREATE INDEX IF NOT EXISTS idx_class_classin_course_type ON public.class_classin(course_type);
CREATE INDEX IF NOT EXISTS idx_class_classin_creator_uid ON public.class_classin(creator_uid);
CREATE INDEX IF NOT EXISTS idx_class_classin_add_time ON public.class_classin(add_time);
CREATE INDEX IF NOT EXISTS idx_class_classin_course_name ON public.class_classin(course_name);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_class_classin_updated_at ON public.class_classin;
CREATE TRIGGER update_class_classin_updated_at
  BEFORE UPDATE ON public.class_classin
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.class_classin ENABLE ROW LEVEL SECURITY;

-- 策略：允许所有认证用户操作
CREATE POLICY "Authenticated users can view class_classin"
  ON public.class_classin FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert class_classin"
  ON public.class_classin FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update class_classin"
  ON public.class_classin FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete class_classin"
  ON public.class_classin FOR DELETE
  TO authenticated
  USING (true);

-- 添加注释
COMMENT ON TABLE public.class_classin IS 'ClassIn 班级原始数据表，使用 ClassIn courseId 作为主键';
COMMENT ON COLUMN public.class_classin.course_id IS 'ClassIn 班级ID（主键，对应 API: courseId）';
COMMENT ON COLUMN public.class_classin.course_name IS '班级名称（对应 API: courseName）';
COMMENT ON COLUMN public.class_classin.school_uid IS '学校编号（对应 API: schoolUid）';
COMMENT ON COLUMN public.class_classin.web_cast IS 'webcast链接（对应 API: webCast）';
COMMENT ON COLUMN public.class_classin.live_host IS '直播主机（对应 API: liveHost）';
COMMENT ON COLUMN public.class_classin.course_type IS '课程类型（对应 API: courseType）';
COMMENT ON COLUMN public.class_classin.cover_img IS '封面图片（对应 API: coverImg）';
COMMENT ON COLUMN public.class_classin.creater_name IS '创建者名称（对应 API: createrName）';
COMMENT ON COLUMN public.class_classin.add_time IS '添加时间 Unix时间戳（对应 API: addTime）';
COMMENT ON COLUMN public.class_classin.creator_uid IS '创建者UID（对应 API: creatorUid）';
COMMENT ON COLUMN public.class_classin.end_uid IS '结束UID（对应 API: endUid）';
COMMENT ON COLUMN public.class_classin.end_name IS '结束名称（对应 API: endName）';
COMMENT ON COLUMN public.class_classin.end_time IS '结束时间（对应 API: endTime）';
COMMENT ON COLUMN public.class_classin.subject_id IS '科目ID（对应 API: subjectId）';
COMMENT ON COLUMN public.class_classin.course_state IS '课程状态（对应 API: courseState）';
COMMENT ON COLUMN public.class_classin.first_class_begin_time IS '第一次上课时间（对应 API: firstClassBeginTime）';
COMMENT ON COLUMN public.class_classin.teacher_num IS '老师数量（对应 API: teacherNum）';
COMMENT ON COLUMN public.class_classin.student_num IS '学生数量（对应 API: studentNum）';
COMMENT ON COLUMN public.class_classin.audit_num IS '听课人数（对应 API: auditNum）';
COMMENT ON COLUMN public.class_classin.expiry_time IS '过期时间（对应 API: expiryTime）';
COMMENT ON COLUMN public.class_classin.cloud_folder IS '云文件夹（对应 API: cloudFolder）';
COMMENT ON COLUMN public.class_classin.skin_id IS '皮肤ID（对应 API: skinId）';
COMMENT ON COLUMN public.class_classin.complete_class_num IS '完成的课节数（对应 API: completeClassNum）';
COMMENT ON COLUMN public.class_classin.total_class_num IS '总课节数（对应 API: totalClassNum）';
COMMENT ON COLUMN public.class_classin.record_num IS '录播数量（对应 API: recordNum）';
COMMENT ON COLUMN public.class_classin.live_num IS '直播数量（对应 API: liveNum）';
COMMENT ON COLUMN public.class_classin.open_num IS '公开课数量（对应 API: openNum）';
COMMENT ON COLUMN public.class_classin.homework_num IS '作业数量（对应 API: homeworkNum）';
COMMENT ON COLUMN public.class_classin.exam_num IS '考试数量（对应 API: examNum）';
COMMENT ON COLUMN public.class_classin.head_img IS '头图信息 (JSONB，对应 API: headImg)';
COMMENT ON COLUMN public.class_classin.course_img IS '课程图片 (JSONB，对应 API: courseImg)';
COMMENT ON COLUMN public.class_classin.setting IS '设置信息 (JSONB，对应 API: setting)';
COMMENT ON COLUMN public.class_classin.main_user_info IS '主用户信息 (JSONB，对应 API: mainUserInfo)';
COMMENT ON COLUMN public.class_classin.teachers IS '老师列表 (JSONB，对应 API: teachers)';
COMMENT ON COLUMN public.class_classin.labels IS '标签 (JSONB，对应 API: labels)';
COMMENT ON COLUMN public.class_classin.cat_info IS '分类信息 (JSONB，对应 API: catInfo)';
COMMENT ON COLUMN public.class_classin.cloud_folder_info IS '云文件夹信息 (JSONB，对应 API: cloudFolderInfo)';
COMMENT ON COLUMN public.class_classin.skin_info IS '皮肤信息 (JSONB，对应 API: skinInfo)';
COMMENT ON COLUMN public.class_classin.sync_time IS '最后同步时间';
