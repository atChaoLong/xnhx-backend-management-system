/**
 * ClassIn 回调消息处理器
 * 处理来自 ClassIn 的各种回调消息
 */

import { ClassInCallbackData, MessageHandler } from './callback-types';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { summarizeError } from '@/lib/safe-error';

const logger = createLogger('ClassIn:Callback');

// ClassIn 安全密钥，从环境变量获取
const CLASSIN_SECRET = process.env.CLASSIN_SECRET || 'your-secret-key';

type CallbackEventOptions = {
  eventType: string;
  details?: Record<string, any>;
};

function parseJsonMessage(data: ClassInCallbackData): Record<string, any> | null {
  if (typeof data.Msg !== 'string' || !data.Msg.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(data.Msg);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed };
  } catch {
    return null;
  }
}

function removeSensitiveCallbackFields(data: ClassInCallbackData): Record<string, any> {
  const { SafeKey: _safeKey, ...safeData } = data;
  return safeData;
}

function getFirstValue(data: ClassInCallbackData, msgData: Record<string, any> | null, keys: string[]): any {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return data[key];
    }
    if (msgData?.[key] !== undefined && msgData[key] !== null && msgData[key] !== '') {
      return msgData[key];
    }
  }

  return null;
}

function toNullableNumber(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getCallbackEventTime(data: ClassInCallbackData, msgData: Record<string, any> | null): string | null {
  const timestamp = toNullableNumber(getFirstValue(data, msgData, [
    'TimeStamp',
    'timestamp',
    'time',
    'Time',
    'StartTime',
  ]));

  if (!timestamp) {
    return null;
  }

  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function findCallbackSessionId(
  data: ClassInCallbackData,
  msgData: Record<string, any> | null,
  classId: number | null,
  courseId: number | null
): Promise<string | null> {
  try {
    if (classId) {
      const { data: session, error } = await supabaseServer
        .from('class_sessions')
        .select('id')
        .eq('classroom_id', classId.toString())
        .maybeSingle();

      if (error) {
        logger.warn('按 ClassIn 课堂 ID 匹配课节失败', {
          classroomId: classId,
          ...summarizeError(error),
        });
      } else if (session?.id) {
        return session.id;
      }
    }

    if (!courseId) {
      return null;
    }

    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select('id')
      .eq('classin_course_id', String(courseId))
      .maybeSingle();

    if (courseError || !course?.id) {
      if (courseError) {
        logger.warn('按 ClassIn 课程 ID 匹配本地课程失败', {
          courseId,
          ...summarizeError(courseError),
        });
      }
      return null;
    }

    const startTime = toNullableNumber(getFirstValue(data, msgData, ['StartTime', 'startTime', 'start_time']));
    let query = supabaseServer
      .from('class_sessions')
      .select('id')
      .eq('course_id', course.id)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time_start', { ascending: false })
      .limit(1);

    if (startTime) {
      query = query.lte('scheduled_date', new Date(startTime * 1000).toISOString());
    }

    const { data: session, error: sessionError } = await query.maybeSingle();

    if (sessionError) {
      logger.warn('按 ClassIn 课程 ID 匹配课节失败', {
        courseId,
        localCourseId: course.id,
        ...summarizeError(sessionError),
      });
      return null;
    }

    return session?.id || null;
  } catch (error: unknown) {
    logger.warn('匹配 ClassIn 回调课节异常', summarizeError(error));
    return null;
  }
}

async function persistCallbackEvent(data: ClassInCallbackData, options: CallbackEventOptions): Promise<void> {
  const msgData = parseJsonMessage(data);
  const classId = toNullableNumber(getFirstValue(data, msgData, ['ClassID', 'classId', 'class_id', 'ClassId']));
  const courseId = toNullableNumber(getFirstValue(data, msgData, ['CourseID', 'courseId', 'course_id', 'CourseId']));
  const activityId = toNullableNumber(getFirstValue(data, msgData, ['ActivityID', 'activityId', 'activity_id', 'ActivityId']));
  const classinUid = toNullableNumber(getFirstValue(data, msgData, ['UID', 'uid', 'UserID', 'userId', 'user_id']));
  const sid = toNullableNumber(data.SID);

  try {
    const sessionId = await findCallbackSessionId(data, msgData, classId, courseId);
    const { error } = await supabaseServer
      .from('classin_callback_events')
      .insert({
        event_type: options.eventType,
        cmd: data.Cmd,
        sid,
        classin_uid: classinUid,
        course_id: courseId,
        classroom_id: classId,
        activity_id: activityId,
        session_id: sessionId,
        event_time: getCallbackEventTime(data, msgData),
        payload: {
          callback: removeSensitiveCallbackFields(data),
          parsed_msg: msgData,
          details: options.details || {},
        },
      });

    if (error) {
      logger.warn('保存 ClassIn 回调事件失败', {
        eventType: options.eventType,
        cmd: data.Cmd,
        ...summarizeError(error),
      });
      return;
    }

    logger.info('ClassIn 回调事件已保存', {
      eventType: options.eventType,
      cmd: data.Cmd,
      sessionId,
      hasClassinUid: Boolean(classinUid),
    });
  } catch (error: unknown) {
    logger.warn('保存 ClassIn 回调事件异常', {
      eventType: options.eventType,
      cmd: data.Cmd,
      ...summarizeError(error),
    });
  }
}

function summarizeCallbackData(data: ClassInCallbackData) {
  const fields = Object.keys(data || {})
    .filter((field) => field !== 'SafeKey' && field !== 'Msg')
    .sort();

  return {
    cmd: data?.Cmd,
    sid: data?.SID,
    class_id: data?.ClassID || data?.classId,
    course_id: data?.CourseID || data?.courseId,
    timestamp: data?.TimeStamp,
    has_uid: data?.UID !== undefined,
    has_msg: Boolean(data?.Msg),
    msg_length: typeof data?.Msg === 'string' ? data.Msg.length : undefined,
    has_safe_key: Boolean(data?.SafeKey),
    fields,
  };
}

function logCallbackHandler(messageType: string, data: ClassInCallbackData): void {
  logger.debug(`处理${messageType}`, summarizeCallbackData(data));
}

/**
 * 验证安全密钥
 * @param safeKey 接收到的安全密钥
 * @param timeStamp 时间戳
 * @returns 验证结果
 */
export function verifySafeKey(safeKey: string, timeStamp: number): boolean {
  try {
    const expectedSafeKey = crypto
      .createHash('md5')
      .update(CLASSIN_SECRET + timeStamp)
      .digest('hex');

    return safeKey === expectedSafeKey;
  } catch (error: unknown) {
    logger.error('SafeKey 验证异常', summarizeError(error));
    return false;
  }
}

/**
 * 记录收到的消息
 * @param messageType 消息类型
 * @param data 消息数据
 */
function logMessage(messageType: string, data: ClassInCallbackData): void {
  logger.debug('收到 ClassIn 回调消息', {
    message_type: messageType,
    ...summarizeCallbackData(data),
  });
}

/**
 * 处理举手消息
 */
async function handleRaiseHand(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('举手消息', data);
  await persistCallbackEvent(data, { eventType: 'raise_hand' });
}

/**
 * 处理奖励消息
 */
async function handleReward(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('奖励消息', data);
  await persistCallbackEvent(data, { eventType: 'reward' });
}

/**
 * 处理进入教室消息
 */
async function handleEnterRoom(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('进入教室消息', data);
  await persistCallbackEvent(data, { eventType: 'enter_room' });
}

/**
 * 处理退出教室消息
 */
async function handleLeaveRoom(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('退出教室消息', data);
  await persistCallbackEvent(data, { eventType: 'leave_room' });
}

/**
 * 处理授权消息
 */
async function handleAuth(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('授权消息', data);
  await persistCallbackEvent(data, { eventType: 'auth' });
}

/**
 * 处理全体静音消息
 */
async function handleMuteAll(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('全体静音消息', data);
  await persistCallbackEvent(data, { eventType: 'mute_all' });
}

/**
 * 处理个人静音消息
 */
async function handleMute(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('个人静音消息', data);
  await persistCallbackEvent(data, { eventType: 'mute' });
}

/**
 * 处理答题器消息
 */
async function handleAnswer(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('答题器消息', data);
  await persistCallbackEvent(data, { eventType: 'answer' });
}

/**
 * 处理抢答器消息
 */
async function handleGrab(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('抢答器消息', data);
  await persistCallbackEvent(data, { eventType: 'grab' });
}

/**
 * 处理上下台消息
 */
async function handleOnStage(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('上下台消息', data);
  await persistCallbackEvent(data, { eventType: 'on_stage' });
}

/**
 * 处理课节网络状态
 */
async function handleNetworkStatus(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('课节网络状态', data);
  await persistCallbackEvent(data, { eventType: 'network_status' });
}

/**
 * 处理设备检测消息
 */
async function handleDeviceCheck(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('设备检测消息', data);
  await persistCallbackEvent(data, { eventType: 'device_check' });
}

/**
 * 处理求助消息
 */
async function handleHelp(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('求助消息', data);
  await persistCallbackEvent(data, { eventType: 'help' });
}

/**
 * 处理延长课节时长消息
 */
async function handleExtendLesson(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('延长课节时长消息', data);
  await persistCallbackEvent(data, { eventType: 'extend_lesson' });
}

/**
 * 处理启动录课详情
 */
async function handleRecordStart(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('启动录课详情', data);
  await persistCallbackEvent(data, { eventType: 'record_start' });
}

/**
 * 处理大黑板板书图片
 */
async function handleBlackboardImage(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('大黑板板书图片', data);
  await persistCallbackEvent(data, { eventType: 'blackboard_image' });
}

/**
 * 处理直播相关消息
 */
async function handleLive(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('直播相关消息', data);
  await persistCallbackEvent(data, { eventType: 'live' });
}

/**
 * 处理课后汇总数据
 * 更新课节状态并计算课时消耗
 */
async function handleLessonSummary(data: ClassInCallbackData): Promise<void> {
  try {
    logger.info('收到课后汇总回调', summarizeCallbackData(data));

    // 从 Msg 中解析数据（可能是 JSON 字符串）
    let msgData: any = {};
    if (typeof data.Msg === 'string') {
      try {
        msgData = JSON.parse(data.Msg);
      } catch (e) {
        logger.warn('解析 Msg 数据失败', summarizeCallbackData(data));
      }
    } else {
      msgData = data;
    }

    const classId = msgData.class_id || data.classId;
    const activityId = msgData.activity_id || data.activityId;

    if (!classId) {
      logger.warn('课后汇总缺少 class_id', summarizeCallbackData(data));
      return;
    }

    // 1. 根据 classroom_classin 查找对应的课节
    const { data: classroomClassin, error: classroomError } = await supabaseServer
      .from('classroom_classin')
      .select('class_id')
      .eq('class_id', String(classId))
      .maybeSingle();

    if (classroomError || !classroomClassin) {
      logger.warn('未找到对应的 classroom_classin 记录', {
        classId,
        hasDbError: Boolean(classroomError),
        ...(classroomError ? summarizeError(classroomError) : {}),
      });
      return;
    }

    // 2. 查找课节记录
    const { data: session, error: sessionError } = await supabaseServer
      .from('class_sessions')
      .select('id, course_id, scheduled_duration_minutes, teacher_id, teacher_name')
      .eq('classroom_id', String(classId))
      .single();

    if (sessionError || !session) {
      logger.warn('未找到对应的课节记录', {
        classId,
        hasDbError: Boolean(sessionError),
        ...(sessionError ? summarizeError(sessionError) : {}),
      });
      return;
    }

    logger.info('找到课节记录', { sessionId: session.id, courseId: session.course_id });

    // 3. 更新课节状态为已完成
    const actualEndTime = new Date().toISOString();
    const { error: updateError } = await supabaseServer
      .from('class_sessions')
      .update({
        status: 'completed',
        actual_end_time: actualEndTime,
        // 如果有实际开始时间，计算实际时长
        actual_duration_minutes: session.scheduled_duration_minutes,
      })
      .eq('id', session.id);

    if (updateError) {
      logger.error('更新课节状态失败', {
        sessionId: session.id,
        ...summarizeError(updateError),
      });
      return;
    }

    logger.info('课节状态已更新为已完成', { sessionId: session.id });

    // 4. 更新课程的统计信息
    await updateCourseStats(session.course_id);

    // 5. 记录老师课时消耗
    // 通过 teacher_name 查找 teachers 表中的记录
    if (session.teacher_name) {
      await updateTeacherHoursByName(session.teacher_name, session.scheduled_duration_minutes);
    }

    logger.info('课消处理完成', {
      sessionId: session.id,
      courseId: session.course_id,
      teacherId: session.teacher_id,
    });

  } catch (error: unknown) {
    logger.error('处理课后汇总时出错', summarizeError(error));
    // 不抛出错误，避免影响 ClassIn 回调
  }
}

/**
 * 更新课程统计信息
 */
async function updateCourseStats(courseId: string): Promise<void> {
  try {
    // 获取该课程的所有课节
    const { data: allSessions, error: sessionsError } = await supabaseServer
      .from('class_sessions')
      .select('id, status, scheduled_date, scheduled_time_start, scheduled_time_end')
      .eq('course_id', courseId);

    if (sessionsError) {
      logger.warn('获取课程所有课节失败', {
        courseId,
        ...summarizeError(sessionsError),
      });
      return;
    }

    // 统计课程信息
    const totalSessions = allSessions?.length || 0;
    const completedSessions = allSessions?.filter((s: any) => s.status === 'completed').length || 0;
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    // 获取最后上课日期
    let lastSessionDate = null;
    if (allSessions && allSessions.length > 0) {
      const sortedByDate = [...allSessions].sort((a: any, b: any) =>
        new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
      );
      lastSessionDate = sortedByDate[0].scheduled_date;
    }

    // 更新课程统计信息
    const consumptionInfo = {
      totalSessions,
      completedSessions,
      progress,
      lastSessionDate,
      lastSyncTime: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseServer
      .from('courses')
      .update({
        session_count: totalSessions,
        course_consumption_info: JSON.stringify(consumptionInfo),
      })
      .eq('id', courseId);

    if (updateError) {
      logger.warn('更新课程统计信息失败', {
        courseId,
        ...summarizeError(updateError),
      });
    } else {
      logger.info('课程统计信息已更新', { courseId, totalSessions, completedSessions, progress });
    }
  } catch (error: unknown) {
    logger.warn('更新课程统计信息异常', summarizeError(error));
  }
}

/**
 * 更新老师课时消耗（通过老师名称）
 */
async function updateTeacherHoursByName(teacherName: string, minutes: number): Promise<void> {
  try {
    // 将分钟转换为小时（保留2位小数）
    const hours = Math.round((minutes / 60) * 100) / 100;

    // 通过老师名称查找 teachers 表中的记录
    const { data: teacher, error: fetchError } = await supabaseServer
      .from('teachers')
      .select('id, total_hours, name')
      .eq('name', teacherName)
      .maybeSingle();

    if (fetchError) {
      logger.warn('获取老师信息失败', {
        hasTeacherName: Boolean(teacherName),
        ...summarizeError(fetchError),
      });
      return;
    }

    if (!teacher) {
      logger.warn('未找到对应的老师记录', { hasTeacherName: Boolean(teacherName) });
      return;
    }

    const currentHours = teacher.total_hours || 0;
    const newHours = Math.round((currentHours + hours) * 100) / 100;

    // 更新老师累计课时
    const { error: updateError } = await supabaseServer
      .from('teachers')
      .update({
        total_hours: newHours,
      })
      .eq('id', teacher.id);

    if (updateError) {
      logger.warn('更新老师课时失败', {
        teacherId: teacher.id,
        hasTeacherName: Boolean(teacherName),
        ...summarizeError(updateError),
      });
    } else {
      logger.info('老师课时已更新', {
        teacherId: teacher.id,
        hasTeacherName: Boolean(teacherName),
        previousHours: currentHours,
        addedHours: hours,
        newHours
      });
    }
  } catch (error: unknown) {
    logger.warn('更新老师课时异常', {
      hasTeacherName: Boolean(teacherName),
      ...summarizeError(error),
    });
  }
}

/**
 * 处理课节评价和评分
 */
async function handleLessonEvaluation(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('课节评价和评分', data);
  await persistCallbackEvent(data, { eventType: 'lesson_evaluation' });
}

/**
 * 处理课堂结束消息
 * 保存课堂数据统计到数据库
 */
async function handleEnd(data: ClassInCallbackData): Promise<void> {
  try {
    logger.info('收到课堂结束回调', {
      courseId: data.CourseID,
      sid: data.SID,
      startTime: data.StartTime,
      realCloseTime: data.RealCloseTime
    });

    const classId = data.ClassID; // ClassIn 提供的商家ID（不用于查找）
    const courseId = data.CourseID; // 班级ID
    const sid = data.SID; // 学生ID
    const startTime = data.StartTime;
    const closeTime = data.CloseTime;
    const realCloseTime = data.RealCloseTime;
    const statistics = data.Data;

    if (!courseId) {
      logger.warn('课堂结束回调缺少 CourseID');
      return;
    }

    // 1. 通过 CourseID 查找对应的 course 记录
    // classin_course_id 是 bigint 类型，Supabase 返回字符串，查询时用字符串匹配
    const { data: course, error: courseError } = await supabaseServer
      .from('courses')
      .select('id')
      .eq('classin_course_id', String(courseId))
      .maybeSingle();

    if (courseError || !course) {
      logger.warn('未找到对应的课程记录', {
        courseId,
        hasDbError: Boolean(courseError),
        ...(courseError ? summarizeError(courseError) : {}),
      });
      return;
    }

    logger.info('找到课程记录', { courseId, localCourseId: course.id });

    // 2. 通过 course_id + StartTime 匹配到具体的课节记录
    // 找到 StartTime 之前最近的一个课节（包括当天）
    const startTimeDate = startTime ? new Date(startTime * 1000) : null;

    if (!startTimeDate) {
      logger.warn('无法确定上课时间，缺少 StartTime', { courseId });
      return;
    }

    const startTimeISO = startTimeDate.toISOString(); // 完整 ISO 时间字符串

    logger.info('查找课节，通知时间', {
      courseId,
      startTime: startTimeISO
    });

    // 查找通知时间之前最近的一个课节
    const { data: session, error: sessionError } = await supabaseServer
      .from('class_sessions')
      .select('id, course_id, scheduled_duration_minutes, teacher_id, status, classroom_id, scheduled_date, scheduled_time_start, scheduled_time_end')
      .eq('course_id', course.id)
      .lte('scheduled_date', startTimeISO) // scheduled_date <= 通知日期
      .order('scheduled_date', { ascending: false }) // 按日期降序
      .order('scheduled_time_start', { ascending: false }) // 按时间降序
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      logger.warn('查询课节记录失败', {
        courseId,
        courseLocalId: course.id,
        ...summarizeError(sessionError),
      });
      return;
    }

    if (!session) {
      logger.warn('未找到对应的课节记录', {
        courseId,
        courseLocalId: course.id,
        startTime: startTimeISO
      });
      return;
    }

    logger.info('找到课节记录', {
      sessionId: session.id,
      courseId: session.course_id,
      scheduledDate: session.scheduled_date,
      scheduledTime: session.scheduled_time_start,
      status: session.status,
      classroomId: session.classroom_id
    });

    // 3. 更新课节的 classroom_id（如果未设置）
    if (!session.classroom_id && classId) {
      logger.info('更新课节的 classroom_id', {
        sessionId: session.id,
        classroomId: classId
      });

      await supabaseServer
        .from('class_sessions')
        .update({ classroom_id: classId.toString() })
        .eq('id', session.id);
    }

    logger.info('找到课节记录', {
      sessionId: session.id,
      courseId: session.course_id,
      classroomId: session.classroom_id
    });

    // 4. 计算实际结束时间（按优先级判断）
    let finalCloseTime = closeTime; // 默认使用 CloseTime

    if (realCloseTime !== undefined && realCloseTime !== null) {
      // 有 RealCloseTime 字段
      if (realCloseTime === 0) {
        // RealCloseTime = 0，使用 CloseTime
        finalCloseTime = closeTime;
        logger.info('RealCloseTime 为 0，使用 CloseTime', { closeTime });
      } else {
        // RealCloseTime != 0，比较两者，取较小的值
        finalCloseTime = Math.min(realCloseTime, closeTime);
        logger.info('比较 RealCloseTime 和 CloseTime，取较小值', {
          realCloseTime,
          closeTime,
          finalCloseTime
        });
      }
    } else {
      // 没有 RealCloseTime 字段（可能是掉线、异常退出），使用 CloseTime
      finalCloseTime = closeTime;
      logger.info('没有 RealCloseTime 字段，使用 CloseTime', { closeTime });
    }

    // 5. 计算实际上课时长（分钟）
    let actualDurationMinutes = 0;
    if (startTime && finalCloseTime) {
      actualDurationMinutes = Math.round((finalCloseTime - startTime) / 60);
    }

    // 6. 更新课节状态
    const updateData: any = {
      status: 'completed',
      actual_end_time: new Date(finalCloseTime * 1000).toISOString(),
      actual_duration_minutes: actualDurationMinutes,
    };

    // 如果有开始时间，更新实际开始时间
    if (startTime) {
      updateData.actual_start_time = new Date(startTime * 1000).toISOString();
    }

    const { error: updateError } = await supabaseServer
      .from('class_sessions')
      .update(updateData)
      .eq('id', session.id);

    if (updateError) {
      logger.error('更新课节状态失败', {
        sessionId: session.id,
        ...summarizeError(updateError),
      });
      return;
    }

    logger.info('课节状态已更新为已完成', {
      sessionId: session.id,
      actualDuration: actualDurationMinutes,
      finalCloseTime,
    });

    // 7. 通过 inoutEnd 数据匹配并保存学生参与记录
    if (statistics && statistics.inoutEnd) {
      await saveStudentParticipationRecords(session.id, statistics.inoutEnd, startTime, finalCloseTime);
    }

    // 8. 保存课堂统计数据到 class_session_statistics 表
    if (statistics) {
      await saveClassSessionStatistics(session.id, classId, sid, statistics);
    }

    // 9. 更新课程统计信息
    if (session.course_id) {
      await updateCourseStats(session.course_id);
    }

    // 10. 记录老师课时消耗
    if (session.teacher_id && actualDurationMinutes > 0) {
      await updateTeacherHours(session.teacher_id, actualDurationMinutes);
    }

    logger.info('课堂结束处理完成', {
      sessionId: session.id,
      courseId: session.course_id,
      actualDurationMinutes,
      finalCloseTime,
    });

  } catch (error: unknown) {
    logger.error('处理课堂结束时出错', summarizeError(error));
  }
}

/**
 * 保存课堂数据统计
 */
async function saveClassSessionStatistics(
  sessionId: string,
  classId: number,
  sid: number,
  statistics: any
): Promise<void> {
  try {
    // 准备统计数据
    const statsData = {
      session_id: sessionId,
      classroom_id: classId.toString(),
      student_id: sid,
      statistics: statistics,
      // 提取关键指标以便查询
      stage_up_total: statistics.stageEnd ? JSON.stringify(statistics.stageEnd) : null,
      inout_details: statistics.inoutEnd ? JSON.stringify(statistics.inoutEnd) : null,
      equipment_usage: statistics.equipmentsEnd ? JSON.stringify(statistics.equipmentsEnd) : null,
      screen_sharing: statistics.mdscreenEnd ? JSON.stringify(statistics.mdscreenEnd) : null,
      handsup_details: statistics.handsupEnd ? JSON.stringify(statistics.handsupEnd) : null,
      award_details: statistics.awardEnd ? JSON.stringify(statistics.awardEnd) : null,
      created_at: new Date().toISOString(),
    };

    // 插入统计数据
    const { error: insertError } = await supabaseServer
      .from('class_session_statistics')
      .insert(statsData);

    if (insertError) {
      logger.warn('保存课堂统计数据失败', {
        sessionId,
        ...summarizeError(insertError),
      });
    } else {
      logger.info('课堂统计数据已保存', { sessionId });
    }
  } catch (error: unknown) {
    logger.warn('保存课堂统计数据异常', summarizeError(error));
  }
}

/**
 * 保存学生参与记录（从 inoutEnd 数据提取）
 */
async function saveStudentParticipationRecords(
  sessionId: string,
  inoutEnd: Record<string, any>,
  startTime: number,
  endTime: number
): Promise<void> {
  try {
    const participations = [];

    // 遍历每个用户（UID）
    for (const [uid, userData] of Object.entries(inoutEnd)) {
      const data = userData as any;

      // 提取学生信息
      const identity = data.Identity; // 1:学生, 2:旁听, 3:老师, 4:联席教师
      const totalTime = data.Total; // 在教室总时长（秒）

      // 只保存学生身份的记录（Identity = 1）
      if (identity !== 1) {
        continue;
      }

      // 提取进出详情
      const details = data.Details || [];
      const inRecords = details.filter((d: any) => d.Type === 'In');
      const outRecords = details.filter((d: any) => d.Type === 'Out');

      // 计算进入和退出时间
      const firstInTime = inRecords.length > 0 ? inRecords[0].Time : null;
      const lastOutTime = outRecords.length > 0 ? outRecords[outRecords.length - 1].Time : null;

      // 计算实际参与时长（分钟）
      const actualDurationMinutes = totalTime ? Math.round(totalTime / 60) : 0;

      // 判断出勤状态
      let attendanceStatus = 'absent'; // 默认：缺席
      if (actualDurationMinutes > 0) {
        // 如果参与时长超过课堂时长的 50%，标记为出席
        const classDurationMinutes = endTime && startTime ? Math.round((endTime - startTime) / 60) : 0;
        if (classDurationMinutes > 0 && actualDurationMinutes >= classDurationMinutes * 0.5) {
          attendanceStatus = 'present'; // 出席
        } else if (actualDurationMinutes > 0) {
          attendanceStatus = 'late'; // 迟到或早退
        }
      }

      participations.push({
        session_id: sessionId,
        student_uid: parseInt(uid),
        identity: identity,
        total_time_seconds: totalTime,
        actual_duration_minutes: actualDurationMinutes,
        attendance_status: attendanceStatus,
        first_in_time: firstInTime ? new Date(firstInTime * 1000).toISOString() : null,
        last_out_time: lastOutTime ? new Date(lastOutTime * 1000).toISOString() : null,
        inout_details: JSON.stringify(details),
        created_at: new Date().toISOString(),
      });
    }

    if (participations.length === 0) {
      logger.info('没有学生参与记录需要保存', { sessionId });
      return;
    }

    // 批量插入学生参与记录
    const { error: insertError } = await supabaseServer
      .from('class_student_participation')
      .insert(participations);

    if (insertError) {
      logger.warn('保存学生参与记录失败', {
        sessionId,
        ...summarizeError(insertError),
      });
    } else {
      logger.info('学生参与记录已保存', {
        sessionId,
        count: participations.length,
      });
    }
  } catch (error: unknown) {
    logger.warn('保存学生参与记录异常', summarizeError(error));
  }
}

/**
 * 更新老师课时消耗
 */
async function updateTeacherHours(teacherId: string, minutes: number): Promise<void> {
  try {
    // 将分钟转换为小时（保留2位小数）
    const hours = Math.round((minutes / 60) * 100) / 100;

    // 获取当前课时
    const { data: teacher, error: fetchError } = await supabaseServer
      .from('teachers')
      .select('id, total_hours')
      .eq('id', teacherId)
      .maybeSingle();

    if (fetchError) {
      logger.warn('获取老师信息失败', {
        teacherId,
        ...summarizeError(fetchError),
      });
      return;
    }

    if (!teacher) {
      logger.warn('未找到对应的老师记录', { teacherId });
      return;
    }

    const currentHours = teacher.total_hours || 0;
    const newHours = Math.round((currentHours + hours) * 100) / 100;

    // 更新老师累计课时
    const { error: updateError } = await supabaseServer
      .from('teachers')
      .update({ total_hours: newHours })
      .eq('id', teacherId);

    if (updateError) {
      logger.warn('更新老师课时失败', {
        teacherId,
        ...summarizeError(updateError),
      });
    } else {
      logger.info('老师课时已更新', {
        teacherId,
        previousHours: currentHours,
        addedHours: hours,
        newHours,
      });
    }
  } catch (error: unknown) {
    logger.warn('更新老师课时异常', {
      teacherId,
      ...summarizeError(error),
    });
  }
}

/**
 * 处理录课文件
 */
async function handleLessonRecord(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('录课文件', data);
  await persistCallbackEvent(data, { eventType: 'lesson_record' });
}

/**
 * 处理多人多题答题信息
 */
async function handleQuizResult(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('多人多题答题信息', data);
  await persistCallbackEvent(data, { eventType: 'quiz_result' });
}

/**
 * 处理回放观看数据
 */
async function handlePlayback(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('回放观看数据', data);
  await persistCallbackEvent(data, { eventType: 'playback' });
}

/**
 * 处理文件转换结果
 */
async function handleFileConvert(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('文件转换结果', data);
  await persistCallbackEvent(data, { eventType: 'file_convert' });
}

/**
 * 处理账号注销
 */
async function handleAccountCancel(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('账号注销', data);
  await persistCallbackEvent(data, { eventType: 'account_cancel' });
}

/**
 * 处理更换手机号
 */
async function handleChangePhone(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('更换手机号', data);
  await persistCallbackEvent(data, { eventType: 'change_phone' });
}

/**
 * 处理设置子账号
 */
async function handleSubAccount(data: ClassInCallbackData): Promise<void> {
  logCallbackHandler('设置子账号', data);
  await persistCallbackEvent(data, { eventType: 'sub_account' });
}

/**
 * 根据消息类型分发处理
 * @param cmd 命令类型
 * @param data 回调数据
 */
export async function handleMessage(cmd: string, data: ClassInCallbackData): Promise<void> {
  logMessage(cmd, data);

  try {
    switch (cmd) {
      case 'Test':
        logger.debug('收到 ClassIn 测试消息', summarizeCallbackData(data));
        break;

      case 'raiseHand':
        await handleRaiseHand(data);
        break;

      case 'reward':
        await handleReward(data);
        break;

      case 'enterRoom':
        await handleEnterRoom(data);
        break;

      case 'leaveRoom':
        await handleLeaveRoom(data);
        break;

      case 'auth':
        await handleAuth(data);
        break;

      case 'muteAll':
        await handleMuteAll(data);
        break;

      case 'mute':
        await handleMute(data);
        break;

      case 'answer':
        await handleAnswer(data);
        break;

      case 'grab':
        await handleGrab(data);
        break;

      case 'onStage':
        await handleOnStage(data);
        break;

      case 'networkStatus':
        await handleNetworkStatus(data);
        break;

      case 'deviceCheck':
        await handleDeviceCheck(data);
        break;

      case 'help':
        await handleHelp(data);
        break;

      case 'extendLesson':
        await handleExtendLesson(data);
        break;

      case 'recordStart':
        await handleRecordStart(data);
        break;

      case 'blackboardImage':
        await handleBlackboardImage(data);
        break;

      case 'liveLogin':
      case 'liveBooking':
      case 'liveView':
      case 'liveLike':
      case 'liveProductClick':
        await handleLive(data);
        break;

      case 'lessonSummary':
        await handleLessonSummary(data);
        break;

      case 'lessonEvaluation':
        await handleLessonEvaluation(data);
        break;

      case 'lessonRecord':
        await handleLessonRecord(data);
        break;

      case 'quizResult':
        await handleQuizResult(data);
        break;

      case 'webPlayback':
      case 'clientPlayback':
        await handlePlayback(data);
        break;

      case 'fileConvert':
        await handleFileConvert(data);
        break;

      case 'accountCancel':
        await handleAccountCancel(data);
        break;

      case 'changePhone':
        await handleChangePhone(data);
        break;

      case 'subAccount':
        await handleSubAccount(data);
        break;

      case 'End':
        await handleEnd(data);
        break;

      default:
        logger.warn('未处理的 ClassIn 回调消息类型', {
          message_type: cmd,
          ...summarizeCallbackData(data),
        });
        break;
    }
  } catch (error: unknown) {
    logger.error('处理 ClassIn 回调消息时发生错误', {
      message_type: cmd,
      ...summarizeError(error),
    });
    // 不抛出错误，避免影响 ClassIn 的回调重试机制
    // ClassIn 期望收到成功响应，即使处理失败也要返回成功状态
  }
}
