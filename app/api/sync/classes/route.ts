import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/server-data-scope'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('API:Sync:Classes')

// ClassIn API 响应类型（使用 camelCase）
interface ClassInCourseResponse {
  courseId: number
  courseName: string
  schoolUid: number
  webCast?: string
  liveHost?: string
  courseType?: number
  coverImg?: string
  createrName?: string
  addTime?: number
  creatorUid?: number
  endUid?: number
  endName?: string
  endTime?: number
  subjectId?: number
  courseState?: number
  firstClassBeginTime?: number
  teacherNum?: number
  studentNum?: number
  auditNum?: number
  expiryTime?: number
  cloudFolder?: number
  skinId?: number
  completeClassNum?: number
  totalClassNum?: number
  recordNum?: number
  liveNum?: number
  openNum?: number
  homeworkNum?: number
  examNum?: number
  headImg?: any
  courseImg?: any
  setting?: any
  mainUserInfo?: any
  teachers?: any[]
  labels?: any[]
  catInfo?: any
  cloudFolderInfo?: any
  skinInfo?: any
}

/**
 * 从 ClassIn 同步班级数据到本地数据库
 * POST /api/sync/classes
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile(request)
    if (!profile || !['admin', 'academic_affairs'].includes(profile.role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const body = await request.json()
    const { page = 1, pageSize = 50, courseState = 1, cookie } = body

    // 1. 从 ClassIn API 获取班级列表
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*',
    }

    // 如果提供了 Cookie，添加到请求头
    if (cookie) {
      headers['Cookie'] = cookie
    }

    const classinResponse = await fetch(
      `${process.env.NEXT_PUBLIC_CLASSIN_API_URL || 'https://dynamic.eeo.cn'}/course/web/list`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page,
          pageSize,
          courseState,
          withAuth: 0,
        }),
      }
    )

    if (!classinResponse.ok) {
      throw new Error('获取 ClassIn 班级列表失败')
    }

    const classinData = await classinResponse.json()

    if (classinData.error_info?.errno !== 1) {
      throw new Error(classinData.error_info?.error || '获取班级列表失败')
    }

    const courses = (classinData.data.courseList || []) as ClassInCourseResponse[]

    // 2. 同步每个班级到 class_classin 表
    const results = {
      total: courses.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ name: string; error: string }>,
    }

    for (const course of courses) {
      try {
        // 准备数据 - 将 ClassIn API 字段映射到数据库字段
        const courseData = {
          course_name: course.courseName || '',
          school_uid: course.schoolUid,
          web_cast: course.webCast || '',
          live_host: course.liveHost || '',
          course_type: course.courseType,
          cover_img: course.coverImg || '',
          creater_name: course.createrName || '',
          add_time: course.addTime,
          creator_uid: course.creatorUid,
          end_uid: course.endUid ?? 0,
          end_name: course.endName || '',
          end_time: course.endTime ?? 0,
          subject_id: course.subjectId ?? 0,
          course_state: course.courseState,
          first_class_begin_time: course.firstClassBeginTime,
          teacher_num: course.teacherNum ?? 0,
          student_num: course.studentNum ?? 0,
          audit_num: course.auditNum ?? 0,
          expiry_time: course.expiryTime ?? 0,
          cloud_folder: course.cloudFolder ?? 0,
          skin_id: course.skinId ?? 0,
          complete_class_num: course.completeClassNum ?? 0,
          total_class_num: course.totalClassNum ?? 0,
          record_num: course.recordNum ?? 0,
          live_num: course.liveNum ?? 0,
          open_num: course.openNum ?? 0,
          homework_num: course.homeworkNum ?? 0,
          exam_num: course.examNum ?? 0,
          head_img: course.headImg || null,
          course_img: course.courseImg || null,
          setting: course.setting || null,
          main_user_info: course.mainUserInfo || null,
          teachers: course.teachers || [],
          labels: course.labels || [],
          cat_info: course.catInfo || null,
          cloud_folder_info: course.cloudFolderInfo || null,
          skin_info: course.skinInfo || null,
          sync_time: new Date().toISOString(),
        }

        // 使用 upsert（基于 course_id 主键）
        const { error } = await supabaseAdmin
          .from('class_classin')
          .upsert({
            course_id: course.courseId, // 主键
            ...courseData,
          }, {
            onConflict: 'course_id',
            ignoreDuplicates: false,
          })

        if (error) throw error

        results.success++
      } catch (error: unknown) {
        results.failed++
        results.errors.push({
          name: course.courseName || '未知',
          error: '该班级同步失败',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error: unknown) {
    logger.error('同步班级数据失败', summarizeError(error))
    return NextResponse.json(
      { error: '同步班级数据失败' },
      { status: 500 }
    )
  }
}
