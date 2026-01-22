import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { batchCalculateTrialLessonStatus } from "@/lib/status-calculator"

const logger = createLogger('API:Students:Detail')

// GET: 获取学生详情（包含所有相关数据）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('id')

    if (!studentId) {
      return NextResponse.json(
        { error: '学生ID必填' },
        { status: 400 }
      )
    }

    logger.debug('获取学生详情', { studentId })

    // 1. 获取学生基本信息
    const { data: student, error: studentError } = await supabaseServer
      .from('students')
      .select(`
        id,
        created_at,
        updated_at,
        student_code,
        student_name,
        grade_code,
        region,
        school,
        parent_phone,
        head_teacher_id,
        status,
        classin_initial_password,
        classin_uid
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      logger.error('获取学生信息失败', { studentId, message: studentError?.message })
      return NextResponse.json(
        { error: studentError?.message || '学生不存在' },
        { status: 404 }
      )
    }

    // 2. 获取班主任信息
    let headTeacher = null
    if (student.head_teacher_id) {
      const { data: teacher } = await supabaseServer
        .from('user_profiles')
        .select('id, name, email, phone')
        .eq('id', student.head_teacher_id)
        .single()

      if (teacher) {
        headTeacher = teacher
      }
    }

    // 3. 获取正式订单列表
    const { data: formalOrders, error: formalOrdersError } = await supabaseServer
      .from('formal_orders')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (formalOrdersError) {
      logger.warn('获取正式订单失败', { studentId, message: formalOrdersError.message })
    }

    // 4. 获取试听课列表
    const { data: trialLessons, error: trialLessonsError } = await supabaseServer
      .from('trial_lessons')
      .select('*')
      .eq('phone', student.parent_phone || '')
      .order('created_at', { ascending: false })

    if (trialLessonsError) {
      logger.warn('获取试听课失败', { studentId, message: trialLessonsError.message })
    }

    // 计算试听课状态
    let trialLessonsWithStatus = trialLessons || []
    if (trialLessons && trialLessons.length > 0) {
      try {
        const statusResults = await batchCalculateTrialLessonStatus(trialLessons)

        // 合并状态到数据
        trialLessonsWithStatus = trialLessons.map((lesson, index) => ({
          ...lesson,
          lesson_status: statusResults[index].status,
          lesson_status_name: statusResults[index].statusName,
          is_converted_calculated: statusResults[index].isConverted,
        }))
      } catch (error) {
        logger.error('计算试听课状态失败', { studentId, error })
        // 失败时使用原始数据
      }
    }

    logger.debug('试听课数据', { studentId, count: trialLessonsWithStatus.length })

    // 5. 获取课程列表（直接通过 student_id 查询）
    let courses: any[] = []
    let coursesError: any = null

    logger.debug('开始查询课程', { studentId })

    // 测试：直接查询 courses 表（不关联其他表）
    const testResult = await supabaseServer
      .from('courses')
      .select('*')
      .eq('student_id', studentId)

    logger.debug('测试查询结果（无JOIN）', {
      studentId,
      error: testResult.error,
      count: testResult.data?.length || 0,
      data: testResult.data
    })

    // 方式1：直接用 student_id 查询（推荐，有索引）
    const studentIdResult = await supabaseServer
      .from('courses')
      .select(`
        *,
        teacher:teacher_id(id, name),
        formal_orders!inner(id, order_number)
      `)
      .eq('student_id', studentId)

    logger.debug('student_id 查询结果', {
      studentId,
      error: studentIdResult.error,
      count: studentIdResult.data?.length || 0,
      courses: studentIdResult.data
    })

    if (!studentIdResult.error && studentIdResult.data) {
      courses = studentIdResult.data
    }

    // 方式2：如果 student_id 查不到，用 order_id 查询（兼容旧数据）
    if (courses.length === 0 && (formalOrders || []).length > 0) {
      logger.debug('尝试用 order_id 查询', { orderIds: (formalOrders || []).map(o => o.id) })
      const orderIdResult = await supabaseServer
        .from('courses')
        .select(`
          *,
          teacher:teacher_id(id, name),
          formal_orders!inner(id, order_number)
        `)
        .in('order_id', (formalOrders || []).map(o => o.id))

      logger.debug('order_id 查询结果', {
        error: orderIdResult.error,
        count: orderIdResult.data?.length || 0,
        courses: orderIdResult.data
      })

      if (!orderIdResult.error && orderIdResult.data) {
        courses = orderIdResult.data
        coursesError = null  // 成功查询，清除错误
      } else {
        coursesError = orderIdResult.error
      }
    }

    if (coursesError) {
      logger.warn('获取课程失败', { studentId, message: coursesError.message })
    }

    logger.info('最终课程数据', { studentId, coursesCount: courses.length })

    // 格式化课程数据
    const formattedCourses = (courses || []).map((course: any) => ({
      ...course,
      teacher_name: course.teacher?.name,
      order_number: course.formal_orders?.order_number,
    }))

    // 6. 获取 ClassIn 课堂记录（通过学生手机号关联）
    const { data: classrooms, error: classroomsError } = await supabaseServer
      .from('classroom_classin')
      .select('*')
      .ilike('student_account', student.parent_phone || '')
      .order('start_time', { ascending: false })
      .limit(50)

    if (classroomsError) {
      logger.warn('获取ClassIn课堂记录失败', { studentId, message: classroomsError.message })
    }

    // 组装返回数据
    const detailData = {
      student: {
        ...student,
        head_teacher: headTeacher,
      },
      orders: formalOrders || [],
      trialLessons: trialLessonsWithStatus || [],
      courses: formattedCourses || [],
      classrooms: classrooms || [],
      // 统计信息
      stats: {
        formalOrdersCount: formalOrders?.length || 0,
        trialLessonsCount: trialLessonsWithStatus?.length || 0,
        coursesCount: formattedCourses?.length || 0,
        classroomsCount: classrooms?.length || 0,
        totalFormalHours: formalOrders?.reduce((sum, order) => sum + (order.total_hours || 0), 0) || 0,
        totalFormalAmount: formalOrders?.reduce((sum, order) => sum + (order.payment_amount || 0), 0) || 0,
      },
    }

    logger.debug('获取学生详情成功', { studentId })
    return NextResponse.json({ data: detailData })

  } catch (error: any) {
    logger.error('获取学生详情异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取学生详情失败' },
      { status: 500 }
    )
  }
}
