import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { createSafeErrorResponse, summarizeError } from "@/lib/safe-error"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, hasScopedIdAccess } from "@/lib/server-business-scope"

const logger = createLogger('API:ClassSessions:Sync')

const SYNC_SESSION_FIELDS = 'id, course_id, classroom_id, session_number, status'

const CLASSROOM_SYNC_FIELDS = 'class_id, end_time, actual_start_time, actual_end_time'

/**
 * 同步课节状态（从 ClassIn 同步）
 * POST /api/class-sessions/sync
 * Body: {
 *   courseId?: string,  // 课程ID（可选，同步整个课程的所有课节）
 *   sessionId?: string  // 课节ID（可选，同步单个课节）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courseId, sessionId } = body

    if (!courseId && !sessionId) {
      return NextResponse.json(
        { error: '必须提供课程ID或课节ID' },
        { status: 400 }
      )
    }

    logger.debug('同步课节状态', { courseId, sessionId })

    const profile = await getCurrentProfile(request)
    const accessibleCourseIds = await getAccessibleCourseIds(profile)

    let sessions: any[] = []

    // 1. 获取需要同步的课节列表
    if (sessionId) {
      // 同步单个课节
      const { data: session, error } = await supabaseServer
        .from('class_sessions')
        .select(SYNC_SESSION_FIELDS)
        .eq('id', sessionId)
        .single()

      if (error || !session) {
        logger.error('课节不存在', { sessionId })
        return NextResponse.json({ error: '课节不存在' }, { status: 404 })
      }

      if (!hasScopedIdAccess(accessibleCourseIds, session.course_id)) {
        logger.warn('同步单个课节失败 - 无权访问课程', {
          sessionId,
          courseId: session.course_id,
          profileId: profile?.id,
        })
        return NextResponse.json({ error: '无权同步该课节' }, { status: 403 })
      }

      sessions = [session]
    } else if (courseId) {
      if (!hasScopedIdAccess(accessibleCourseIds, courseId)) {
        logger.warn('同步课程课节失败 - 无权访问课程', { courseId, profileId: profile?.id })
        return NextResponse.json({ error: '无权同步该课程课节' }, { status: 403 })
      }

      // 同步整个课程的所有课节
      const { data: courseSessions, error } = await supabaseServer
        .from('class_sessions')
        .select(SYNC_SESSION_FIELDS)
        .eq('course_id', courseId)
        .order('session_number', { ascending: true })

      if (error) {
        logger.error('获取课节列表失败', { courseId, error_summary: summarizeError(error) })
        return NextResponse.json({ error: '获取课节列表失败' }, { status: 400 })
      }

      sessions = courseSessions || []
    }

    if (sessions.length === 0) {
      return NextResponse.json({ message: '没有需要同步的课节' })
    }

    logger.debug('开始同步课节', { count: sessions.length })

    let updated = 0
    let skipped = 0
    const results: any[] = []

    // 2. 遍历课节，从 ClassIn 同步数据
    for (const session of sessions) {
      try {
        if (!session.classroom_id) {
          logger.debug('课节未关联 ClassIn 课堂，跳过', { sessionId: session.id })
          skipped++
          continue
        }

        // 从 classroom_classin 获取 ClassIn 课堂数据
        const { data: classroomClassin, error: classroomError } = await supabaseServer
          .from('classroom_classin')
          .select(CLASSROOM_SYNC_FIELDS)
          .eq('class_id', session.classroom_id)
          .single()

        if (classroomError || !classroomClassin) {
          logger.debug('ClassIn 课堂不存在，跳过', { sessionId: session.id, classroomId: session.classroom_id })
          skipped++
          continue
        }

        // 判断课节状态
        const now = Math.floor(Date.now() / 1000)
        const endTime = classroomClassin.end_time || 0
        let status = session.status

        // 如果已过结束时间，标记为已完成
        if (endTime > 0 && endTime < now) {
          if (status === 'scheduled') {
            status = 'completed'
          }
        }

        // 构建更新数据
        const updateData: any = {
          status,
        }

        // 如果有实际上课时间，更新
        if (classroomClassin.actual_start_time) {
          updateData.actual_start_time = new Date(classroomClassin.actual_start_time * 1000).toISOString()
        }

        if (classroomClassin.actual_end_time) {
          updateData.actual_end_time = new Date(classroomClassin.actual_end_time * 1000).toISOString()

          // 计算实际时长
          if (classroomClassin.actual_start_time) {
            const actualDuration = Math.floor(
              (classroomClassin.actual_end_time - classroomClassin.actual_start_time) / 60
            )
            updateData.actual_duration_minutes = actualDuration
          }
        }

        // 更新课节
        const { error: updateError } = await supabaseServer
          .from('class_sessions')
          .update(updateData)
          .eq('id', session.id)

        if (updateError) {
          logger.error('更新课节失败', { sessionId: session.id, error_summary: summarizeError(updateError) })
          skipped++
          continue
        }

        logger.info('同步课节成功', {
          sessionId: session.id,
          sessionNumber: session.session_number,
          status: updateData.status,
        })

        updated++
        results.push({
          sessionId: session.id,
          sessionNumber: session.session_number,
          status: updateData.status,
          hasActualTime: !!(updateData.actual_start_time && updateData.actual_end_time),
        })
      } catch (e) {
        logger.warn('同步课节失败', { sessionId: session.id, error_summary: summarizeError(e) })
        skipped++
      }
    }

    logger.info('同步课节完成', { total: sessions.length, updated, skipped })

    return NextResponse.json({
      success: true,
      total: sessions.length,
      updated,
      skipped,
      results,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, '同步课节失败')
    logger.error('同步课节异常', safeError.log)
    return NextResponse.json(safeError.response, { status: safeError.status })
  }
}
