import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"
import { createLogger } from "@/lib/logger"
import { DictionaryService } from "@/lib/services/dictionary"

const logger = createLogger('API:TrialLessonsOpenClass')

/**
 * 试听开课：若无课程则创建课程+单元+课堂；若已有课程则仅创建课堂
 * Body: { trialLessonId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trialLessonId } = body

    if (!trialLessonId) {
      return NextResponse.json({ error: '试听课程ID不能为空' }, { status: 400 })
    }

    const { data: lesson, error: lessonError } = await supabaseServer
      .from('trial_lessons')
      .select('*')
      .eq('id', trialLessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: '试听课程不存在' }, { status: 404 })
    }

    if (!lesson.confirmed_teacher) {
      return NextResponse.json({ error: '请先确认教师后再开课' }, { status: 400 })
    }
    if (!lesson.trial_time || !lesson.trial_duration) {
      return NextResponse.json({ error: '缺少试听时间或时长' }, { status: 400 })
    }

    const { data: teacherData, error: teacherError } = await supabaseServer
      .from('teacher_classin')
      .select('*')
      .eq('name', lesson.confirmed_teacher)
      .eq('is_del', 0)
      .single()

    if (teacherError || !teacherData?.uid) {
      return NextResponse.json({ error: '教师未在ClassIn系统中找到或未绑定UID' }, { status: 400 })
    }

    const sdk = getClassInSDKService()

    const trialTime = new Date(lesson.trial_time)
    const durationMs = (lesson.trial_duration as number) * 60 * 1000
    const endTime = new Date(trialTime.getTime() + durationMs)

    let courseId: number = lesson.classin_course_id || 0
    let unitId: number = lesson.classin_unit_id || 0
    let classId: number
    let activityId: number

    if (!courseId) {
      const dicts = await DictionaryService.getAllDictionaries()
      const getLabelByCode = (code: string, category: string) => {
        const items = dicts[category] || []
        const item = items.find((i: any) => i.code === code)
        return item?.label || code
      }
      const subjectLabel = getLabelByCode(lesson.trial_subject || '', 'subject')
      const courseName = `【试听】${lesson.child_name} ${subjectLabel || (lesson.trial_subject || '').trim()}课`
      courseId = await sdk.createCourse({ courseName })
      const unitResult: any = await sdk.createUnit({ courseId, name: '试听单元' })
      unitId = (typeof unitResult === 'object' ? unitResult.unitId : unitResult)

      try {
        await supabaseServer
          .from('class_classin')
          .upsert({
            course_id: courseId,
            course_name: courseName,
            creator_uid: teacherData.uid,
            creater_name: lesson.confirmed_teacher || '',
            add_time: Math.floor(Date.now() / 1000),
            course_state: 1,
            teacher_num: 1,
            student_num: 0,
            sync_time: new Date().toISOString(),
          }, { onConflict: 'course_id' })
      } catch (e: any) {
        logger.warn('写入 class_classin 失败', { message: e?.message })
      }
    }

    const dicts2 = await DictionaryService.getAllDictionaries()
    const getLabelByCode2 = (code: string, category: string) => {
      const items = dicts2[category] || []
      const item = items.find((i: any) => i.code === code)
      return item?.label || code
    }
    const subjectLabel2 = getLabelByCode2(lesson.trial_subject || '', 'subject')
    const classroomResult = await sdk.createClassroom({
      courseId,
      unitId,
      name: `【试听】${lesson.child_name} ${subjectLabel2 || (lesson.trial_subject || '').trim()}课`,
      teacherUid: teacherData.uid,
      startTime: trialTime,
      endTime: endTime,
      liveState: 0,
      openState: 0,
      recordState: 1,
      recordType: 0
    })

    classId = classroomResult.classId
    activityId = classroomResult.activityId

    const { error: updateError } = await supabaseServer
      .from('trial_lessons')
      .update({
        classin_course_id: courseId,
        classin_unit_id: unitId || null,
        classin_class_id: classId,
        classin_activity_id: activityId,
        course_status: '已排课',
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trialLessonId)

    if (updateError) {
      return NextResponse.json({ error: '创建成功但更新记录失败' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { courseId, unitId, classId, activityId }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '试听开课失败' },
      { status: 500 }
    )
  }
}
