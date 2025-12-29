-- 创建 classroom_classin 表
-- 完全按照 ClassIn API 返回的原始字段结构

CREATE TABLE IF NOT EXISTS public.classroom_classin (
  class_id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ClassIn 原始字段
  name TEXT NOT NULL,                     -- 课堂名称
  class_status INTEGER,                   -- 课堂状态
  class_type INTEGER,                    -- 课堂类型
  start_time BIGINT,                      -- 开始时间 (Unix时间戳)
  end_time BIGINT,                        -- 结束时间 (Unix时间戳)
  seat_num INTEGER DEFAULT 0,             -- 座位数量
  teach_mode INTEGER,                     -- 教学模式
  screen_mode INTEGER DEFAULT 1,          -- 屏幕模式
  camera_hide INTEGER DEFAULT 0,          -- 是否隐藏摄像头
  is_auto_onstage INTEGER DEFAULT 2,      -- 是否自动上台
  is_dc INTEGER DEFAULT 0,               -- 是否DC
  is_hd INTEGER DEFAULT 0,                -- 是否HD
  lesson_key TEXT,                        -- 课程key
  live_host TEXT,                         -- 直播主机
  class_introduce TEXT,                   -- 课堂介绍

  -- 统计字段
  transfer_stu_num INTEGER DEFAULT 0,     -- 转出学生数
  out_stu_num INTEGER DEFAULT 0,          -- 离开学生数
  stu_num INTEGER DEFAULT 0,              -- 学生数
  audit_num INTEGER DEFAULT 0,            -- 听课人数
  goods_num INTEGER DEFAULT 0,            -- 商品数量

  -- 关联字段
  course_id BIGINT,                       -- 班级ID（关联 class_classin）
  school_uid BIGINT,                      -- 学校UID
  activity_id BIGINT,                     -- 活动ID
  omo_station_broadcast INTEGER DEFAULT 0, -- omoStationBroadcast
  co_type INTEGER DEFAULT 0,              -- coType
  co_main_id BIGINT DEFAULT 0,            -- coMainId
  created_at_timestamp BIGINT,            -- 创建时间 (Unix时间戳，对应 API: createdAt)
  biz_type INTEGER DEFAULT 1,             -- bizType
  publish_flag INTEGER DEFAULT 2,         -- publishFlag
  process_flag INTEGER DEFAULT 0,         -- processFlag
  biz_id BIGINT,                          -- bizId
  mute_all INTEGER DEFAULT 0,             -- muteAll
  forbid_assistant_operation INTEGER DEFAULT 0, -- forbidAssistantOperation

  -- 额外字段
  course_name TEXT,                       -- 班级名称（冗余，方便查询）

  -- JSONB 字段
  video_array JSONB,                      -- 视频数组信息
  teacher JSONB,                          -- 老师信息
  class_label JSONB,                      -- 班级标签
  assistant JSONB,                        -- 助教列表
  creator JSONB,                          -- 创建者信息
  cloud_folder JSONB,                     -- 云文件夹信息
  unit JSONB,                             -- 单元信息
  category JSONB,                         -- 分类信息

  -- 同步相关字段
  sync_time TIMESTAMPTZ,                  -- 最后同步时间
  notes TEXT                              -- 备注
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_classroom_classin_class_id ON public.classroom_classin(class_id);
CREATE INDEX IF NOT EXISTS idx_classroom_classin_course_id ON public.classroom_classin(course_id);
CREATE INDEX IF NOT EXISTS idx_classroom_classin_school_uid ON public.classroom_classin(school_uid);
CREATE INDEX IF NOT EXISTS idx_classroom_classin_class_status ON public.classroom_classin(class_status);
CREATE INDEX IF NOT EXISTS idx_classroom_classin_start_time ON public.classroom_classin(start_time);
CREATE INDEX IF NOT EXISTS idx_classroom_classin_name ON public.classroom_classin(name);

-- 更新时间触发器
DROP TRIGGER IF EXISTS update_classroom_classin_updated_at ON public.classroom_classin;
CREATE TRIGGER update_classroom_classin_updated_at
  BEFORE UPDATE ON public.classroom_classin
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE public.classroom_classin ENABLE ROW LEVEL SECURITY;

-- 策略：允许所有认证用户操作
CREATE POLICY "Authenticated users can view classroom_classin"
  ON public.classroom_classin FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert classroom_classin"
  ON public.classroom_classin FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update classroom_classin"
  ON public.classroom_classin FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete classroom_classin"
  ON public.classroom_classin FOR DELETE
  TO authenticated
  USING (true);

-- 添加注释
COMMENT ON TABLE public.classroom_classin IS 'ClassIn 课堂原始数据表，使用 ClassIn classId 作为主键';
COMMENT ON COLUMN public.classroom_classin.class_id IS 'ClassIn 课堂ID（主键，对应 API: classId）';
COMMENT ON COLUMN public.classroom_classin.name IS '课堂名称';
COMMENT ON COLUMN public.classroom_classin.class_status IS '课堂状态（对应 API: classStatus）';
COMMENT ON COLUMN public.classroom_classin.class_type IS '课堂类型（对应 API: classType）';
COMMENT ON COLUMN public.classroom_classin.start_time IS '开始时间 Unix时间戳（对应 API: startTime）';
COMMENT ON COLUMN public.classroom_classin.end_time IS '结束时间 Unix时间戳（对应 API: endTime）';
COMMENT ON COLUMN public.classroom_classin.seat_num IS '座位数量（对应 API: seatNum）';
COMMENT ON COLUMN public.classroom_classin.teach_mode IS '教学模式（对应 API: teachMode）';
COMMENT ON COLUMN public.classroom_classin.lesson_key IS '课程key（对应 API: lessonKey）';
COMMENT ON COLUMN public.classroom_classin.live_host IS '直播主机（对应 API: liveHost）';
COMMENT ON COLUMN public.classroom_classin.stu_num IS '学生数（对应 API: stuNum）';
COMMENT ON COLUMN public.classroom_classin.audit_num IS '听课人数（对应 API: auditNum）';
COMMENT ON COLUMN public.classroom_classin.course_id IS '班级ID（关联 class_classin，对应 API: courseId）';
COMMENT ON COLUMN public.classroom_classin.school_uid IS '学校UID（对应 API: schoolUid）';
COMMENT ON COLUMN public.classroom_classin.course_name IS '班级名称（冗余字段，对应 API: courseName）';
COMMENT ON COLUMN public.classroom_classin.video_array IS '视频数组信息 (JSONB，对应 API: videoArray)';
COMMENT ON COLUMN public.classroom_classin.teacher IS '老师信息 (JSONB，对应 API: teacher)';
COMMENT ON COLUMN public.classroom_classin.assistant IS '助教列表 (JSONB，对应 API: assistant)';
COMMENT ON COLUMN public.classroom_classin.creator IS '创建者信息 (JSONB，对应 API: creator)';
COMMENT ON COLUMN public.classroom_classin.sync_time IS '最后同步时间';
