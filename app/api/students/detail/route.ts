import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { batchCalculateTrialLessonStatus } from "@/lib/status-calculator"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleStudentIds, hasScopedIdAccess } from "@/lib/server-business-scope"
import { redactStudentClassInSecrets } from "@/lib/server-student-redaction"
import { redactFormalOrdersSensitiveFields, redactTrialLessonsSensitiveFields } from "@/lib/server-formal-order-redaction"
import { calculateFormalOrderBalanceSummaries } from "@/lib/server-formal-order-balance"
import { getErrorMessage, summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:Students:Detail')

const FORMAL_ORDER_SELECT = `
  id,
  lead_id,
  trial_lesson_id,
  previous_order_id,
  order_number,
  order_type,
  consultant_teacher,
  teacher_names,
  subjects,
  total_sessions,
  session_duration,
  total_hours,
  payment_channel,
  payment_amount,
  hourly_rate,
  payment_proof,
  payment_time,
  first_class_time,
  status,
  created_at
`

const TRIAL_LESSON_SELECT_BASE = `
  id,
  student_id,
  lead_id,
  child_name,
  phone,
  region,
  grade,
  trial_subject,
  trial_time,
  trial_duration,
  trial_amount,
  payment_proof,
  status,
  course_status,
  class_link,
  matched_teacher,
  confirmed_teacher,
  created_at
`

const TRIAL_LESSON_SELECT_WITH_MANUAL_CONVERSION = `
  ${TRIAL_LESSON_SELECT_BASE},
  manual_converted
`

const COURSE_SELECT = `
  id,
  order_id,
  student_id,
  classin_course_id,
  course_name,
  subject,
  grade,
  teacher_id,
  teacher_name,
  session_count,
  total_hours,
  course_status,
  course_consumption_info,
  created_at,
  updated_at,
  teacher:teacher_id(id, name),
  formal_orders!inner(id, order_number)
`

const VISIT_RECORD_SELECT = `
  id,
  student_id,
  visit_date,
  visit_method,
  parent_attitude,
  visit_notes,
  visit_personnel,
  next_visit_date,
  created_at
`

const STATUS_HISTORY_SELECT = `
  id,
  student_id,
  old_status,
  new_status,
  reason,
  changed_by,
  changed_at
`

const TRANSACTION_RECORD_SELECT = `
  id,
  student_id,
  order_id,
  creation_date,
  course_name,
  student_name,
  teacher_name,
  schedule_consumption,
  order_type,
  original_consultant,
  class_teacher,
  transaction_type,
  remaining_duration,
  refund_amount,
  status,
  unit_price,
  created_at
`

const CLASSROOM_SELECT = `
  class_id,
  name,
  start_time,
  end_time,
  course_id,
  course_name,
  created_at
`

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

function encodePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function isMissingColumnError(error: unknown, column: string) {
  const message = getErrorMessage(error).toLowerCase()
  const { code } = summarizeError(error)

  return code === '42703' ||
    code === 'PGRST204' ||
    message.includes(column.toLowerCase())
}

// GET: 获取学生详情（包含所有相关数据）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('id')
    const profile = await getCurrentProfile(request)

    if (!studentId) {
      return NextResponse.json(
        { error: '学生ID必填' },
        { status: 400 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户档案未配置，请联系管理员' },
        { status: 403 }
      )
    }

    const accessibleStudentIds = await getAccessibleStudentIds(profile)
    if (!hasScopedIdAccess(accessibleStudentIds, studentId)) {
      logger.warn('获取学生详情失败 - 无权访问学生', { studentId, user_id: profile.id, role: profile.role })
      return NextResponse.json(
        { error: '无权访问该学生' },
        { status: 403 }
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
      logger.error('获取学生信息失败', { studentId, ...summarizeError(studentError) })
      return NextResponse.json(
        { error: '学生不存在' },
        { status: 404 }
      )
    }

    // 2. 获取班主任信息
    let headTeacher = null
    if (student.head_teacher_id) {
      const { data: teacher } = await supabaseServer
        .from('user_profiles')
        .select('id, name')
        .eq('id', student.head_teacher_id)
        .single()

      if (teacher) {
        headTeacher = teacher
      }
    }

    // 3. 获取正式订单列表
    const { data: formalOrders, error: formalOrdersError } = await supabaseServer
      .from('formal_orders')
      .select(FORMAL_ORDER_SELECT)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (formalOrdersError) {
      logger.warn('获取正式订单失败', { studentId, ...summarizeError(formalOrdersError) })
    }

    // 4. 获取试听课列表：优先通过 student_id 精准关联，同时兼容旧手机号匹配数据。
    const trialFilters = [
      `student_id.eq.${studentId}`,
      student.parent_phone ? `phone.eq.${encodePostgrestValue(student.parent_phone)}` : '',
    ].filter(Boolean)

    let trialLessons: any[] | null = []
    let trialLessonsError: unknown = null

    if (trialFilters.length > 0) {
      const trialLessonResult = await supabaseServer
        .from('trial_lessons')
        .select(TRIAL_LESSON_SELECT_WITH_MANUAL_CONVERSION)
        .or(trialFilters.join(','))
        .order('created_at', { ascending: false })

      if (trialLessonResult.error && isMissingColumnError(trialLessonResult.error, 'manual_converted')) {
        logger.warn('试听课 manual_converted 字段不可用，使用兼容字段集重试', {
          studentId,
          ...summarizeError(trialLessonResult.error),
        })

        const fallbackResult = await supabaseServer
          .from('trial_lessons')
          .select(TRIAL_LESSON_SELECT_BASE)
          .or(trialFilters.join(','))
          .order('created_at', { ascending: false })

        trialLessons = fallbackResult.data
        trialLessonsError = fallbackResult.error
      } else {
        trialLessons = trialLessonResult.data
        trialLessonsError = trialLessonResult.error
      }
    }

    if (trialLessonsError) {
      logger.warn('获取试听课失败', { studentId, ...summarizeError(trialLessonsError) })
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
        logger.error('计算试听课状态失败', { studentId, ...summarizeError(error) })
        // 失败时使用原始数据
      }
    }

    logger.debug('试听课数据', { studentId, count: trialLessonsWithStatus.length })

    // 5. 获取课程列表（直接通过 student_id 查询）
    let courses: any[] = []
    let coursesError: any = null

    logger.debug('开始查询课程', { studentId })

    // 方式1：直接用 student_id 查询（推荐，有索引）
    const studentIdResult = await supabaseServer
      .from('courses')
      .select(COURSE_SELECT)
      .eq('student_id', studentId)

    logger.debug('student_id 查询结果', {
      studentId,
      hasError: Boolean(studentIdResult.error),
      count: studentIdResult.data?.length || 0,
    })

    if (!studentIdResult.error && studentIdResult.data) {
      courses = studentIdResult.data
    }

    // 方式2：如果 student_id 查不到，用 order_id 查询（兼容旧数据）
    if (courses.length === 0 && (formalOrders || []).length > 0) {
      logger.debug('尝试用 order_id 查询', { studentId, orderCount: (formalOrders || []).length })
      const orderIdResult = await supabaseServer
        .from('courses')
        .select(COURSE_SELECT)
        .in('order_id', (formalOrders || []).map(o => o.id))

      logger.debug('order_id 查询结果', {
        studentId,
        hasError: Boolean(orderIdResult.error),
        count: orderIdResult.data?.length || 0,
      })

      if (!orderIdResult.error && orderIdResult.data) {
        courses = orderIdResult.data
        coursesError = null  // 成功查询，清除错误
      } else {
        coursesError = orderIdResult.error
      }
    }

    if (coursesError) {
      logger.warn('获取课程失败', { studentId, ...summarizeError(coursesError) })
    }

    logger.info('最终课程数据', { studentId, coursesCount: courses.length })

    // 格式化课程数据
    const formattedCourses = (courses || []).map((course: any) => ({
      ...course,
      teacher_name: course.teacher?.name || course.teacher_name,
      order_number: course.formal_orders?.order_number,
    }))

    const formalOrderSummaries = await calculateFormalOrderBalanceSummaries(formalOrders || [])
    const summaryByOrderId = new Map(formalOrderSummaries.map((summary) => [summary.order_id, summary]))
    const formalOrdersWithComputedStatus = (formalOrders || []).map((order: any) => {
      const summary = summaryByOrderId.get(order.id)
      if (!summary) return order

      return {
        ...order,
        computed_status: summary.computed_status,
        computed_status_label: summary.computed_status_label,
      }
    })

    // 6. 获取回访记录
    const { data: visitRecords, error: visitRecordsError } = await supabaseServer
      .from('visit_records')
      .select(VISIT_RECORD_SELECT)
      .eq('student_id', studentId)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (visitRecordsError) {
      logger.warn('获取回访记录失败', { studentId, ...summarizeError(visitRecordsError) })
    }

    let visitRecordsWithNames = visitRecords || []
    const visitPersonnelIds = uniqueValues((visitRecords || []).map((record: any) => record.visit_personnel))
    if (visitPersonnelIds.length > 0) {
      const { data: users } = await supabaseServer
        .from('user_profiles')
        .select('id, name')
        .in('id', visitPersonnelIds)

      const userMap = new Map((users || []).map((user: any) => [user.id, user.name]))
      visitRecordsWithNames = (visitRecords || []).map((record: any) => ({
        ...record,
        visit_personnel_name: userMap.get(record.visit_personnel) || '未知',
      }))
    }

    // 7. 获取状态变更历史
    const { data: statusHistory, error: statusHistoryError } = await supabaseServer
      .from('student_status_history')
      .select(STATUS_HISTORY_SELECT)
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false })

    if (statusHistoryError) {
      logger.warn('获取状态变更历史失败', { studentId, ...summarizeError(statusHistoryError) })
    }

    let statusHistoryWithOperators = statusHistory || []
    const operatorIds = uniqueValues((statusHistory || []).map((record: any) => record.changed_by))
    if (operatorIds.length > 0) {
      const { data: operators } = await supabaseServer
        .from('user_profiles')
        .select('id, name')
        .in('id', operatorIds)

      const operatorMap = new Map((operators || []).map((user: any) => [user.id, user.name]))
      statusHistoryWithOperators = (statusHistory || []).map((record: any) => ({
        ...record,
        operator_name: record.changed_by ? (operatorMap.get(record.changed_by) || '未知用户') : '系统',
      }))
    }

    // 8. 获取异动记录。新数据优先使用 student_id，历史数据用学生姓名兜底。
    const { data: transactions, error: transactionsError } = await supabaseServer
      .from('transaction_records')
      .select(TRANSACTION_RECORD_SELECT)
      .or(`student_id.eq.${studentId},student_name.eq.${encodePostgrestValue(student.student_name)}`)
      .order('creation_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (transactionsError) {
      logger.warn('获取异动记录失败', { studentId, ...summarizeError(transactionsError) })
    }

    // 9. 获取 ClassIn 课堂记录（通过当前学生课程关联）
    const classinCourseIds = Array.from(new Set((courses || [])
      .map((course: any) => course.classin_course_id)
      .filter((courseId: unknown) => courseId !== null && courseId !== undefined && String(courseId).trim() !== '')
    ))
    const { data: classrooms, error: classroomsError } = classinCourseIds.length > 0
      ? await supabaseServer
        .from('classroom_classin')
        .select(CLASSROOM_SELECT)
        .in('course_id', classinCourseIds)
        .order('start_time', { ascending: false })
        .limit(50)
      : { data: [] as any[], error: null }

    if (classroomsError) {
      logger.warn('获取ClassIn课堂记录失败', { studentId, ...summarizeError(classroomsError) })
    }

    // 组装返回数据
    const detailData = {
      student: redactStudentClassInSecrets({
        ...student,
        head_teacher: headTeacher,
      }, profile),
      orders: redactFormalOrdersSensitiveFields(formalOrdersWithComputedStatus, profile),
      trialLessons: redactTrialLessonsSensitiveFields(trialLessonsWithStatus || [], profile),
      courses: formattedCourses || [],
      classrooms: classrooms || [],
      visitRecords: visitRecordsWithNames || [],
      statusHistory: statusHistoryWithOperators || [],
      transactions: transactions || [],
      formalOrderSummaries,
      // 统计信息
      stats: {
        formalOrdersCount: formalOrders?.length || 0,
        trialLessonsCount: trialLessonsWithStatus?.length || 0,
        coursesCount: formattedCourses?.length || 0,
        classroomsCount: classrooms?.length || 0,
        visitRecordsCount: visitRecordsWithNames?.length || 0,
        statusHistoryCount: statusHistoryWithOperators?.length || 0,
        transactionsCount: transactions?.length || 0,
        totalFormalHours: formalOrders?.reduce((sum, order) => sum + (order.total_hours || 0), 0) || 0,
        totalFormalAmount: formalOrders?.reduce((sum, order) => sum + (order.payment_amount || 0), 0) || 0,
        completedFormalHours: formalOrderSummaries.reduce((sum: number, order: any) => sum + order.completed_hours, 0),
        remainingFormalHours: formalOrderSummaries.reduce((sum: number, order: any) => sum + order.remaining_hours, 0),
        remainingFormalAmount: formalOrderSummaries.reduce((sum: number, order: any) => sum + order.remaining_amount, 0),
      },
    }

    logger.debug('获取学生详情成功', { studentId })
    return NextResponse.json({ data: detailData })

  } catch (error) {
    logger.error('获取学生详情异常', summarizeError(error))
    return NextResponse.json(
      { error: '获取学生详情失败' },
      { status: 500 }
    )
  }
}
