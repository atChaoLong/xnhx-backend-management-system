import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { batchCalculateTrialLessonStatus } from "@/lib/status-calculator"
import { getProfileFromHeaders } from "@/lib/server-profile-from-headers"
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
    const profile = await getProfileFromHeaders(request)

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

    // 3. 并行获取所有独立数据（6个查询同时执行）
    const trialFilters = [
      `student_id.eq.${studentId}`,
      student.parent_phone ? `phone.eq.${encodePostgrestValue(student.parent_phone)}` : '',
    ].filter(Boolean)

    const [
      formalOrdersResult,
      trialLessonsResult,
      coursesResult,
      visitRecordsResult,
      statusHistoryResult,
      transactionsResult,
    ] = await Promise.all([
      // 正式订单
      supabaseServer
        .from('formal_orders')
        .select(FORMAL_ORDER_SELECT)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      // 试听课
      trialFilters.length > 0
        ? supabaseServer
            .from('trial_lessons')
            .select(TRIAL_LESSON_SELECT_BASE)
            .or(trialFilters.join(','))
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null }),
      // 课程
      supabaseServer
        .from('courses')
        .select(COURSE_SELECT)
        .eq('student_id', studentId),
      // 回访记录
      supabaseServer
        .from('visit_records')
        .select(VISIT_RECORD_SELECT)
        .eq('student_id', studentId)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false }),
      // 状态变更历史
      supabaseServer
        .from('student_status_history')
        .select(STATUS_HISTORY_SELECT)
        .eq('student_id', studentId)
        .order('changed_at', { ascending: false }),
      // 异动记录
      supabaseServer
        .from('transaction_records')
        .select(TRANSACTION_RECORD_SELECT)
        .or(`student_id.eq.${studentId},student_name.eq.${encodePostgrestValue(student.student_name)}`)
        .order('creation_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    const formalOrders = formalOrdersResult.data
    if (formalOrdersResult.error) {
      logger.warn('获取正式订单失败', { studentId, ...summarizeError(formalOrdersResult.error) })
    }

    const trialLessons = trialLessonsResult.data || []
    if (trialLessonsResult.error) {
      logger.warn('获取试听课失败', { studentId, ...summarizeError(trialLessonsResult.error) })
    }

    let courses: any[] = []
    if (!coursesResult.error && coursesResult.data) {
      courses = coursesResult.data
    } else if ((formalOrders || []).length > 0) {
      const orderIdResult = await supabaseServer
        .from('courses')
        .select(COURSE_SELECT)
        .in('order_id', (formalOrders || []).map(o => o.id))
      if (!orderIdResult.error && orderIdResult.data) {
        courses = orderIdResult.data
      }
    }

    const visitRecords = visitRecordsResult.data
    if (visitRecordsResult.error) {
      logger.warn('获取回访记录失败', { studentId, ...summarizeError(visitRecordsResult.error) })
    }

    const statusHistory = statusHistoryResult.data
    if (statusHistoryResult.error) {
      logger.warn('获取状态变更历史失败', { studentId, ...summarizeError(statusHistoryResult.error) })
    }

    const transactions = transactionsResult.data
    if (transactionsResult.error) {
      logger.warn('获取异动记录失败', { studentId, ...summarizeError(transactionsResult.error) })
    }

    // 4. 并行处理所有依赖性计算（试听状态、订单余额、回访人员名、操作员名、ClassIn课堂）
    const visitPersonnelIds = uniqueValues((visitRecords || []).map((record: any) => record.visit_personnel))
    const operatorIds = uniqueValues((statusHistory || []).map((record: any) => record.changed_by))
    const classinCourseIds = Array.from(new Set((courses || [])
      .map((course: any) => course.classin_course_id)
      .filter((courseId: unknown) => courseId !== null && courseId !== undefined && String(courseId).trim() !== '')
    ))

    const [
      trialStatusResults,
      formalOrderSummaries,
      visitUsersResult,
      operatorUsersResult,
      classroomsResult,
    ] = await Promise.all([
      // 试听课状态
      trialLessons.length > 0
        ? batchCalculateTrialLessonStatus(trialLessons).catch(() => [])
        : Promise.resolve([]),
      // 正式订单余额汇总
      calculateFormalOrderBalanceSummaries(formalOrders || []),
      // 回访人员名称
      visitPersonnelIds.length > 0
        ? supabaseServer.from('user_profiles').select('id, name').in('id', visitPersonnelIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      // 状态变更操作员名称
      operatorIds.length > 0
        ? supabaseServer.from('user_profiles').select('id, name').in('id', operatorIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      // ClassIn课堂记录
      classinCourseIds.length > 0
        ? supabaseServer
            .from('classroom_classin')
            .select(CLASSROOM_SELECT)
            .in('course_id', classinCourseIds)
            .order('start_time', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    // 合并试听状态
    let trialLessonsWithStatus = trialLessons
    if (trialStatusResults.length > 0) {
      trialLessonsWithStatus = trialLessons.map((lesson, index) => ({
        ...lesson,
        lesson_status: trialStatusResults[index]?.status,
        lesson_status_name: trialStatusResults[index]?.statusName,
        is_converted_calculated: trialStatusResults[index]?.isConverted,
      }))
    }

    // 合并回访人员名称
    const visitUserMap = new Map((visitUsersResult.data || []).map((user: any) => [user.id, user.name]))
    const visitRecordsWithNames = (visitRecords || []).map((record: any) => ({
      ...record,
      visit_personnel_name: record.visit_personnel
        ? (visitUserMap.get(record.visit_personnel) || '未知')
        : '未知',
    }))

    // 合并状态变更操作员名称
    const operatorMap = new Map((operatorUsersResult.data || []).map((user: any) => [user.id, user.name]))
    const statusHistoryWithOperators = (statusHistory || []).map((record: any) => ({
      ...record,
      operator_name: record.changed_by ? (operatorMap.get(record.changed_by) || '未知用户') : '系统',
    }))

    const classrooms = classroomsResult.data
    if (classroomsResult.error) {
      logger.warn('获取ClassIn课堂记录失败', { studentId, ...summarizeError(classroomsResult.error) })
    }

    // 格式化课程数据
    const formattedCourses = (courses || []).map((course: any) => ({
      ...course,
      teacher_name: course.teacher?.name || course.teacher_name,
      order_number: course.formal_orders?.order_number,
    }))

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
