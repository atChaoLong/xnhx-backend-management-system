import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { DictionaryService } from "@/lib/services/dictionary"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:TrialLessonscreateClassIn')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trialLessonId } = body

    if (!trialLessonId) {
      return NextResponse.json({ error: '试听课程ID不能为空' }, { status: 400 })
    }

    // 1. 获取试听课程信息
    const { data: lesson, error: lessonError } = await supabaseServer
      .from('trial_lessons')
      .select('*')
      .eq('id', trialLessonId)
      .single()

    if (lessonError || !lesson) {
      logger.error('获取试听课程失败', { trialLessonId, error: lessonError })
      return NextResponse.json({ error: '试听课程不存在' }, { status: 404 })
    }

    // 2. 检查是否已经有 ClassIn 课程ID
    if (lesson.classin_course_id) {
      return NextResponse.json({ error: '该试听课程已创建ClassIn课程' }, { status: 400 })
    }

    // 3. 检查是否已分配教师
    if (!lesson.confirmed_teacher) {
      return NextResponse.json({ error: '请先确认教师后再创建课程' }, { status: 400 })
    }

    // 4. 从 teacher_classin 表获取教师信息
    const { data: teacherData, error: teacherError } = await supabaseServer
      .from('teacher_classin')
      .select('*')
      .eq('name', lesson.confirmed_teacher)
      .eq('is_del', 0)
      .single()

    if (teacherError || !teacherData) {
      logger.error('获取教师ClassIn信息失败', { teacherName: lesson.confirmed_teacher, error: teacherError })
      return NextResponse.json({ error: '教师未在ClassIn系统中找到，请检查教师姓名是否正确' }, { status: 400 })
    }

    // 5. 加载字典数据以转换编码为中文
    const dicts = await DictionaryService.getAllDictionaries()

    const getLabelByCode = (code: string, category: string) => {
      const items = dicts[category] || []
      const item = items.find((i: any) => i.code === code)
      return item?.label || code
    }

    const subjectLabel = getLabelByCode(lesson.trial_subject || '', 'subject')
    const gradeLabel = getLabelByCode(lesson.grade || '', 'grade')

    // 6. 使用 SDK 创建课程和课堂
    const sdk = getClassInSDKService()

    // 课程名称和课堂名称
    const courseName = `${lesson.child_name}-${subjectLabel}-试听课程`
    const unitName = '试听单元'
    const classroomName = `${lesson.child_name}-${subjectLabel}-试听课`

    // 计算开始和结束时间
    const trialTime = new Date(lesson.trial_time)
    const durationInHours = lesson.trial_duration / 60
    const durationMs = durationInHours * 60 * 60 * 1000
    const endTime = new Date(trialTime.getTime() + durationMs)

    logger.info('开始创建完整的ClassIn课程', {
      courseName,
      teacherName: lesson.confirmed_teacher,
      teacherUid: teacherData.uid,
      trialTime: trialTime.toISOString(),
      trial_duration_minutes: lesson.trial_duration,
      durationInHours,
      durationMs,
      endTime: endTime.toISOString(),
      durationMinutes: (endTime.getTime() - trialTime.getTime()) / 60000
    })

    // 7. 执行创建流程
    let courseId: number
    let unitId: number
    let classId: number
    let activityId: number

    try {
      // 7.1 创建课程
      courseId = await sdk.createCourse({
        courseName
      })

      logger.info('创建课程成功', { courseId })

      // 7.2 创建单元
      const unitResult = await sdk.createUnit({
        courseId,
        name: unitName
      })
      unitId = unitResult.unitId || unitResult

      logger.info('创建单元成功', { unitId })

      // 7.3 创建课堂活动
      const classroomResult = await sdk.createClassroom({
        courseId,
        unitId,
        name: classroomName,
        teacherUid: teacherData.uid,
        startTime: trialTime,
        endTime: endTime,
        liveState: 0,
        openState: 0,
        recordState: 1, // 开启录课
        recordType: 0
      })

      classId = classroomResult.classId
      activityId = classroomResult.activityId

      logger.info('创建课堂成功', { classId, activityId })

    } catch (error: any) {
      logger.error('创建ClassIn课程失败', {
        message: error.message,
        stack: error.stack
      })
      throw error
    }

    // 8. 更新试听课程记录
    const { error: updateError } = await supabaseServer
      .from('trial_lessons')
      .update({
        classin_course_id: courseId,
        classin_class_id: classId,
        classin_activity_id: activityId,
        classin_unit_id: unitId,
        course_status: '已排课',
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trialLessonId)

    if (updateError) {
      logger.error('更新试听课程失败', { trialLessonId, error: updateError })
      return NextResponse.json({ error: '创建成功但更新记录失败' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        courseId,
        unitId,
        classId,
        activityId,
        courseName,
        unitName,
        classroomName
      }
    })
  } catch (error: any) {
    logger.error('创建ClassIn课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '创建课程失败' }, { status: 500 })
  }
}
