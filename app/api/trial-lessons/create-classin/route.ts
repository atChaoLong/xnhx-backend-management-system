import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { getClassInSDK } from "@/lib/services/classin/sdk"
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

    // 4. 从 teacher_classin 表获取 ClassIn UID（通过教师姓名匹配）
    const { data: teacherData, error: teacherError } = await supabaseServer
      .from('teacher_classin')
      .select('uid, st_id')
      .eq('name', lesson.confirmed_teacher)
      .eq('is_del', 0)
      .single()

    if (teacherError || !teacherData) {
      logger.error('获取教师ClassIn UID失败', { teacherName: lesson.confirmed_teacher, error: teacherError })
      return NextResponse.json({ error: '教师未在ClassIn系统中找到，请检查教师姓名是否正确' }, { status: 400 })
    }

    const teacherId = teacherData.uid

    // 5. 加载字典数据以转换编码为中文
    const dicts = await DictionaryService.getAllDictionaries()

    // 转换科目编码为中文标签
    const getLabelByCode = (code: string, category: string) => {
      const items = dicts[category] || []
      const item = items.find((i: any) => i.code === code)
      return item?.label || code
    }

    const subjectLabel = getLabelByCode(lesson.trial_subject || '', 'subject')
    const gradeLabel = getLabelByCode(lesson.grade || '', 'grade')

    // 6. 使用 SDK 创建课程
    const sdk = getClassInSDK()
    const courseName = `${lesson.child_name}-${subjectLabel}-试听课`

    logger.info('开始创建课程', { courseName, teacherId, subjectLabel, gradeLabel })

    const courseResult = await sdk.createCourse({
      name: courseName,
      subject: subjectLabel,
      grade: gradeLabel,
      teacher_id: teacherId,
      teacher_name: lesson.confirmed_teacher,
      course_type: 1, // 1: 一对一
    })

    logger.info('创建课程成功', { courseId: courseResult.course_id })

    const courseId = courseResult.course_id

    // 7. 计算开始和结束时间（SDK 使用秒级时间戳）
    const trialTime = new Date(lesson.trial_time)
    const startTime = Math.floor(trialTime.getTime() / 1000) // 转换为秒
    const endTime = startTime + Math.floor(lesson.trial_duration * 60 * 60) // 秒

    // 8. 创建课节
    const className = `${courseName}-${trialTime.toLocaleDateString('zh-CN')}`
    const classResult = await sdk.createClass({
      course_id: courseId,
      class_name: className,
      teacher_id: teacherId,
      start_time: startTime,
      end_time: endTime,
      class_type: 1, // 1: 一对一
    })

    logger.info('创建课节成功', { classId: classResult.class_id, className })

    // 9. 注意：学生添加需要额外实现
    // 目前 ClassIn 需要先在系统中创建学生，然后才能添加到课节
    // 如果需要添加学生，需要：
    // - 在 ClassIn 中创建学生账号
    // - 获取 ClassIn 学生 UID
    // - 调用 sdk.addStudentToClass(classId, [studentUid])

    // 10. 更新试听课程记录
    const { error: updateError } = await supabaseServer
      .from('trial_lessons')
      .update({
        classin_course_id: courseId,
        classin_class_id: classResult.class_id,
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
        classId: classResult.class_id,
        courseName,
        className,
      }
    })
  } catch (error: any) {
    logger.error('创建ClassIn课程异常', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || '创建课程失败' }, { status: 500 })
  }
}
