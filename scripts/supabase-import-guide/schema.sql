


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."interview_status_enum" AS ENUM (
    'pending_interview',
    'under_review',
    'offered',
    'rejected',
    'onboarded'
);


ALTER TYPE "public"."interview_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."lead_add_status_enum" AS ENUM (
    'pending_assignment',
    'pending_feedback',
    'added',
    'not_added'
);


ALTER TYPE "public"."lead_add_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."lead_conversion_status_enum" AS ENUM (
    'none',
    'trial',
    'formal'
);


ALTER TYPE "public"."lead_conversion_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."lead_status_enum" AS ENUM (
    'pending',
    'assigned',
    'added',
    'not_added',
    'invalid'
);


ALTER TYPE "public"."lead_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."order_status_enum" AS ENUM (
    'active',
    'completed',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."order_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."refund_status_enum" AS ENUM (
    'pending_amount',
    'pending_finance',
    'pending_hr',
    'completed',
    'rejected'
);


ALTER TYPE "public"."refund_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."student_status_enum" AS ENUM (
    'studying',
    'suspended',
    'completed',
    'refunded'
);


ALTER TYPE "public"."student_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."trial_status_enum" AS ENUM (
    'pending_teacher',
    'pending_confirm',
    'pending_link',
    'scheduled',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."trial_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'operator',
    'sales',
    'head_teacher',
    'teacher',
    'academic_affairs',
    'finance',
    'hr',
    'teacher_recruiter'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_lead_report_number"("channel_code" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  prefix TEXT;
BEGIN
  prefix := UPPER(REGEXP_REPLACE(COALESCE(NULLIF(channel_code, ''), 'LEAD'), '[^A-Za-z0-9]+', '_', 'g'));
  prefix := TRIM(BOTH '_' FROM prefix);

  IF prefix = '' THEN
    prefix := 'LEAD';
  END IF;

  RETURN prefix || '_' || LPAD(NEXTVAL('public.leads_report_number_seq')::TEXT, 9, '0');
END;
$$;


