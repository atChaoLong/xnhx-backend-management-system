-- ============================================
-- 清理 class_classin 和 classroom_classin 表的未使用字段
-- ============================================

-- ============================================
-- 清理 class_classin 表
-- ============================================

-- 删除未使用的列（从示例数据中看都是空的）
ALTER TABLE class_classin DROP COLUMN IF EXISTS school_uid;
ALTER TABLE class_classin DROP COLUMN IF EXISTS web_cast;
ALTER TABLE class_classin DROP COLUMN IF EXISTS live_host;
ALTER TABLE class_classin DROP COLUMN IF EXISTS course_type;
ALTER TABLE class_classin DROP COLUMN IF EXISTS cover_img;
ALTER TABLE class_classin DROP COLUMN IF EXISTS end_uid;
ALTER TABLE class_classin DROP COLUMN IF EXISTS end_name;
ALTER TABLE class_classin DROP COLUMN IF EXISTS end_time;
ALTER TABLE class_classin DROP COLUMN IF EXISTS teacher_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS student_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS audit_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS expiry_time;
ALTER TABLE class_classin DROP COLUMN IF EXISTS cloud_folder;
ALTER TABLE class_classin DROP COLUMN IF EXISTS skin_id;
ALTER TABLE class_classin DROP COLUMN IF EXISTS complete_class_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS total_class_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS record_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS live_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS open_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS homework_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS exam_num;
ALTER TABLE class_classin DROP COLUMN IF EXISTS head_img;
ALTER TABLE class_classin DROP COLUMN IF EXISTS course_img;
ALTER TABLE class_classin DROP COLUMN IF EXISTS setting;
ALTER TABLE class_classin DROP COLUMN IF EXISTS main_user_info;
ALTER TABLE class_classin DROP COLUMN IF EXISTS teachers;
ALTER TABLE class_classin DROP COLUMN IF EXISTS labels;
ALTER TABLE class_classin DROP COLUMN IF EXISTS cat_info;
ALTER TABLE class_classin DROP COLUMN IF EXISTS cloud_folder_info;
ALTER TABLE class_classin DROP COLUMN IF EXISTS skin_info;

-- 添加注释说明保留的字段
COMMENT ON TABLE class_classin IS 'ClassIn 课程表（简化版）';
COMMENT ON COLUMN class_classin.course_id IS 'ClassIn 课程ID';
COMMENT ON COLUMN class_classin.course_name IS '课程名称';
COMMENT ON COLUMN class_classin.creater_name IS '创建者名称';
COMMENT ON COLUMN class_classin.add_time IS '添加时间（Unix时间戳）';
COMMENT ON COLUMN class_classin.creator_uid IS '创建者UID';
COMMENT ON COLUMN class_classin.subject_id IS '科目ID';
COMMENT ON COLUMN class_classin.course_state IS '课程状态';
COMMENT ON COLUMN class_classin.first_class_begin_time IS '第一次上课时间（Unix时间戳）';
COMMENT ON COLUMN class_classin.sync_time IS '最后同步时间';
COMMENT ON COLUMN class_classin.notes IS '备注';

-- ============================================
-- 清理 classroom_classin 表
-- ============================================

-- 删除未使用的列（从示例数据中看都是空的）
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS class_status;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS class_type;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS seat_num;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS screen_mode;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS camera_hide;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS is_dc;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS is_hd;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS lesson_key;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS live_host;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS class_introduce;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS transfer_stu_num;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS out_stu_num;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS stu_num;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS audit_num;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS goods_num;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS school_uid;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS activity_id;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS co_type;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS co_main_id;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS publish_flag;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS biz_id;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS mute_all;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS forbid_assistant_operation;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS video_array;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS teacher;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS class_label;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS assistant;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS creator;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS cloud_folder;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS unit;
ALTER TABLE classroom_classin DROP COLUMN IF EXISTS category;

-- 添加注释说明保留的字段
COMMENT ON TABLE classroom_classin IS 'ClassIn 课堂表（简化版）';
COMMENT ON COLUMN classroom_classin.class_id IS 'ClassIn 课堂ID';
COMMENT ON COLUMN classroom_classin.name IS '课堂名称';
COMMENT ON COLUMN classroom_classin.start_time IS '开始时间（Unix时间戳）';
COMMENT ON COLUMN classroom_classin.end_time IS '结束时间（Unix时间戳）';
COMMENT ON COLUMN classroom_classin.teach_mode IS '教学模式';
COMMENT ON COLUMN classroom_classin.is_auto_onstage IS '是否自动上台';
COMMENT ON COLUMN classroom_classin.course_id IS '关联的课程ID（class_classin.course_id）';
COMMENT ON COLUMN classroom_classin.created_at_timestamp IS '创建时间（Unix时间戳）';
COMMENT ON COLUMN classroom_classin.biz_type IS '业务类型';
COMMENT ON COLUMN classroom_classin.process_flag IS '处理标志';
COMMENT ON COLUMN classroom_classin.course_name IS '课程名称（冗余字段）';
COMMENT ON COLUMN classroom_classin.sync_time IS '最后同步时间';
COMMENT ON COLUMN classroom_classin.notes IS '备注';
COMMENT ON COLUMN classroom_classin.omo_station_broadcast IS 'OMO站点广播';
