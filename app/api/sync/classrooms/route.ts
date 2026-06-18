import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/server-data-scope'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:Sync:Classrooms')

// ClassIn API 响应类型（使用 camelCase）
interface ClassInClassroomResponse {
  classId: number
  classStatus?: number
  classType?: number
  name: string
  startTime?: number
  endTime?: number
  seatNum?: number
  teachMode?: number
  screenMode?: number
  cameraHide?: number
  isAutoOnstage?: number
  isDc?: number
  isHd?: number
  lessonKey?: string
  liveHost?: string
  classIntroduce?: string
  transferStuNum?: number
  outStuNum?: number
  stuNum?: number
  auditNum?: number
  classLabel?: any[]
  goodsNum?: number
  videoArray?: any
  teacher?: any
  assistant?: any[]
  creator?: any
  coType?: number
  coMainId?: number
  createdAt?: number
  courseId?: number
  schoolUid?: number
  omoStationBroadcast?: number
  cloudFolder?: any
  activityId?: number
  unit?: any
  category?: any
  bizType?: number
  publishFlag?: number
  processFlag?: number
  bizId?: number
  muteAll?: number
  courseName?: string
  forbidAssistantOperation?: number
}

/**
 * 从 ClassIn 同步课堂数据到本地数据库
 * POST /api/sync/classrooms
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile || !['admin', 'academic_affairs'].includes(profile.role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const body = await request.json()
    const { page = 1, pageSize = 50, searchStatus = [0, 1, 10], startTime, endTime, cookie } = body

    // 1. 从 ClassIn API 获取课堂列表
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*',
    }

    // 如果提供了 Cookie，添加到请求头
    if (cookie) {
      headers['Cookie'] = cookie
    }

    const classinResponse = await fetch(
      `${process.env.NEXT_PUBLIC_CLASSIN_API_URL || 'https://dynamic.eeo.cn'}/classroom/web/class/list`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page,
          pageSize,
          searchStatus,
          timeRange: startTime && endTime ? {
            startTime,
            endTime,
          } : undefined,
        }),
      }
    )

    if (!classinResponse.ok) {
      throw new Error('获取 ClassIn 课堂列表失败')
    }

    const classinData = await classinResponse.json()

    if (classinData.error_info?.errno !== 1) {
      throw new Error(classinData.error_info?.error || '获取课堂列表失败')
    }

    const classrooms = (classinData.data.list || []) as ClassInClassroomResponse[]

    // 2. 同步每个课堂到 classroom_classin 表
    const results = {
      total: classrooms.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const classroom of classrooms) {
      try {
        // 准备数据 - 将 ClassIn API 字段映射到数据库字段
        const classroomData = {
          name: classroom.name || '',
          class_status: classroom.classStatus,
          class_type: classroom.classType,
          start_time: classroom.startTime,
          end_time: classroom.endTime,
          seat_num: classroom.seatNum ?? 0,
          teach_mode: classroom.teachMode,
          screen_mode: classroom.screenMode ?? 1,
          camera_hide: classroom.cameraHide ?? 0,
          is_auto_onstage: classroom.isAutoOnstage ?? 2,
          is_dc: classroom.isDc ?? 0,
          is_hd: classroom.isHd ?? 0,
          lesson_key: classroom.lessonKey || '',
          live_host: classroom.liveHost || '',
          class_introduce: classroom.classIntroduce || '',
          transfer_stu_num: classroom.transferStuNum ?? 0,
          out_stu_num: classroom.outStuNum ?? 0,
          stu_num: classroom.stuNum ?? 0,
          audit_num: classroom.auditNum ?? 0,
          goods_num: classroom.goodsNum ?? 0,
          video_array: classroom.videoArray || null,
          teacher: classroom.teacher || null,
          class_label: classroom.classLabel || [],
          assistant: classroom.assistant || [],
          creator: classroom.creator || null,
          co_type: classroom.coType ?? 0,
          co_main_id: classroom.coMainId ?? 0,
          created_at_timestamp: classroom.createdAt,
          course_id: classroom.courseId,
          school_uid: classroom.schoolUid,
          omo_station_broadcast: classroom.omoStationBroadcast ?? 0,
          cloud_folder: classroom.cloudFolder || null,
          activity_id: classroom.activityId,
          unit: classroom.unit || null,
          category: classroom.category || null,
          biz_type: classroom.bizType ?? 1,
          publish_flag: classroom.publishFlag ?? 2,
          process_flag: classroom.processFlag ?? 0,
          biz_id: classroom.bizId,
          mute_all: classroom.muteAll ?? 0,
          course_name: classroom.courseName || '',
          forbid_assistant_operation: classroom.forbidAssistantOperation ?? 0,
          sync_time: new Date().toISOString(),
        }

        // 使用 upsert（基于 class_id 主键）
        const { error } = await supabaseAdmin
          .from('classroom_classin')
          .upsert({
            class_id: classroom.classId, // 主键
            ...classroomData,
          }, {
            onConflict: 'class_id',
            ignoreDuplicates: false,
          })

        if (error) throw error

        results.success++
      } catch (error: unknown) {
        results.failed++
        results.errors.push({
          name: classroom.name || '未知',
          error: '该课堂同步失败',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error: unknown) {
    logger.error('同步课堂数据失败', summarizeError(error))
    return NextResponse.json(
      { error: '同步课堂数据失败' },
      { status: 500 }
    )
  }
}