ALTER FUNCTION "public"."generate_lead_report_number"("channel_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_lead_report_number"("channel_code" "text") IS '生成线索编号：渠道前缀 + 9 位递增序号';



CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    st_name TEXT;
    student_count INTEGER;
    order_num TEXT;
BEGIN
    -- 获取学生姓名
    SELECT student_name INTO st_name
    FROM students
    WHERE id = NEW.student_id;
    
    -- 获取该学生的订单数量
    SELECT COUNT(*) + 1 INTO student_count
    FROM formal_orders
    WHERE student_id = NEW.student_id;
    
    -- 生成订单号：姓名-序号
    order_num := st_name || '-' || student_count;
    
    RETURN order_num;
END;$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_sequence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INTEGER;
  v_name VARCHAR(100);
BEGIN
  SELECT student_name INTO v_name FROM public.students WHERE id = NEW.student_id;
  SELECT COUNT(*) INTO v_count FROM public.formal_orders WHERE student_id = NEW.student_id;
  NEW.order_sequence := v_name || '-' || (v_count + 1);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_order_sequence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_report_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_prefix VARCHAR(4);
  v_seq INTEGER;
BEGIN
  v_prefix := 'D' || TO_CHAR(CURRENT_DATE, 'MM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM 4) AS INTEGER)), 0) + 1 
  INTO v_seq FROM public.leads WHERE report_number LIKE v_prefix || '%';
  NEW.report_number := v_prefix || LPAD(v_seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_report_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_student_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq FROM public.students;
  NEW.student_number := LPAD(v_seq::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_student_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_teacher_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN 'TH' || LPAD(NEXTVAL('public.teacher_code_seq')::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."generate_teacher_code"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_teacher_code"() IS '生成老师库存编号：TH + 5 位递增序号';



CREATE OR REPLACE FUNCTION "public"."get_user_by_phone"("p_phone" character varying) RETURNS TABLE("user_id" "uuid", "username" character varying, "email" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.username,
    up.email
  FROM user_profiles up
  WHERE up.phone = p_phone AND up.is_active = true;
END;
$$;


ALTER FUNCTION "public"."get_user_by_phone"("p_phone" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$declare
  v_username text;
  v_name text;
  v_role_text text;
  v_role user_role;
begin
  v_username := coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(coalesce(new.email,''), '@', 1));
  v_name := coalesce(nullif(new.raw_user_meta_data->>'name',''), '');
  v_role_text := nullif(new.raw_user_meta_data->>'role','');
  v_role := case
    when v_role_text in ('sales','admin') then v_role_text::user_role
    else 'sales'::user_role
  end;

  insert into public.user_profiles (
    id, username, name, role, phone, wechat, email
  ) values (
    new.id,
    v_username,
    v_name,
    v_role,
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'wechat',''),
    new.email
  );

  return new;
end;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO status_history (entity_type, entity_id, from_status, to_status, operator_id)
    VALUES (TG_TABLE_NAME, NEW.id, OLD.status::TEXT, NEW.status::TEXT, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_student_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 只在状态真正改变时记录
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.student_status_history (
      student_id,
      old_status,
      new_status,
      reason,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.status_change_reason,
      NEW.status_changed_by
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_student_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_class_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_class_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_courses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_courses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uuid_generate_v7"() RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    v_time bigint;
    v_seq int;
    v_uuid uuid;
    v_bytes bytea;
BEGIN
    -- 毫秒时间戳 (48 bits)
    v_time := floor(extract(epoch FROM clock_timestamp()) * 1000);

    -- 同毫秒内递增序列
    v_seq := nextval('public.uuid_v7_seq');

    -- 用 uuid4 作为随机底座
    v_uuid := gen_random_uuid();
    v_bytes := uuid_send(v_uuid);

    /*
      bytes 结构:
      0-5   : timestamp (48 bits)
      6-7   : version + seq
      8     : variant
      9-15  : random
    */

    -- 写入时间戳
    v_bytes := set_byte(v_bytes, 0, (v_time >> 40) & 255);
    v_bytes := set_byte(v_bytes, 1, (v_time >> 32) & 255);
    v_bytes := set_byte(v_bytes, 2, (v_time >> 24) & 255);
    v_bytes := set_byte(v_bytes, 3, (v_time >> 16) & 255);
    v_bytes := set_byte(v_bytes, 4, (v_time >> 8)  & 255);
    v_bytes := set_byte(v_bytes, 5,  v_time        & 255);

    -- version = 7 (0111)
    v_bytes := set_byte(
        v_bytes,
        6,
        ((7 << 4) | ((v_seq >> 8) & 15))
    );

    -- seq 低 8 位
    v_bytes := set_byte(
        v_bytes,
        7,
        v_seq & 255
    );

    -- variant = 10xx
    v_bytes := set_byte(
        v_bytes,
        8,
        (get_byte(v_bytes, 8) & 63) | 128
    );

    RETURN uuid_recv(v_bytes);
END;$$;


ALTER FUNCTION "public"."uuid_generate_v7"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "operator_id" "uuid",
    "target_user_id" "uuid",
    "operation" "text" NOT NULL,
    "details" "jsonb",
    "ip_address" "text",
    "user_agent" "text"
);


ALTER TABLE "public"."admin_operation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_operation_logs" IS '管理员操作日志表';



COMMENT ON COLUMN "public"."admin_operation_logs"."operator_id" IS '操作者 auth.users.id (UUID)';



COMMENT ON COLUMN "public"."admin_operation_logs"."target_user_id" IS '目标用户 auth.users.id (UUID)';



CREATE TABLE IF NOT EXISTS "public"."class_classin" (
    "course_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "course_name" "text" NOT NULL,
    "creater_name" "text",
    "add_time" bigint,
    "creator_uid" bigint,
    "subject_id" bigint DEFAULT 0,
    "course_state" integer,
    "first_class_begin_time" bigint,
    "sync_time" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."class_classin" OWNER TO "postgres";


COMMENT ON TABLE "public"."class_classin" IS 'ClassIn 课程表（简化版）';



COMMENT ON COLUMN "public"."class_classin"."course_id" IS 'ClassIn 课程ID';



COMMENT ON COLUMN "public"."class_classin"."course_name" IS '课程名称';



COMMENT ON COLUMN "public"."class_classin"."creater_name" IS '创建者名称';



COMMENT ON COLUMN "public"."class_classin"."add_time" IS '添加时间（Unix时间戳）';



COMMENT ON COLUMN "public"."class_classin"."creator_uid" IS '创建者UID';



COMMENT ON COLUMN "public"."class_classin"."subject_id" IS '科目ID';



COMMENT ON COLUMN "public"."class_classin"."course_state" IS '课程状态';



COMMENT ON COLUMN "public"."class_classin"."first_class_begin_time" IS '第一次上课时间（Unix时间戳）';



COMMENT ON COLUMN "public"."class_classin"."sync_time" IS '最后同步时间';



COMMENT ON COLUMN "public"."class_classin"."notes" IS '备注';



CREATE TABLE IF NOT EXISTS "public"."class_session_statistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "classroom_id" "text" NOT NULL,
    "student_id" integer,
    "statistics" "jsonb" NOT NULL,
    "stage_up_total" "jsonb",
    "inout_details" "jsonb",
    "equipment_usage" "jsonb",
    "screen_sharing" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_session_statistics" OWNER TO "postgres";


COMMENT ON TABLE "public"."class_session_statistics" IS '课堂统计数据 - 存储ClassIn课堂结束回调的详细统计';



COMMENT ON COLUMN "public"."class_session_statistics"."session_id" IS '关联的课节ID (UUID，外键关联 class_sessions.id)';



COMMENT ON COLUMN "public"."class_session_statistics"."classroom_id" IS 'ClassIn课堂ID';



COMMENT ON COLUMN "public"."class_session_statistics"."student_id" IS '学生ID (ClassIn SID)';



COMMENT ON COLUMN "public"."class_session_statistics"."statistics" IS '完整的统计数据JSON，包含stageEnd, silenceEnd, screenchangeEnd等';



COMMENT ON COLUMN "public"."class_session_statistics"."stage_up_total" IS '上讲台统计 - 便于快速查询';



COMMENT ON COLUMN "public"."class_session_statistics"."inout_details" IS '进出课堂详情 - 便于快速查询';



COMMENT ON COLUMN "public"."class_session_statistics"."equipment_usage" IS '设备使用情况 - 便于快速查询';



COMMENT ON COLUMN "public"."class_session_statistics"."screen_sharing" IS '屏幕共享统计 - 便于快速查询';



CREATE TABLE IF NOT EXISTS "public"."class_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "classroom_id" bigint,
    "session_number" integer NOT NULL,
    "session_name" character varying(200),
    "scheduled_date" "date",
    "scheduled_time_start" time without time zone,
    "scheduled_time_end" time without time zone,
    "scheduled_duration_minutes" integer,
    "actual_start_time" timestamp with time zone,
    "actual_end_time" timestamp with time zone,
    "actual_duration_minutes" integer,
    "status" character varying(50) DEFAULT 'scheduled'::character varying,
    "teacher_id" "uuid",
    "teacher_name" character varying(100),
    "student_attendance_status" character varying(50),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."class_sessions" IS '课时表（业务层）';



COMMENT ON COLUMN "public"."class_sessions"."course_id" IS '关联的课程ID';



COMMENT ON COLUMN "public"."class_sessions"."classroom_id" IS 'ClassIn课堂ID（关联到classroom_classin.class_id）';



COMMENT ON COLUMN "public"."class_sessions"."session_number" IS '课时序号';



COMMENT ON COLUMN "public"."class_sessions"."actual_start_time" IS '实际开始时间（从classroom_classin同步）';



COMMENT ON COLUMN "public"."class_sessions"."actual_end_time" IS '实际结束时间（从classroom_classin同步）';



CREATE TABLE IF NOT EXISTS "public"."classin_callback_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "cmd" "text" NOT NULL,
    "sid" bigint,
    "classin_uid" bigint,
    "course_id" bigint,
    "classroom_id" bigint,
    "activity_id" bigint,
    "session_id" "uuid",
    "event_time" timestamp with time zone,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classin_callback_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."classin_callback_events" IS 'ClassIn 回调事件流水，保存实时互动、进出教室、录课、回放等非课堂结束类消息';



COMMENT ON COLUMN "public"."classin_callback_events"."event_type" IS '内部归类后的事件类型';



COMMENT ON COLUMN "public"."classin_callback_events"."cmd" IS 'ClassIn 原始 Cmd';



COMMENT ON COLUMN "public"."classin_callback_events"."sid" IS 'ClassIn 学校或学生 SID';



COMMENT ON COLUMN "public"."classin_callback_events"."classin_uid" IS 'ClassIn 用户 UID';



COMMENT ON COLUMN "public"."classin_callback_events"."course_id" IS 'ClassIn 课程 ID';



COMMENT ON COLUMN "public"."classin_callback_events"."classroom_id" IS 'ClassIn 课堂 ID';



COMMENT ON COLUMN "public"."classin_callback_events"."activity_id" IS 'ClassIn 活动 ID';



COMMENT ON COLUMN "public"."classin_callback_events"."session_id" IS '匹配到的本地课节 ID';



COMMENT ON COLUMN "public"."classin_callback_events"."event_time" IS '回调业务时间，优先使用 TimeStamp';



COMMENT ON COLUMN "public"."classin_callback_events"."payload" IS '去除 SafeKey 后的回调摘要和 Msg 解析结果';



CREATE TABLE IF NOT EXISTS "public"."classroom_classin" (
    "class_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "start_time" bigint,
    "end_time" bigint,
    "teach_mode" integer,
    "is_auto_onstage" integer DEFAULT 2,
    "course_id" bigint,
    "created_at_timestamp" bigint,
    "biz_type" integer DEFAULT 1,
    "process_flag" integer DEFAULT 0,
    "course_name" "text",
    "sync_time" timestamp with time zone,
    "notes" "text",
    "omo_station_broadcast" integer DEFAULT 0,
    "activity_id" bigint
);


ALTER TABLE "public"."classroom_classin" OWNER TO "postgres";


COMMENT ON TABLE "public"."classroom_classin" IS 'ClassIn 课堂表（简化版）';



COMMENT ON COLUMN "public"."classroom_classin"."class_id" IS 'ClassIn 课堂ID';



COMMENT ON COLUMN "public"."classroom_classin"."name" IS '课堂名称';



COMMENT ON COLUMN "public"."classroom_classin"."start_time" IS '开始时间（Unix时间戳）';



COMMENT ON COLUMN "public"."classroom_classin"."end_time" IS '结束时间（Unix时间戳）';



COMMENT ON COLUMN "public"."classroom_classin"."teach_mode" IS '教学模式';



COMMENT ON COLUMN "public"."classroom_classin"."is_auto_onstage" IS '是否自动上台';



COMMENT ON COLUMN "public"."classroom_classin"."course_id" IS '关联的课程ID（class_classin.course_id）';



COMMENT ON COLUMN "public"."classroom_classin"."created_at_timestamp" IS '创建时间（Unix时间戳）';



COMMENT ON COLUMN "public"."classroom_classin"."biz_type" IS '业务类型';



COMMENT ON COLUMN "public"."classroom_classin"."process_flag" IS '处理标志';



COMMENT ON COLUMN "public"."classroom_classin"."course_name" IS '课程名称（冗余字段）';



COMMENT ON COLUMN "public"."classroom_classin"."sync_time" IS '最后同步时间';



COMMENT ON COLUMN "public"."classroom_classin"."notes" IS '备注';



COMMENT ON COLUMN "public"."classroom_classin"."omo_station_broadcast" IS 'OMO站点广播';



COMMENT ON COLUMN "public"."classroom_classin"."activity_id" IS 'ClassIn 活动ID（用于删除课堂）';



CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "classin_course_id" bigint,
    "course_name" character varying(200),
    "subject" character varying(100),
    "grade" character varying(50),
    "teacher_id" "uuid",
    "teacher_name" character varying(100),
    "session_count" integer DEFAULT 0,
    "total_hours" numeric(10,2) DEFAULT 0,
    "course_status" character varying(50) DEFAULT 'active'::character varying,
    "course_consumption_info" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "student_id" "uuid"
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


COMMENT ON TABLE "public"."courses" IS '课程表（业务层）';



COMMENT ON COLUMN "public"."courses"."order_id" IS '关联的正式订单ID（一对一关系）';



COMMENT ON COLUMN "public"."courses"."classin_course_id" IS 'ClassIn课程ID（关联到class_classin.course_id）';



COMMENT ON COLUMN "public"."courses"."course_consumption_info" IS '课程消耗统计信息（JSON格式）';



COMMENT ON COLUMN "public"."courses"."student_id" IS '学生ID';



CREATE TABLE IF NOT EXISTS "public"."daily_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "wechat_number" "text" NOT NULL,
    "assigned_person" "text" NOT NULL,
    "received_date" "date" NOT NULL,
    "is_added" boolean DEFAULT false,
    "resume_attachment" "text",
    "notes" "text"
);


ALTER TABLE "public"."daily_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formal_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "student_id" "uuid",
    "order_number" "text" NOT NULL,
    "teacher_names" "text"[] NOT NULL,
    "subjects" "text"[] NOT NULL,
    "order_type" "text" NOT NULL,
    "total_hours" numeric(10,2) NOT NULL,
    "payment_channel" "text" NOT NULL,
    "payment_amount" numeric(10,2) NOT NULL,
    "hourly_rate" numeric(10,2) NOT NULL,
    "payment_proof" "text" NOT NULL,
    "payment_time" timestamp with time zone NOT NULL,
    "consultant_teacher" "text" NOT NULL,
    "order_notes" "text",
    "total_sessions" integer NOT NULL,
    "session_duration" numeric(10,2) NOT NULL,
    "fixed_mode" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "official_start_time" timestamp with time zone NOT NULL,
    "first_class_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "lead_id" "uuid",
    "previous_order_id" "uuid",
    "trial_lesson_id" "uuid",
    CONSTRAINT "formal_orders_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."formal_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."formal_orders"."lead_id" IS '关联线索ID（新签/扩课时填写）';



COMMENT ON COLUMN "public"."formal_orders"."previous_order_id" IS '关联之前订单ID（续费时填写）';



COMMENT ON COLUMN "public"."formal_orders"."trial_lesson_id" IS '来源试听课程ID（试听转正式时填写）';



CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_number" character varying(20) NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "xhs_source" character varying(100) NOT NULL,
    "grade_code" character varying(50),
    "subject_codes" "text"[],
    "region_ip" character varying(100),
    "add_method_code" character varying(50) NOT NULL,
    "parent_wechat" character varying(100),
    "operator_id" "uuid" NOT NULL,
    "chat_screenshots" "text",
    "duplicate_mark" character varying(50),
    "collision_operator" character varying(100),
    "grab_wechat" character varying(100),
    "grab_user_id" "uuid",
    "add_feedback" character varying(20),
    "feedback_time" timestamp with time zone,
    "add_status" "public"."lead_add_status_enum" DEFAULT 'pending_assignment'::"public"."lead_add_status_enum",
    "conversion_status" "public"."lead_conversion_status_enum" DEFAULT 'none'::"public"."lead_conversion_status_enum",
    "remark" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "text",
    "updated_by" "text",
    "channel_platform" "text",
    "customer_social_id" "text"
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads"."chat_screenshots" IS '聊天截图 URL';



COMMENT ON COLUMN "public"."leads"."created_by" IS '创建人姓名 - 记录谁创建的这条线索';



COMMENT ON COLUMN "public"."leads"."updated_by" IS '最后更新人姓名 - 记录谁最后修改了这条线索';



COMMENT ON COLUMN "public"."leads"."channel_platform" IS '渠道平台，用于与客户社媒账号 ID 组合判断重复线索';



COMMENT ON COLUMN "public"."leads"."customer_social_id" IS '客户社媒账号 ID，用于同渠道重复线索提示';



CREATE SEQUENCE IF NOT EXISTS "public"."leads_report_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."leads_report_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_changes" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "change_type" character varying(50) NOT NULL,
    "amount" numeric(10,2),
    "reason" "text",
    "bank_info" "jsonb",
    "status" character varying(50),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."order_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "join_date" "date" NOT NULL,
    "sales_name" "text" NOT NULL,
    "position" "text" NOT NULL,
    "team" "text",
    "sales_leader" "text",
    "employment_status" "text" NOT NULL,
    "cc_wechat" "text",
    "statistics_status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "sales_staff_employment_status_check" CHECK (("employment_status" = ANY (ARRAY['在职'::"text", '离职'::"text", '休假'::"text"]))),
    CONSTRAINT "sales_staff_statistics_status_check" CHECK (("statistics_status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."sales_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."status_history" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "from_status" character varying(50),
    "to_status" character varying(50) NOT NULL,
    "operator_id" "uuid",
    "remark" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "reason" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_status_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_status_history" IS '学生状态变更历史';



COMMENT ON COLUMN "public"."student_status_history"."student_id" IS '学生ID';



COMMENT ON COLUMN "public"."student_status_history"."old_status" IS '变更前状态';



COMMENT ON COLUMN "public"."student_status_history"."new_status" IS '变更后状态';



COMMENT ON COLUMN "public"."student_status_history"."reason" IS '变更原因';



COMMENT ON COLUMN "public"."student_status_history"."changed_by" IS '操作人ID';



COMMENT ON COLUMN "public"."student_status_history"."changed_at" IS '变更时间';



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_code" "text" NOT NULL,
    "student_name" "text" NOT NULL,
    "grade_code" "text",
    "region" "text",
    "school" "text",
    "parent_phone" "text",
    "head_teacher_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "classin_initial_password" "text",
    "classin_uid" bigint
);


ALTER TABLE "public"."students" OWNER TO "postgres";


COMMENT ON COLUMN "public"."students"."status" IS '学生状态：studying(在读), suspended(停课), completed(结课), refunded(退费)';



CREATE TABLE IF NOT EXISTS "public"."students_classin" (
    "uid" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stud_id" bigint,
    "name" "text" NOT NULL,
    "join_type" integer,
    "mobile" "text",
    "email" "text",
    "account_status" integer,
    "cat_info" "jsonb",
    "lable_info" "jsonb",
    "stuno" "text",
    "isdel" integer DEFAULT 0,
    "addtime" bigint,
    "serve_state" integer,
    "sync_time" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."students_classin" OWNER TO "postgres";


COMMENT ON TABLE "public"."students_classin" IS 'ClassIn 学生原始数据表，使用 ClassIn uid 作为主键';



COMMENT ON COLUMN "public"."students_classin"."uid" IS 'ClassIn 唯一标识符（主键）';



COMMENT ON COLUMN "public"."students_classin"."stud_id" IS 'ClassIn 学生ID (studId)';



COMMENT ON COLUMN "public"."students_classin"."name" IS '学生姓名';



COMMENT ON COLUMN "public"."students_classin"."join_type" IS '加入类型';



COMMENT ON COLUMN "public"."students_classin"."mobile" IS '手机号';



COMMENT ON COLUMN "public"."students_classin"."email" IS '邮箱';



COMMENT ON COLUMN "public"."students_classin"."account_status" IS '账号状态';



COMMENT ON COLUMN "public"."students_classin"."cat_info" IS '分类信息 (JSON数组)';



COMMENT ON COLUMN "public"."students_classin"."lable_info" IS '标签信息 (JSON数组)';



COMMENT ON COLUMN "public"."students_classin"."stuno" IS '学号';



COMMENT ON COLUMN "public"."students_classin"."isdel" IS '是否删除 (0=正常, 1=已删除)';



COMMENT ON COLUMN "public"."students_classin"."addtime" IS '添加时间 (Unix时间戳)';



COMMENT ON COLUMN "public"."students_classin"."serve_state" IS '服务状态';



COMMENT ON COLUMN "public"."students_classin"."sync_time" IS '最后同步时间';



CREATE TABLE IF NOT EXISTS "public"."sys_dictionaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" character varying(50) NOT NULL,
    "code" character varying(50) NOT NULL,
    "label" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone
);


ALTER TABLE "public"."sys_dictionaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "wechat_id" "text",
    "daily_lead_id" "uuid",
    "resume_url" "text",
    "profile_photo_url" "text",
    "grade_level" "text",
    "subjects_taught" "text"[],
    "teacher_type" "text",
    "interview_date" "date",
    "interviewer_name" "text",
    "interview_time" time without time zone,
    "interview_link" "text",
    "interview_officer" "text",
    "interview_exception" "text",
    "video_recording_url" "text",
    "trial_subject" "text",
    "trial_video_url" "text",
    "teaching_style" "text",
    "interview_score" numeric(5,2),
    "logical_expression_score" numeric(5,2),
    "dress_appearance_score" numeric(5,2),
    "material_preparation_score" numeric(5,2),
    "initial_evaluation" "text",
    "teacher_characteristics" "text",
    "mandarin_level" "text",
    "research_ability" "text",
    "service_awareness" "text",
    "affinity" "text",
    "review_status" "text" DEFAULT '待复核'::"text",
    "review_result" "text",
    "review_evaluation_comment" "text",
    "review_date" "date",
    "reviewed_by" "uuid",
    "is_hired" boolean DEFAULT false,
    "hired_notes" "text",
    "teacher_level" "text",
    "can_teach_graduation_class" boolean,
    "teacher_feeling" "text",
    "suitable_for_students" "text",
    "approved_hourly_rate" numeric(10,2),
    "interview_month" "text",
    "registration_date" "date",
    "interview_week" "text",
    "scheduling_week" "text",
    "qr_code_url" "text",
    "scheduling_preference" "text",
    "exam_score" "text",
    "current_rate" numeric(10,2),
    "grade_level_rates" "jsonb" DEFAULT '{}'::"jsonb",
    "grade_level_settings" "jsonb" DEFAULT '[]'::"jsonb",
    "phone" "text",
    "interview_result" "text",
    "interview_notes" "text",
    "interview_rating" "text",
    "review_notes" "text",
    "bank_account" "text",
    "bank_account_name" "text",
    "bank_name" "text",
    "bank_branch" "text",
    "notes_external" "text",
    CONSTRAINT "teacher_candidates_review_status_check" CHECK (("review_status" = ANY (ARRAY['待复核'::"text", '已复核'::"text", '不符合'::"text"])))
);


ALTER TABLE "public"."teacher_candidates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teacher_candidates"."approved_hourly_rate" IS '默认时薪（已废弃，请使用 grade_level_rates）';



COMMENT ON COLUMN "public"."teacher_candidates"."grade_level_rates" IS '年级段-时薪映射，格式: {"小学": 80, "初中": 100, "高中": 120}';



COMMENT ON COLUMN "public"."teacher_candidates"."grade_level_settings" IS '年级配置数组，格式: [{"grade": "小学一年级", "workload": 10, "hourlyRate": 80}]';



COMMENT ON COLUMN "public"."teacher_candidates"."phone" IS '手机号';



COMMENT ON COLUMN "public"."teacher_candidates"."interview_result" IS '面试结果';



COMMENT ON COLUMN "public"."teacher_candidates"."interview_notes" IS '约面/面试视频阶段备注';



COMMENT ON COLUMN "public"."teacher_candidates"."interview_rating" IS '教学复核面试评级';



COMMENT ON COLUMN "public"."teacher_candidates"."review_notes" IS '教学复核备注或拒绝原因';



COMMENT ON COLUMN "public"."teacher_candidates"."bank_account" IS '老师入库银行卡号';



COMMENT ON COLUMN "public"."teacher_candidates"."bank_account_name" IS '老师入库银行卡持卡人姓名';



COMMENT ON COLUMN "public"."teacher_candidates"."bank_name" IS '老师入库开户银行';



COMMENT ON COLUMN "public"."teacher_candidates"."bank_branch" IS '老师入库开户支行';



COMMENT ON COLUMN "public"."teacher_candidates"."notes_external" IS '老师可见外显备注';



CREATE TABLE IF NOT EXISTS "public"."teacher_classin" (
    "uid" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "st_id" bigint,
    "name" "text" NOT NULL,
    "logo" "text",
    "emp_no" "text",
    "position" "text",
    "is_del" integer DEFAULT 0,
    "join_type" integer,
    "departments_info" "jsonb",
    "mobile" "text",
    "email" "text",
    "account_status" integer,
    "sync_time" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."teacher_classin" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_classin" IS 'ClassIn 老师原始数据表，使用 ClassIn uid 作为主键';



COMMENT ON COLUMN "public"."teacher_classin"."uid" IS 'ClassIn 唯一标识符（主键）';



COMMENT ON COLUMN "public"."teacher_classin"."st_id" IS 'ClassIn 老师ID (stId)';



COMMENT ON COLUMN "public"."teacher_classin"."name" IS '老师姓名';



COMMENT ON COLUMN "public"."teacher_classin"."logo" IS '头像URL';



COMMENT ON COLUMN "public"."teacher_classin"."emp_no" IS '工号';



COMMENT ON COLUMN "public"."teacher_classin"."position" IS '职位';



COMMENT ON COLUMN "public"."teacher_classin"."is_del" IS '是否删除 (0=正常, 1=已删除)';



COMMENT ON COLUMN "public"."teacher_classin"."join_type" IS '加入类型 (1=正常加入)';



COMMENT ON COLUMN "public"."teacher_classin"."departments_info" IS '部门信息 (JSON数组)';



COMMENT ON COLUMN "public"."teacher_classin"."mobile" IS '手机号';



COMMENT ON COLUMN "public"."teacher_classin"."email" IS '邮箱';



COMMENT ON COLUMN "public"."teacher_classin"."account_status" IS '账号状态';



COMMENT ON COLUMN "public"."teacher_classin"."sync_time" IS '最后同步时间';



CREATE SEQUENCE IF NOT EXISTS "public"."teacher_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teacher_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "candidate_id" "uuid",
    "teacher_name" "text" NOT NULL,
    "gender" "text" NOT NULL,
    "wechat" "text" NOT NULL,
    "classin_phone" "text" NOT NULL,
    "location" "text" NOT NULL,
    "subjects" "text"[] NOT NULL,
    "grade_levels" "text"[] NOT NULL,
    "used_classin" "text" NOT NULL,
    "has_certificate" "text" NOT NULL,
    "education" "text" NOT NULL,
    "university" "text" NOT NULL,
    "teaching_years" numeric NOT NULL,
    "available_times" "text"[] NOT NULL,
    "textbook_versions" "text"[] NOT NULL,
    "student_regions" "text"[] NOT NULL,
    "student_levels" "text"[] NOT NULL,
    "teaching_style" "text" NOT NULL,
    "teaching_experience" "text" NOT NULL,
    "success_cases" "text" NOT NULL,
    "notes" "text",
    "photo_url" "text" NOT NULL,
    "review_screenshots" "text"[]
);


ALTER TABLE "public"."teacher_details" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_details" IS '老师详细信息表';



COMMENT ON COLUMN "public"."teacher_details"."candidate_id" IS '关联的老师候选人ID';



COMMENT ON COLUMN "public"."teacher_details"."teacher_name" IS '老师姓名';



COMMENT ON COLUMN "public"."teacher_details"."gender" IS '性别';



COMMENT ON COLUMN "public"."teacher_details"."wechat" IS '微信号';



COMMENT ON COLUMN "public"."teacher_details"."classin_phone" IS 'ClassIn注册手机号';



COMMENT ON COLUMN "public"."teacher_details"."location" IS '老师所在地';



COMMENT ON COLUMN "public"."teacher_details"."subjects" IS '教授学科（数组）';



COMMENT ON COLUMN "public"."teacher_details"."grade_levels" IS '教授年级段（数组）';



COMMENT ON COLUMN "public"."teacher_details"."used_classin" IS '是否用过ClassIn';



COMMENT ON COLUMN "public"."teacher_details"."has_certificate" IS '是否有教资证';



COMMENT ON COLUMN "public"."teacher_details"."education" IS '学历';



COMMENT ON COLUMN "public"."teacher_details"."university" IS '毕业院校';



COMMENT ON COLUMN "public"."teacher_details"."teaching_years" IS '教学年限（年）';



COMMENT ON COLUMN "public"."teacher_details"."available_times" IS '可排课时间（数组）';



COMMENT ON COLUMN "public"."teacher_details"."textbook_versions" IS '熟悉的教材版本（数组）';



COMMENT ON COLUMN "public"."teacher_details"."student_regions" IS '带过学生地域（数组）';



COMMENT ON COLUMN "public"."teacher_details"."student_levels" IS '擅长的学生水平（数组）';



COMMENT ON COLUMN "public"."teacher_details"."teaching_style" IS '教学特点';



COMMENT ON COLUMN "public"."teacher_details"."teaching_experience" IS '教学经历';



COMMENT ON COLUMN "public"."teacher_details"."success_cases" IS '优秀学员提分案例';



COMMENT ON COLUMN "public"."teacher_details"."notes" IS '备注';



COMMENT ON COLUMN "public"."teacher_details"."photo_url" IS '老师形象照URL';



COMMENT ON COLUMN "public"."teacher_details"."review_screenshots" IS '提分/好评截图URL数组';



CREATE TABLE IF NOT EXISTS "public"."teacher_exception_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exception_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "note" "text",
    "actor_id" "uuid",
    "actor_name" "text",
    "actor_role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_exception_events_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'status_changed'::"text", 'note_added'::"text"]))),
    CONSTRAINT "teacher_exception_events_from_status_check" CHECK ((("from_status" IS NULL) OR ("from_status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'ignored'::"text"])))),
    CONSTRAINT "teacher_exception_events_to_status_check" CHECK ((("to_status" IS NULL) OR ("to_status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'ignored'::"text"]))))
);


ALTER TABLE "public"."teacher_exception_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_exception_events" IS '老师异常处理事件流水，记录每次创建、备注和状态变化';



CREATE TABLE IF NOT EXISTS "public"."teacher_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "issue_code" "text" NOT NULL,
    "issue_label" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reason" "text",
    "current_suggestion" "text",
    "issue_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "assigned_to" "uuid",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_by" "uuid",
    "created_by_name" "text",
    "updated_by" "uuid",
    "updated_by_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_exceptions_severity_check" CHECK (("severity" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "teacher_exceptions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."teacher_exceptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_exceptions" IS '老师新入库异常处理主表，按老师和异常项保存当前处理状态';



COMMENT ON COLUMN "public"."teacher_exceptions"."issue_code" IS '自动识别出的异常代码，例如 missing_classin_uid';



COMMENT ON COLUMN "public"."teacher_exceptions"."status" IS '异常处理状态：open/in_progress/resolved/ignored';



COMMENT ON COLUMN "public"."teacher_exceptions"."reason" IS '异常原因或处理说明';



COMMENT ON COLUMN "public"."teacher_exceptions"."issue_snapshot" IS '保存异常项的识别快照，便于后续追溯规则变化';



CREATE TABLE IF NOT EXISTS "public"."teacher_interviews" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "applicant_name" character varying(100) NOT NULL,
    "wechat" character varying(100) NOT NULL,
    "resume_url" "text",
    "subject_codes" "text"[],
    "grade_codes" "text"[],
    "rating_details" "jsonb",
    "interview_video" "text",
    "interviewer_id" "uuid",
    "proposed_hourly_rate" numeric(10,2),
    "status" "public"."interview_status_enum" DEFAULT 'pending_interview'::"public"."interview_status_enum",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."teacher_interviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_name" character varying(100) NOT NULL,
    "gender" character varying(10) NOT NULL,
    "university" character varying(200) NOT NULL,
    "education" character varying(50) NOT NULL,
    "teaching_years" integer DEFAULT 0 NOT NULL,
    "bank_card_info" "jsonb",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "wechat" "text" NOT NULL,
    "classin_phone" "text" NOT NULL,
    "location" "text" NOT NULL,
    "subjects" "text"[] NOT NULL,
    "grade_levels" "text"[] NOT NULL,
    "used_classin" boolean DEFAULT false NOT NULL,
    "has_certificate" boolean DEFAULT false NOT NULL,
    "available_times" "text"[],
    "textbook_versions" "text"[],
    "student_regions" "text"[] NOT NULL,
    "student_levels" "text"[] NOT NULL,
    "teaching_style" "text" NOT NULL,
    "success_cases" "text" NOT NULL,
    "photo_url" "text" NOT NULL,
    "review_screenshots" "text"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "mobile" "text",
    "classin_uid" bigint
);


ALTER TABLE "public"."teacher_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teacher_profiles"."teacher_name" IS '老师姓名 *';



COMMENT ON COLUMN "public"."teacher_profiles"."gender" IS '性别 * (男/女)';



COMMENT ON COLUMN "public"."teacher_profiles"."university" IS '毕业院校 *';



COMMENT ON COLUMN "public"."teacher_profiles"."education" IS '学历 * (本科/硕士/博士/其他)';



COMMENT ON COLUMN "public"."teacher_profiles"."teaching_years" IS '教学年限 *';



COMMENT ON COLUMN "public"."teacher_profiles"."bank_card_info" IS '银行卡信息 (JSONB，内部使用)';



COMMENT ON COLUMN "public"."teacher_profiles"."wechat" IS '微信号 * (常用的)';



COMMENT ON COLUMN "public"."teacher_profiles"."classin_phone" IS 'Classin注册手机号 *';



COMMENT ON COLUMN "public"."teacher_profiles"."location" IS '老师所在地 *';



COMMENT ON COLUMN "public"."teacher_profiles"."subjects" IS '教授学科 * (数组: 数学/语文/英语/物理/化学/道法/地理/历史/生物/科学/社会)';



COMMENT ON COLUMN "public"."teacher_profiles"."grade_levels" IS '教授年级段 * (至多2个，数组: 小学/初中/高中)';



COMMENT ON COLUMN "public"."teacher_profiles"."used_classin" IS '是否用过Classin *';



COMMENT ON COLUMN "public"."teacher_profiles"."has_certificate" IS '是否有教资证 *';



COMMENT ON COLUMN "public"."teacher_profiles"."available_times" IS '可排课时间 * (多选数组)';



COMMENT ON COLUMN "public"."teacher_profiles"."textbook_versions" IS '熟悉的教材版本 * (多选数组)';



COMMENT ON COLUMN "public"."teacher_profiles"."student_regions" IS '带过学生地域 * (多选数组)';



COMMENT ON COLUMN "public"."teacher_profiles"."student_levels" IS '擅长的学生水平 * (多选数组)';



COMMENT ON COLUMN "public"."teacher_profiles"."teaching_style" IS '教学特点 *';



COMMENT ON COLUMN "public"."teacher_profiles"."success_cases" IS '优秀学员提分案例 *';



COMMENT ON COLUMN "public"."teacher_profiles"."photo_url" IS '老师形象照 *';



COMMENT ON COLUMN "public"."teacher_profiles"."review_screenshots" IS '提分/好评截图 (可选数组)';



COMMENT ON COLUMN "public"."teacher_profiles"."notes" IS '备注 (选填)';



COMMENT ON COLUMN "public"."teacher_profiles"."mobile" IS '老师常用联系电话';



COMMENT ON COLUMN "public"."teacher_profiles"."classin_uid" IS 'ClassIn 系统中的老师唯一标识符（uid）';



CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "mobile" "text",
    "classin_initial_password" "text",
    "classin_uid" bigint,
    "candidate_id" "uuid",
    "wechat" "text",
    "classin_phone" "text",
    "subjects" "text"[],
    "grade_levels" "text"[],
    "used_classin" boolean DEFAULT false,
    "has_certificate" boolean DEFAULT false,
    "available_times" "text"[],
    "textbook_versions" "text"[],
    "student_regions" "text"[],
    "student_levels" "text"[],
    "teaching_years" integer,
    "teaching_style" "text",
    "success_cases" "text",
    "photo_url" "text",
    "review_screenshots" "text"[],
    "bank_card_info" "jsonb",
    "location" "text",
    "gender" "text",
    "notes" "text",
    "is_del" integer DEFAULT 0,
    "education" "text",
    "university" "text",
    "teacher_level" "text"
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teachers"."teacher_code" IS '老师编号（TH + 5 位递增自动生成）';



COMMENT ON COLUMN "public"."teachers"."status" IS '老师库存状态：active=正常，full=满课，paused=暂停排课，disabled=停用';



COMMENT ON COLUMN "public"."teachers"."wechat" IS '微信号';



COMMENT ON COLUMN "public"."teachers"."classin_phone" IS 'ClassIn注册手机号';



COMMENT ON COLUMN "public"."teachers"."subjects" IS '教授学科（数组）';



COMMENT ON COLUMN "public"."teachers"."grade_levels" IS '教授年级段（数组）';



COMMENT ON COLUMN "public"."teachers"."used_classin" IS '是否用过ClassIn';



COMMENT ON COLUMN "public"."teachers"."has_certificate" IS '是否有教资证';



COMMENT ON COLUMN "public"."teachers"."available_times" IS '可排课时间（数组）';



COMMENT ON COLUMN "public"."teachers"."textbook_versions" IS '熟悉的教材版本（数组）';



COMMENT ON COLUMN "public"."teachers"."student_regions" IS '带过学生地域（数组）';



COMMENT ON COLUMN "public"."teachers"."student_levels" IS '擅长的学生水平（数组）';



COMMENT ON COLUMN "public"."teachers"."teaching_years" IS '教学年限（年）';



COMMENT ON COLUMN "public"."teachers"."teaching_style" IS '教学特点';



COMMENT ON COLUMN "public"."teachers"."success_cases" IS '优秀学员提分案例';



COMMENT ON COLUMN "public"."teachers"."photo_url" IS '老师形象照URL';



COMMENT ON COLUMN "public"."teachers"."review_screenshots" IS '提分/好评截图URL数组';



COMMENT ON COLUMN "public"."teachers"."bank_card_info" IS '银行卡信息（JSON格式）';



COMMENT ON COLUMN "public"."teachers"."location" IS '老师所在地';



COMMENT ON COLUMN "public"."teachers"."gender" IS '性别';



COMMENT ON COLUMN "public"."teachers"."notes" IS '备注';



COMMENT ON COLUMN "public"."teachers"."is_del" IS '是否删除（0=正常，1=已删除）';



COMMENT ON COLUMN "public"."teachers"."education" IS '学历';



COMMENT ON COLUMN "public"."teachers"."university" IS '毕业院校';



COMMENT ON COLUMN "public"."teachers"."teacher_level" IS '老师等级：junior/intermediate/senior/expert 或业务自定义值';



CREATE TABLE IF NOT EXISTS "public"."teachers2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "mobile" "text",
    "classin_initial_password" "text",
    "classin_uid" bigint,
    "candidate_id" "uuid"
);


ALTER TABLE "public"."teachers2" OWNER TO "postgres";


COMMENT ON TABLE "public"."teachers2" IS 'This is a duplicate of teachers';



CREATE TABLE IF NOT EXISTS "public"."todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "completed_at" timestamp with time zone,
    "assigned_to" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "entity_type" "text",
    "entity_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" timestamp with time zone,
    "metadata" "jsonb",
    "is_auto_created" boolean DEFAULT false,
    "auto_trigger_type" "text"
);


ALTER TABLE "public"."todos" OWNER TO "postgres";


COMMENT ON TABLE "public"."todos" IS '待办事项表';



COMMENT ON COLUMN "public"."todos"."id" IS '主键ID';



COMMENT ON COLUMN "public"."todos"."created_at" IS '创建时间';



COMMENT ON COLUMN "public"."todos"."updated_at" IS '更新时间';



COMMENT ON COLUMN "public"."todos"."created_by" IS '创建人用户ID（UUID）';



COMMENT ON COLUMN "public"."todos"."completed_at" IS '完成时间';



COMMENT ON COLUMN "public"."todos"."assigned_to" IS '分配给谁的用户ID（UUID）';



COMMENT ON COLUMN "public"."todos"."assigned_by" IS '分配人用户ID（UUID）';



COMMENT ON COLUMN "public"."todos"."title" IS '待办标题';



COMMENT ON COLUMN "public"."todos"."description" IS '详细描述';



COMMENT ON COLUMN "public"."todos"."priority" IS '优先级：low, medium, high, urgent';



COMMENT ON COLUMN "public"."todos"."entity_type" IS '关联实体类型：lead, student, trial_lesson, formal_order';



COMMENT ON COLUMN "public"."todos"."entity_id" IS '关联实体ID';



COMMENT ON COLUMN "public"."todos"."status" IS '状态：pending, completed, cancelled';



COMMENT ON COLUMN "public"."todos"."due_date" IS '到期时间';



COMMENT ON COLUMN "public"."todos"."metadata" IS '额外信息（JSON格式）';



COMMENT ON COLUMN "public"."todos"."is_auto_created" IS '是否自动创建';



COMMENT ON COLUMN "public"."todos"."auto_trigger_type" IS '自动触发类型标识';



CREATE TABLE IF NOT EXISTS "public"."transaction_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "creation_date" "date" NOT NULL,
    "course_name" "text",
    "student_name" "text" NOT NULL,
    "teacher_name" "text",
    "schedule_consumption" numeric(10,2),
    "order_type" "text",
    "original_consultant" "text",
    "class_teacher" "text",
    "refund_reason" "text",
    "transaction_type" "text" NOT NULL,
    "remaining_duration" numeric(10,2),
    "refund_amount" numeric(10,2),
    "bank_card_name" "text",
    "bank_card_number" "text",
    "bank_name" "text",
    "bank_branch" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "unit_price" numeric(10,2),
    "student_id" "uuid",
    "order_id" "uuid",
    "academic_verified_at" timestamp with time zone,
    "academic_verified_by" "uuid",
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "performance_verified_at" timestamp with time zone,
    "performance_verified_by" "uuid",
    CONSTRAINT "transaction_records_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."transaction_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transaction_records"."student_id" IS '关联学生ID，用于正式生详情与权限过滤';



COMMENT ON COLUMN "public"."transaction_records"."order_id" IS '关联正式订单ID，用于退费上限校验';



COMMENT ON COLUMN "public"."transaction_records"."academic_verified_at" IS '教务核对金额时间';



COMMENT ON COLUMN "public"."transaction_records"."academic_verified_by" IS '教务核对金额操作人';



COMMENT ON COLUMN "public"."transaction_records"."paid_at" IS '财务打款时间';



COMMENT ON COLUMN "public"."transaction_records"."paid_by" IS '财务打款操作人';



COMMENT ON COLUMN "public"."transaction_records"."performance_verified_at" IS '人力业绩核对时间';



COMMENT ON COLUMN "public"."transaction_records"."performance_verified_by" IS '人力业绩核对操作人';



CREATE TABLE IF NOT EXISTS "public"."transaction_workflow_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "actor_id" "uuid",
    "actor_name" "text",
    "actor_role" "text",
    "note" "text",
    CONSTRAINT "transaction_workflow_events_action_check" CHECK (("action" = ANY (ARRAY['submitted'::"text", 'verify_amount'::"text", 'mark_paid'::"text", 'verify_performance'::"text", 'reject'::"text", 'status_change'::"text"])))
);


ALTER TABLE "public"."transaction_workflow_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."transaction_workflow_events" IS '退费/异动流程操作流水';



COMMENT ON COLUMN "public"."transaction_workflow_events"."transaction_id" IS '关联退费/异动记录ID';



COMMENT ON COLUMN "public"."transaction_workflow_events"."action" IS '流程动作';



COMMENT ON COLUMN "public"."transaction_workflow_events"."from_status" IS '操作前状态';



COMMENT ON COLUMN "public"."transaction_workflow_events"."to_status" IS '操作后状态';



COMMENT ON COLUMN "public"."transaction_workflow_events"."actor_id" IS '操作人ID';



COMMENT ON COLUMN "public"."transaction_workflow_events"."actor_name" IS '操作人姓名';



COMMENT ON COLUMN "public"."transaction_workflow_events"."actor_role" IS '操作人角色';



COMMENT ON COLUMN "public"."transaction_workflow_events"."note" IS '操作备注';



CREATE TABLE IF NOT EXISTS "public"."trial_appointments" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "lead_id" "uuid",
    "student_name" character varying(100) NOT NULL,
    "region" character varying(100),
    "grade_code" character varying(50),
    "subject_code" character varying(50),
    "trial_datetime" timestamp with time zone,
    "duration_minutes" integer,
    "phone" character varying(20),
    "channel_code" character varying(50),
    "trial_amount" numeric(10,2),
    "payment_proof" "text",
    "remarks" "text",
    "advisor_id" "uuid",
    "academic_id" "uuid",
    "teacher_id" "uuid",
    "class_link" "text",
    "urgency_level" character varying(20),
    "is_converted" boolean DEFAULT false,
    "status" "public"."trial_status_enum" DEFAULT 'pending_teacher'::"public"."trial_status_enum",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."trial_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trial_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "child_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "lead_id" "uuid",
    "region" "text" NOT NULL,
    "grade" "text" NOT NULL,
    "trial_subject" "text" NOT NULL,
    "trial_time" timestamp with time zone NOT NULL,
    "trial_duration" numeric(10,2) NOT NULL,
    "phone" "text" NOT NULL,
    "channel" "text",
    "trial_amount" numeric(10,2),
    "payment_proof" "text" NOT NULL,
    "urgency_level" "text",
    "notes" "text",
    "assigned_consultant" "text",
    "course_status" "text",
    "student_type" "text",
    "matched_teacher" "text",
    "confirmed_teacher" "text",
    "classin_course_id" bigint,
    "classin_class_id" bigint,
    "classin_unit_id" bigint,
    "classin_activity_id" bigint,
    "class_link" "text",
    "classin_student_uid" bigint,
    "classin_student_registered_at" timestamp with time zone,
    "classin_student_error" "text",
    "student_id" "uuid",
    CONSTRAINT "trial_lessons_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "trial_lessons_urgency_level_check" CHECK (("urgency_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."trial_lessons" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trial_lessons"."classin_course_id" IS 'ClassIn 课程ID';



COMMENT ON COLUMN "public"."trial_lessons"."classin_class_id" IS 'ClassIn 课节ID';



COMMENT ON COLUMN "public"."trial_lessons"."classin_unit_id" IS 'ClassIn 单元ID';



COMMENT ON COLUMN "public"."trial_lessons"."classin_activity_id" IS 'ClassIn 课堂活动ID';



COMMENT ON COLUMN "public"."trial_lessons"."class_link" IS 'ClassIn 课堂/课程分享链接';



COMMENT ON COLUMN "public"."trial_lessons"."classin_student_uid" IS '试听学生 ClassIn UID';



COMMENT ON COLUMN "public"."trial_lessons"."classin_student_registered_at" IS '试听学生 ClassIn 账号创建/绑定时间';



COMMENT ON COLUMN "public"."trial_lessons"."classin_student_error" IS '试听学生 ClassIn 账号创建失败原因';



COMMENT ON COLUMN "public"."trial_lessons"."student_id" IS '关联正式生ID，用于正式生详情中新试听和权限过滤';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "username" character varying(100) NOT NULL,
    "name" character varying(100) NOT NULL,
    "role" "public"."user_role" DEFAULT 'sales'::"public"."user_role" NOT NULL,
    "phone" character varying(20),
    "wechat" character varying(100),
    "email" character varying(255),
    "team_name" character varying(100),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "classin_uid" integer
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS '用户扩展信息表';



COMMENT ON COLUMN "public"."user_profiles"."id" IS '关联 auth.users 的 ID';



COMMENT ON COLUMN "public"."user_profiles"."role" IS '用户角色（admin, sales, operations, academic, finance）';



CREATE SEQUENCE IF NOT EXISTS "public"."uuid_v7_seq"
    AS integer
    START WITH 0
    INCREMENT BY 1
    MINVALUE 0
    MAXVALUE 4095
    CACHE 1
    CYCLE;


ALTER SEQUENCE "public"."uuid_v7_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "student_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "course_id" "uuid",
    "visit_date" "date" NOT NULL,
    "visit_method" "text",
    "parent_attitude" "text",
    "visit_notes" "text" NOT NULL,
    "visit_personnel" "text" NOT NULL,
    "next_visit_date" "date",
    "created_by" "text",
    "updated_by" "text"
);


ALTER TABLE "public"."visit_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."visit_records" IS '学生回访记录表';



COMMENT ON COLUMN "public"."visit_records"."student_id" IS '关联的学生ID';



COMMENT ON COLUMN "public"."visit_records"."order_id" IS '关联的订单ID（可选）';



COMMENT ON COLUMN "public"."visit_records"."course_id" IS '关联的课程ID（可选）';



COMMENT ON COLUMN "public"."visit_records"."visit_date" IS '回访日期';



COMMENT ON COLUMN "public"."visit_records"."visit_method" IS '回访方式（微信/电话/上门等）';



COMMENT ON COLUMN "public"."visit_records"."parent_attitude" IS '家长态度（满意/一般/不满意等）';



COMMENT ON COLUMN "public"."visit_records"."visit_notes" IS '回访记录内容';



COMMENT ON COLUMN "public"."visit_records"."visit_personnel" IS '回访人员姓名';



COMMENT ON COLUMN "public"."visit_records"."next_visit_date" IS '下次回访计划日期';



CREATE TABLE IF NOT EXISTS "public"."wechat_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "priority" integer DEFAULT 0 NOT NULL,
    "wechat_id" "text" NOT NULL,
    "wechat_name" "text" NOT NULL,
    "responsible_consultant" "text",
    "team" "text",
    "account_type" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "login_password" "text" NOT NULL,
    "payment_password" "text" NOT NULL,
    "real_name_person" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "wechat_accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."wechat_accounts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_operation_logs"
    ADD CONSTRAINT "admin_operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_classin"
    ADD CONSTRAINT "class_classin_pkey" PRIMARY KEY ("course_id");



ALTER TABLE ONLY "public"."class_session_statistics"
    ADD CONSTRAINT "class_session_statistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classin_callback_events"
    ADD CONSTRAINT "classin_callback_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_classin"
    ADD CONSTRAINT "classroom_classin_pkey" PRIMARY KEY ("class_id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_leads"
    ADD CONSTRAINT "daily_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formal_orders"
    ADD CONSTRAINT "formal_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."formal_orders"
    ADD CONSTRAINT "formal_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_report_number_key" UNIQUE ("report_number");



ALTER TABLE ONLY "public"."order_changes"
    ADD CONSTRAINT "order_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_staff"
    ADD CONSTRAINT "sales_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_staff"
    ADD CONSTRAINT "sales_staff_sales_name_join_date_key" UNIQUE ("sales_name", "join_date");



ALTER TABLE ONLY "public"."status_history"
    ADD CONSTRAINT "status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_status_history"
    ADD CONSTRAINT "student_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students_classin"
    ADD CONSTRAINT "students_classin_pkey" PRIMARY KEY ("uid");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_student_code_key" UNIQUE ("student_code");



ALTER TABLE ONLY "public"."sys_dictionaries"
    ADD CONSTRAINT "sys_dictionaries_category_code_key" UNIQUE ("category", "code");



ALTER TABLE ONLY "public"."sys_dictionaries"
    ADD CONSTRAINT "sys_dictionaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_candidates"
    ADD CONSTRAINT "teacher_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_candidates"
    ADD CONSTRAINT "teacher_candidates_wechat_id_key" UNIQUE ("wechat_id");



ALTER TABLE ONLY "public"."teacher_classin"
    ADD CONSTRAINT "teacher_classin_pkey" PRIMARY KEY ("uid");



ALTER TABLE ONLY "public"."teacher_details"
    ADD CONSTRAINT "teacher_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_exception_events"
    ADD CONSTRAINT "teacher_exception_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_teacher_id_issue_code_key" UNIQUE ("teacher_id", "issue_code");



ALTER TABLE ONLY "public"."teacher_interviews"
    ADD CONSTRAINT "teacher_interviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers2"
    ADD CONSTRAINT "teachers2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers2"
    ADD CONSTRAINT "teachers2_teacher_code_key" UNIQUE ("teacher_code");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_teacher_code_key" UNIQUE ("teacher_code");



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_records"
    ADD CONSTRAINT "transaction_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_workflow_events"
    ADD CONSTRAINT "transaction_workflow_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trial_appointments"
    ADD CONSTRAINT "trial_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trial_lessons"
    ADD CONSTRAINT "trial_lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "unique_course_session" UNIQUE ("course_id", "session_number");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "unique_order_course" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_wechat_key" UNIQUE ("wechat");



ALTER TABLE ONLY "public"."visit_records"
    ADD CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wechat_accounts"
    ADD CONSTRAINT "wechat_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wechat_accounts"
    ADD CONSTRAINT "wechat_accounts_wechat_id_key" UNIQUE ("wechat_id");



CREATE INDEX "idx_admin_operation_logs_created_at" ON "public"."admin_operation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_operation_logs_operation" ON "public"."admin_operation_logs" USING "btree" ("operation");



CREATE INDEX "idx_admin_operation_logs_operator_id" ON "public"."admin_operation_logs" USING "btree" ("operator_id");



CREATE INDEX "idx_admin_operation_logs_target_user_id" ON "public"."admin_operation_logs" USING "btree" ("target_user_id");



CREATE INDEX "idx_class_classin_add_time" ON "public"."class_classin" USING "btree" ("add_time");



CREATE INDEX "idx_class_classin_course_name" ON "public"."class_classin" USING "btree" ("course_name");



CREATE INDEX "idx_class_classin_course_state" ON "public"."class_classin" USING "btree" ("course_state");



CREATE INDEX "idx_class_classin_creator_uid" ON "public"."class_classin" USING "btree" ("creator_uid");



CREATE INDEX "idx_class_session_stats_classroom_id" ON "public"."class_session_statistics" USING "btree" ("classroom_id");



CREATE INDEX "idx_class_session_stats_created_at" ON "public"."class_session_statistics" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_class_session_stats_session_id" ON "public"."class_session_statistics" USING "btree" ("session_id");



CREATE INDEX "idx_class_session_stats_student_id" ON "public"."class_session_statistics" USING "btree" ("student_id");



CREATE INDEX "idx_class_sessions_classroom_id" ON "public"."class_sessions" USING "btree" ("classroom_id");



CREATE INDEX "idx_class_sessions_course_id" ON "public"."class_sessions" USING "btree" ("course_id");



CREATE INDEX "idx_class_sessions_scheduled_date" ON "public"."class_sessions" USING "btree" ("scheduled_date");



CREATE INDEX "idx_class_sessions_status" ON "public"."class_sessions" USING "btree" ("status");



CREATE INDEX "idx_classin_callback_events_classin_uid" ON "public"."classin_callback_events" USING "btree" ("classin_uid");



CREATE INDEX "idx_classin_callback_events_classroom_id" ON "public"."classin_callback_events" USING "btree" ("classroom_id");



CREATE INDEX "idx_classin_callback_events_cmd" ON "public"."classin_callback_events" USING "btree" ("cmd");



CREATE INDEX "idx_classin_callback_events_course_id" ON "public"."classin_callback_events" USING "btree" ("course_id");



CREATE INDEX "idx_classin_callback_events_created_at" ON "public"."classin_callback_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_classin_callback_events_event_type" ON "public"."classin_callback_events" USING "btree" ("event_type");



CREATE INDEX "idx_classin_callback_events_session_id" ON "public"."classin_callback_events" USING "btree" ("session_id");



CREATE INDEX "idx_classroom_classin_activity_id" ON "public"."classroom_classin" USING "btree" ("activity_id");



CREATE INDEX "idx_classroom_classin_class_id" ON "public"."classroom_classin" USING "btree" ("class_id");



CREATE INDEX "idx_classroom_classin_course_id" ON "public"."classroom_classin" USING "btree" ("course_id");



CREATE INDEX "idx_classroom_classin_name" ON "public"."classroom_classin" USING "btree" ("name");



CREATE INDEX "idx_classroom_classin_start_time" ON "public"."classroom_classin" USING "btree" ("start_time");



CREATE INDEX "idx_courses_classin_course_id" ON "public"."courses" USING "btree" ("classin_course_id");



CREATE INDEX "idx_courses_order_id" ON "public"."courses" USING "btree" ("order_id");



CREATE INDEX "idx_courses_status" ON "public"."courses" USING "btree" ("course_status");



CREATE INDEX "idx_courses_student_id" ON "public"."courses" USING "btree" ("student_id");



CREATE INDEX "idx_courses_teacher_id" ON "public"."courses" USING "btree" ("teacher_id");



CREATE INDEX "idx_daily_leads_assigned_person" ON "public"."daily_leads" USING "btree" ("assigned_person");



CREATE INDEX "idx_daily_leads_is_added" ON "public"."daily_leads" USING "btree" ("is_added");



CREATE INDEX "idx_daily_leads_name" ON "public"."daily_leads" USING "btree" ("name");



CREATE INDEX "idx_daily_leads_received_date" ON "public"."daily_leads" USING "btree" ("received_date" DESC);



CREATE INDEX "idx_daily_leads_wechat_number" ON "public"."daily_leads" USING "btree" ("wechat_number");



CREATE INDEX "idx_formal_orders_first_class_time" ON "public"."formal_orders" USING "btree" ("first_class_time" DESC);



CREATE INDEX "idx_formal_orders_order_number" ON "public"."formal_orders" USING "btree" ("order_number");



CREATE INDEX "idx_formal_orders_payment_time" ON "public"."formal_orders" USING "btree" ("payment_time" DESC);



CREATE INDEX "idx_formal_orders_status" ON "public"."formal_orders" USING "btree" ("status");



CREATE INDEX "idx_formal_orders_student_id" ON "public"."formal_orders" USING "btree" ("student_id");



CREATE INDEX "idx_formal_orders_subjects" ON "public"."formal_orders" USING "gin" ("subjects");



CREATE INDEX "idx_formal_orders_teacher_names" ON "public"."formal_orders" USING "gin" ("teacher_names");



CREATE UNIQUE INDEX "idx_formal_orders_trial_lesson_id_unique" ON "public"."formal_orders" USING "btree" ("trial_lesson_id") WHERE ("trial_lesson_id" IS NOT NULL);



CREATE INDEX "idx_leads_channel_social" ON "public"."leads" USING "btree" ("channel_platform", "customer_social_id") WHERE (("channel_platform" IS NOT NULL) AND ("customer_social_id" IS NOT NULL));



CREATE UNIQUE INDEX "idx_leads_report_number_unique" ON "public"."leads" USING "btree" ("report_number");



CREATE INDEX "idx_sales_staff_leader" ON "public"."sales_staff" USING "btree" ("sales_leader");



CREATE INDEX "idx_sales_staff_status" ON "public"."sales_staff" USING "btree" ("employment_status");



CREATE INDEX "idx_sales_staff_team" ON "public"."sales_staff" USING "btree" ("team");



CREATE INDEX "idx_student_status_history_changed_at" ON "public"."student_status_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_student_status_history_student_id" ON "public"."student_status_history" USING "btree" ("student_id");



CREATE INDEX "idx_students_classin_account_status" ON "public"."students_classin" USING "btree" ("account_status");



CREATE INDEX "idx_students_classin_isdel" ON "public"."students_classin" USING "btree" ("isdel");



CREATE INDEX "idx_students_classin_mobile" ON "public"."students_classin" USING "btree" ("mobile");



CREATE INDEX "idx_students_classin_serve_state" ON "public"."students_classin" USING "btree" ("serve_state");



CREATE INDEX "idx_students_classin_stud_id" ON "public"."students_classin" USING "btree" ("stud_id");



CREATE INDEX "idx_students_classin_stuno" ON "public"."students_classin" USING "btree" ("stuno");



CREATE INDEX "idx_students_classin_uid" ON "public"."students" USING "btree" ("classin_uid");



CREATE INDEX "idx_students_created_at" ON "public"."students" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_students_grade_code" ON "public"."students" USING "btree" ("grade_code");



CREATE INDEX "idx_students_parent_phone" ON "public"."students" USING "btree" ("parent_phone");



CREATE INDEX "idx_students_region" ON "public"."students" USING "btree" ("region");



CREATE INDEX "idx_students_status" ON "public"."students" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_students_student_code" ON "public"."students" USING "btree" ("student_code");



CREATE INDEX "idx_teacher_candidates_daily_lead_id" ON "public"."teacher_candidates" USING "btree" ("daily_lead_id");



CREATE INDEX "idx_teacher_candidates_grade_level_rates" ON "public"."teacher_candidates" USING "gin" ("grade_level_rates");



CREATE INDEX "idx_teacher_candidates_grade_level_settings" ON "public"."teacher_candidates" USING "gin" ("grade_level_settings");



CREATE INDEX "idx_teacher_candidates_interview_date" ON "public"."teacher_candidates" USING "btree" ("interview_date");



CREATE INDEX "idx_teacher_candidates_interview_result" ON "public"."teacher_candidates" USING "btree" ("interview_result");



CREATE INDEX "idx_teacher_candidates_is_hired" ON "public"."teacher_candidates" USING "btree" ("is_hired");



CREATE INDEX "idx_teacher_candidates_name" ON "public"."teacher_candidates" USING "btree" ("name");



CREATE INDEX "idx_teacher_candidates_phone" ON "public"."teacher_candidates" USING "btree" ("phone");



CREATE INDEX "idx_teacher_candidates_review_status" ON "public"."teacher_candidates" USING "btree" ("review_status");



CREATE INDEX "idx_teacher_candidates_wechat_id" ON "public"."teacher_candidates" USING "btree" ("wechat_id");



CREATE INDEX "idx_teacher_classin_account_status" ON "public"."teacher_classin" USING "btree" ("account_status");



CREATE INDEX "idx_teacher_classin_is_del" ON "public"."teacher_classin" USING "btree" ("is_del");



CREATE INDEX "idx_teacher_classin_mobile" ON "public"."teacher_classin" USING "btree" ("mobile");



CREATE INDEX "idx_teacher_classin_st_id" ON "public"."teacher_classin" USING "btree" ("st_id");



CREATE INDEX "idx_teacher_details_candidate_id" ON "public"."teacher_details" USING "btree" ("candidate_id");



CREATE UNIQUE INDEX "idx_teacher_details_candidate_once" ON "public"."teacher_details" USING "btree" ("candidate_id") WHERE ("candidate_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_teacher_details_candidate_once" IS '同一个老师候选人只能提交一次公开信息采集表';



CREATE INDEX "idx_teacher_details_classin_phone" ON "public"."teacher_details" USING "btree" ("classin_phone");



CREATE INDEX "idx_teacher_details_created_at" ON "public"."teacher_details" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_teacher_details_wechat" ON "public"."teacher_details" USING "btree" ("wechat");



CREATE INDEX "idx_teacher_exception_events_exception_id" ON "public"."teacher_exception_events" USING "btree" ("exception_id", "created_at" DESC);



CREATE INDEX "idx_teacher_exception_events_teacher_id" ON "public"."teacher_exception_events" USING "btree" ("teacher_id", "created_at" DESC);



CREATE INDEX "idx_teacher_exceptions_severity" ON "public"."teacher_exceptions" USING "btree" ("severity");



CREATE INDEX "idx_teacher_exceptions_status" ON "public"."teacher_exceptions" USING "btree" ("status");



CREATE INDEX "idx_teacher_exceptions_teacher_id" ON "public"."teacher_exceptions" USING "btree" ("teacher_id");



CREATE INDEX "idx_teacher_exceptions_updated_at" ON "public"."teacher_exceptions" USING "btree" ("updated_at" DESC);



CREATE UNIQUE INDEX "idx_teacher_profiles_classin_uid" ON "public"."teacher_profiles" USING "btree" ("classin_uid");



CREATE INDEX "idx_teacher_profiles_mobile" ON "public"."teacher_profiles" USING "btree" ("mobile");



CREATE INDEX "idx_teachers_candidate_id" ON "public"."teachers" USING "btree" ("candidate_id");



CREATE INDEX "idx_teachers_classin_phone" ON "public"."teachers" USING "btree" ("classin_phone");



CREATE UNIQUE INDEX "idx_teachers_classin_uid" ON "public"."teachers" USING "btree" ("classin_uid");



CREATE INDEX "idx_teachers_mobile" ON "public"."teachers" USING "btree" ("mobile");



CREATE INDEX "idx_teachers_status" ON "public"."teachers" USING "btree" ("status");



CREATE INDEX "idx_teachers_teacher_level" ON "public"."teachers" USING "btree" ("teacher_level");



CREATE INDEX "idx_teachers_wechat" ON "public"."teachers" USING "btree" ("wechat");



CREATE INDEX "idx_todos_assigned_to" ON "public"."todos" USING "btree" ("assigned_to");



CREATE INDEX "idx_todos_created_by" ON "public"."todos" USING "btree" ("created_by");



CREATE INDEX "idx_todos_due_date" ON "public"."todos" USING "btree" ("due_date");



CREATE INDEX "idx_todos_entity" ON "public"."todos" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_todos_priority" ON "public"."todos" USING "btree" ("priority");



CREATE INDEX "idx_todos_status" ON "public"."todos" USING "btree" ("status");



CREATE INDEX "idx_transaction_records_creation_date" ON "public"."transaction_records" USING "btree" ("creation_date" DESC);



CREATE INDEX "idx_transaction_records_order_id" ON "public"."transaction_records" USING "btree" ("order_id");



CREATE INDEX "idx_transaction_records_order_type" ON "public"."transaction_records" USING "btree" ("order_type");



CREATE INDEX "idx_transaction_records_status" ON "public"."transaction_records" USING "btree" ("status");



CREATE INDEX "idx_transaction_records_student_id" ON "public"."transaction_records" USING "btree" ("student_id");



CREATE INDEX "idx_transaction_records_student_name" ON "public"."transaction_records" USING "btree" ("student_name");



CREATE INDEX "idx_transaction_records_teacher_name" ON "public"."transaction_records" USING "btree" ("teacher_name");



CREATE INDEX "idx_transaction_records_transaction_type" ON "public"."transaction_records" USING "btree" ("transaction_type");



CREATE INDEX "idx_transaction_workflow_events_action" ON "public"."transaction_workflow_events" USING "btree" ("action");



CREATE INDEX "idx_transaction_workflow_events_actor_id" ON "public"."transaction_workflow_events" USING "btree" ("actor_id");



CREATE INDEX "idx_transaction_workflow_events_transaction_id" ON "public"."transaction_workflow_events" USING "btree" ("transaction_id", "created_at" DESC);



CREATE INDEX "idx_trial_lessons_child_name" ON "public"."trial_lessons" USING "btree" ("child_name");



CREATE INDEX "idx_trial_lessons_classin_student_uid" ON "public"."trial_lessons" USING "btree" ("classin_student_uid");



CREATE INDEX "idx_trial_lessons_grade" ON "public"."trial_lessons" USING "btree" ("grade");



CREATE INDEX "idx_trial_lessons_lead_id" ON "public"."trial_lessons" USING "btree" ("lead_id");



CREATE INDEX "idx_trial_lessons_region" ON "public"."trial_lessons" USING "btree" ("region");



CREATE INDEX "idx_trial_lessons_status" ON "public"."trial_lessons" USING "btree" ("status");



CREATE INDEX "idx_trial_lessons_student_id" ON "public"."trial_lessons" USING "btree" ("student_id");



CREATE INDEX "idx_trial_lessons_trial_time" ON "public"."trial_lessons" USING "btree" ("trial_time" DESC);



CREATE INDEX "idx_trial_lessons_urgency" ON "public"."trial_lessons" USING "btree" ("urgency_level");



CREATE INDEX "idx_user_profiles_is_active" ON "public"."user_profiles" USING "btree" ("is_active");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("id");



CREATE INDEX "idx_visit_records_course_id" ON "public"."visit_records" USING "btree" ("course_id");



CREATE INDEX "idx_visit_records_order_id" ON "public"."visit_records" USING "btree" ("order_id");



CREATE INDEX "idx_visit_records_student_date" ON "public"."visit_records" USING "btree" ("student_id", "visit_date" DESC);



CREATE INDEX "idx_visit_records_student_id" ON "public"."visit_records" USING "btree" ("student_id");



CREATE INDEX "idx_visit_records_visit_date" ON "public"."visit_records" USING "btree" ("visit_date" DESC);



CREATE INDEX "idx_visit_records_visit_personnel" ON "public"."visit_records" USING "btree" ("visit_personnel");



CREATE INDEX "idx_wechat_accounts_priority" ON "public"."wechat_accounts" USING "btree" ("priority" DESC);



CREATE INDEX "idx_wechat_accounts_status" ON "public"."wechat_accounts" USING "btree" ("status");



CREATE INDEX "idx_wechat_accounts_team" ON "public"."wechat_accounts" USING "btree" ("team");



CREATE INDEX "teachers2_candidate_id_idx" ON "public"."teachers2" USING "btree" ("candidate_id");



CREATE UNIQUE INDEX "teachers2_classin_uid_idx" ON "public"."teachers2" USING "btree" ("classin_uid");



CREATE INDEX "teachers2_mobile_idx" ON "public"."teachers2" USING "btree" ("mobile");



CREATE INDEX "teachers2_status_idx" ON "public"."teachers2" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "set_formal_orders_order_number" BEFORE INSERT ON "public"."formal_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();

ALTER TABLE "public"."formal_orders" DISABLE TRIGGER "set_formal_orders_order_number";



CREATE OR REPLACE TRIGGER "trigger_class_sessions_updated_at" BEFORE UPDATE ON "public"."class_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_class_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_courses_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."update_courses_updated_at"();



CREATE OR REPLACE TRIGGER "update_class_classin_updated_at" BEFORE UPDATE ON "public"."class_classin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_classroom_classin_updated_at" BEFORE UPDATE ON "public"."classroom_classin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_daily_leads_updated_at" BEFORE UPDATE ON "public"."daily_leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_formal_orders_updated_at" BEFORE UPDATE ON "public"."formal_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sales_staff_updated_at" BEFORE UPDATE ON "public"."sales_staff" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_students_classin_updated_at" BEFORE UPDATE ON "public"."students_classin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_students_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teacher_candidates_updated_at" BEFORE UPDATE ON "public"."teacher_candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teacher_classin_updated_at" BEFORE UPDATE ON "public"."teacher_classin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teachers_updated_at" BEFORE UPDATE ON "public"."teachers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_todos_updated_at" BEFORE UPDATE ON "public"."todos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transaction_records_updated_at" BEFORE UPDATE ON "public"."transaction_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trial_lessons_updated_at" BEFORE UPDATE ON "public"."trial_lessons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_visit_records_updated_at" BEFORE UPDATE ON "public"."visit_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_wechat_accounts_updated_at" BEFORE UPDATE ON "public"."wechat_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_operation_logs"
    ADD CONSTRAINT "admin_operation_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_operation_logs"
    ADD CONSTRAINT "admin_operation_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom_classin"("class_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classin_callback_events"
    ADD CONSTRAINT "classin_callback_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_classin_course_id_fkey" FOREIGN KEY ("classin_course_id") REFERENCES "public"."class_classin"("course_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."formal_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_session_statistics"
    ADD CONSTRAINT "fk_session_id" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_status_history"
    ADD CONSTRAINT "fk_student_status_history_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."formal_orders"
    ADD CONSTRAINT "formal_orders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."formal_orders"
    ADD CONSTRAINT "formal_orders_previous_order_id_fkey" FOREIGN KEY ("previous_order_id") REFERENCES "public"."formal_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."formal_orders"
    ADD CONSTRAINT "formal_orders_trial_lesson_id_fkey" FOREIGN KEY ("trial_lesson_id") REFERENCES "public"."trial_lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_grab_user_id_fkey" FOREIGN KEY ("grab_user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."teacher_candidates"
    ADD CONSTRAINT "teacher_candidates_daily_lead_id_fkey" FOREIGN KEY ("daily_lead_id") REFERENCES "public"."daily_leads"("id");



ALTER TABLE ONLY "public"."teacher_candidates"
    ADD CONSTRAINT "teacher_candidates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."teacher_details"
    ADD CONSTRAINT "teacher_details_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."teacher_candidates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_exception_events"
    ADD CONSTRAINT "teacher_exception_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_exception_events"
    ADD CONSTRAINT "teacher_exception_events_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "public"."teacher_exceptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_exception_events"
    ADD CONSTRAINT "teacher_exception_events_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_exceptions"
    ADD CONSTRAINT "teacher_exceptions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teachers2"
    ADD CONSTRAINT "teachers2_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."teacher_candidates"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."teacher_candidates"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_records"
    ADD CONSTRAINT "transaction_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."formal_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_records"
    ADD CONSTRAINT "transaction_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_workflow_events"
    ADD CONSTRAINT "transaction_workflow_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trial_lessons"
    ADD CONSTRAINT "trial_lessons_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id");



ALTER TABLE ONLY "public"."trial_lessons"
    ADD CONSTRAINT "trial_lessons_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "All authenticated users can view operation_logs" ON "public"."admin_operation_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All authenticated users can view user_profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete class_classin" ON "public"."class_classin" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete classroom_classin" ON "public"."classroom_classin" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete daily leads" ON "public"."daily_leads" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete formal orders" ON "public"."formal_orders" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete sales staff" ON "public"."sales_staff" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete students" ON "public"."students" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete students_classin" ON "public"."students_classin" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete teacher candidates" ON "public"."teacher_candidates" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete teacher_classin" ON "public"."teacher_classin" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete transaction records" ON "public"."transaction_records" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete trial lessons" ON "public"."trial_lessons" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete visit records" ON "public"."visit_records" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete wechat accounts" ON "public"."wechat_accounts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert class_classin" ON "public"."class_classin" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert classroom_classin" ON "public"."classroom_classin" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert daily leads" ON "public"."daily_leads" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert formal orders" ON "public"."formal_orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert sales staff" ON "public"."sales_staff" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert session statistics" ON "public"."class_session_statistics" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert student status history" ON "public"."student_status_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert students" ON "public"."students" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert students_classin" ON "public"."students_classin" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert teacher candidates" ON "public"."teacher_candidates" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert teacher_classin" ON "public"."teacher_classin" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert transaction records" ON "public"."transaction_records" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert transaction workflow events" ON "public"."transaction_workflow_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert trial lessons" ON "public"."trial_lessons" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert visit records" ON "public"."visit_records" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert wechat accounts" ON "public"."wechat_accounts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update class_classin" ON "public"."class_classin" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update classroom_classin" ON "public"."classroom_classin" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update daily leads" ON "public"."daily_leads" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update formal orders" ON "public"."formal_orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update sales staff" ON "public"."sales_staff" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update session statistics" ON "public"."class_session_statistics" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update students" ON "public"."students" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update students_classin" ON "public"."students_classin" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update teacher candidates" ON "public"."teacher_candidates" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update teacher_classin" ON "public"."teacher_classin" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update transaction records" ON "public"."transaction_records" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update trial lessons" ON "public"."trial_lessons" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update visit records" ON "public"."visit_records" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update wechat accounts" ON "public"."wechat_accounts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view ClassIn callback events" ON "public"."classin_callback_events" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view class_classin" ON "public"."class_classin" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view classroom_classin" ON "public"."classroom_classin" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view daily leads" ON "public"."daily_leads" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view formal orders" ON "public"."formal_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view sales staff" ON "public"."sales_staff" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view session statistics" ON "public"."class_session_statistics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view student status history" ON "public"."student_status_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view students" ON "public"."students" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view students_classin" ON "public"."students_classin" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view teacher candidates" ON "public"."teacher_candidates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view teacher exception events" ON "public"."teacher_exception_events" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view teacher exceptions" ON "public"."teacher_exceptions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view teacher_classin" ON "public"."teacher_classin" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view transaction records" ON "public"."transaction_records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view transaction workflow events" ON "public"."transaction_workflow_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view trial lessons" ON "public"."trial_lessons" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view visit records" ON "public"."visit_records" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view wechat accounts" ON "public"."wechat_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can manage ClassIn callback events" ON "public"."classin_callback_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage teacher exception events" ON "public"."teacher_exception_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage teacher exceptions" ON "public"."teacher_exceptions" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Super admins can manage user_profiles" ON "public"."user_profiles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE (("user_profiles_1"."id" = "auth"."uid"()) AND ("user_profiles_1"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE (("user_profiles_1"."id" = "auth"."uid"()) AND ("user_profiles_1"."role" = 'admin'::"public"."user_role")))));



ALTER TABLE "public"."class_session_statistics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classin_callback_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_exception_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_interviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_workflow_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trial_appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "允许所有人提交表单" ON "public"."teacher_details" FOR INSERT WITH CHECK (true);



CREATE POLICY "允许管理员删除老师详细信息" ON "public"."teacher_details" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "允许管理员更新老师详细信息" ON "public"."teacher_details" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "允许认证用户读取老师详细信息" ON "public"."teacher_details" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "创建人可以删除自己的待办" ON "public"."todos" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "用户只能看到分配给自己的待办" ON "public"."todos" FOR SELECT USING (("assigned_to" = "auth"."uid"()));



CREATE POLICY "用户可以更新分配给自己的待办" ON "public"."todos" FOR UPDATE USING (("assigned_to" = "auth"."uid"())) WITH CHECK (("assigned_to" = "auth"."uid"()));



CREATE POLICY "管理员可以查看所有待办" ON "public"."todos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "运营和管理员可以创建待办" ON "public"."todos" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND ("assigned_by" = "auth"."uid"())));



CREATE PUBLICATION "logflare_pub" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "logflare_pub" OWNER TO "supabase_admin";




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."generate_lead_report_number"("channel_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_lead_report_number"("channel_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_lead_report_number"("channel_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_sequence"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_sequence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_sequence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_report_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_report_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_report_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_student_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_student_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_student_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_teacher_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_teacher_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_teacher_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_by_phone"("p_phone" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_by_phone"("p_phone" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_by_phone"("p_phone" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."log_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_student_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_student_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_student_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_class_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_class_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_class_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_courses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_courses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_courses_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."uuid_generate_v7"() TO "anon";
GRANT ALL ON FUNCTION "public"."uuid_generate_v7"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uuid_generate_v7"() TO "service_role";




































GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_operation_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_operation_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_operation_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_classin" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_classin" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_classin" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_session_statistics" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_session_statistics" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_session_statistics" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_sessions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_sessions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."class_sessions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."classin_callback_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."classin_callback_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."classin_callback_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."classroom_classin" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."classroom_classin" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."classroom_classin" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."courses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."courses" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."courses" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."daily_leads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."daily_leads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."daily_leads" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."formal_orders" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."formal_orders" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."formal_orders" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leads_report_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leads_report_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leads_report_number_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."order_changes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."order_changes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."order_changes" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sales_staff" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sales_staff" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sales_staff" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."status_history" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."status_history" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."status_history" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."student_status_history" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."student_status_history" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."student_status_history" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."students" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."students" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."students" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."students_classin" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."students_classin" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."students_classin" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sys_dictionaries" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sys_dictionaries" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sys_dictionaries" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_candidates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_candidates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_candidates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_classin" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_classin" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_classin" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_code_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_details" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_details" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_details" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_exception_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_exception_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_exception_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_exceptions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_exceptions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_exceptions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_interviews" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_interviews" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_interviews" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teacher_profiles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teachers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teachers" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teachers" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teachers2" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teachers2" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teachers2" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transaction_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transaction_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transaction_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transaction_workflow_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transaction_workflow_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."transaction_workflow_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."trial_appointments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."trial_appointments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."trial_appointments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."trial_lessons" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."trial_lessons" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."trial_lessons" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."uuid_v7_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."uuid_v7_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."uuid_v7_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."visit_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."visit_records" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."visit_records" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."wechat_accounts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."wechat_accounts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."wechat_accounts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";































