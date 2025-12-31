/**
 * 业务状态计算工具
 * 自动计算线索、试听、学生、退费等业务状态
 */

import { supabaseServer } from './supabase'

// ==================== 线索状态 ====================

/**
 * 线索添加状态
 */
export enum LeadAddStatus {
  UNASSIGNED = 'unassigned',        // 运营未派单
  ADDED = 'added',                  // 已添加
  NOT_ADDED = 'not_added',          // 未添加
  WAITING_FEEDBACK = 'waiting_feedback' // 销售未反馈
}

/**
 * 线索转化状态
 */
export enum LeadConvertStatus {
  TRIAL = 'trial',                  // 试听
  FORMAL = 'formal',                // 正式
  EMPTY = 'empty'                   // 空
}

/**
 * 检查线索是否产生试听
 */
async function checkIfHasTrialLesson(leadId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from('trial_lessons')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1)

  return !!data && data.length > 0
}

/**
 * 检查线索是否产生正式订单
 */
async function checkIfHasFormalOrder(leadId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from('formal_orders')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1)

  return !!data && data.length > 0
}

/**
 * 计算线索添加状态
 *
 * 状态流转规则:
 * 1. 运营未派单: grab_wechat 为空
 * 2. 已添加: add_status = 'added' 或产生试听
 * 3. 未添加: add_status = 'not_added' 且无试听
 * 4. 销售未反馈: add_status 为空且无试听
 */
export async function calculateLeadAddStatus(lead: any): Promise<LeadAddStatus> {
  // 1. 运营未派单：抢单微信号为空
  if (!lead.grab_wechat || lead.grab_wechat.trim() === '') {
    return LeadAddStatus.UNASSIGNED
  }

  // 2. 检查是否产生试听
  const hasTrialLesson = await checkIfHasTrialLesson(lead.id)

  // 3. 已添加 (even if add_status is 'not_added', if trial exists then 'added')
  if (lead.add_status === 'added' || hasTrialLesson) {
    return LeadAddStatus.ADDED
  }

  // 4. 未添加
  if (lead.add_status === 'not_added') {
    return LeadAddStatus.NOT_ADDED
  }

  // 5. 销售未反馈
  if (!lead.add_status && !hasTrialLesson) {
    return LeadAddStatus.WAITING_FEEDBACK
  }

  return LeadAddStatus.WAITING_FEEDBACK
}

/**
 * 计算线索转化状态
 */
export async function calculateLeadConvertStatus(lead: any): Promise<LeadConvertStatus> {
  const hasFormalOrder = await checkIfHasFormalOrder(lead.id)
  const hasTrialLesson = await checkIfHasTrialLesson(lead.id)

  if (hasFormalOrder) {
    return LeadConvertStatus.FORMAL
  }

  if (hasTrialLesson) {
    return LeadConvertStatus.TRIAL
  }

  return LeadConvertStatus.EMPTY
}

/**
 * 获取线索添加状态的中文显示名称
 */
export function getLeadAddStatusName(status: LeadAddStatus): string {
  const names = {
    [LeadAddStatus.UNASSIGNED]: '运营未派单',
    [LeadAddStatus.ADDED]: '已添加',
    [LeadAddStatus.NOT_ADDED]: '未添加',
    [LeadAddStatus.WAITING_FEEDBACK]: '销售未反馈',
  }
  return names[status] || status
}

/**
 * 获取线索转化状态的中文显示名称
 */
export function getLeadConvertStatusName(status: LeadConvertStatus): string {
  const names = {
    [LeadConvertStatus.TRIAL]: '试听',
    [LeadConvertStatus.FORMAL]: '正式',
    [LeadConvertStatus.EMPTY]: '',
  }
  return names[status] || status
}

// ==================== 试听状态 ====================

/**
 * 试听状态
 */
export enum TrialLessonStatus {
  CANCELLED = 'cancelled',           // 取消试听
  WAITING_MATCH = 'waiting_match',   // 待匹配老师
  WAITING_CONFIRM = 'waiting_confirm', // 待确认老师
  WAITING_TIME = 'waiting_time',     // 待确认时间
  WAITING_LINK = 'waiting_link',     // 待开链接
  SCHEDULED = 'scheduled',           // 已排待上课
  WAITING_FEEDBACK = 'waiting_feedback', // 上完待反馈
  COMPLETED = 'completed'            // 已完成
}

/**
 * 检查试听是否产生正式订单
 */
async function checkIfHasFormalOrderFromLesson(lessonId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from('formal_orders')
    .select('id')
    .eq('trial_lesson_id', lessonId)
    .limit(1)

  return !!data && data.length > 0
}

/**
 * 计算试听状态
 */
export async function calculateTrialLessonStatus(lesson: any): Promise<TrialLessonStatus> {
  const today = new Date()
  today.setHours(23, 59, 59, 999) // 今天的最后一刻

  // a. 取消试听："课程状态"=取消试听
  if (lesson.course_status === '取消试听') {
    return TrialLessonStatus.CANCELLED
  }

  // b. 待匹配老师：初始状态（matched_teacher 为空）
  if (!lesson.matched_teacher || lesson.matched_teacher.trim() === '') {
    return TrialLessonStatus.WAITING_MATCH
  }

  // c. 待确认老师："匹配老师"不为空 and "确认老师（教务）"为空
  if (lesson.matched_teacher &&
      (!lesson.confirmed_teacher || lesson.confirmed_teacher.trim() === '')) {
    return TrialLessonStatus.WAITING_CONFIRM
  }

  // d. 待确认时间："匹配老师"不为空 and "确认老师（教务）"不为空 and "试听时间"为空
  if (lesson.matched_teacher &&
      lesson.confirmed_teacher &&
      (!lesson.trial_time || lesson.trial_time.trim() === '')) {
    return TrialLessonStatus.WAITING_TIME
  }

  // e. 待开链接："匹配老师"不为空 and "确认老师（教务）"不为空 and "试听时间"不为空 and "上课链接"为空
  if (lesson.matched_teacher &&
      lesson.confirmed_teacher &&
      lesson.trial_time &&
      (!lesson.class_link || lesson.class_link.trim() === '')) {
    return TrialLessonStatus.WAITING_LINK
  }

  // 所有前置字段都已填写，检查时间和转化状态
  // 使用 trial_time 而不是 confirmed_time
  const lessonTime = new Date(lesson.trial_time)
  lessonTime.setHours(23, 59, 59, 999) // 当天的最后一刻

  // 先检查是否已转化
  const isConverted = await calculateIsConverted(lesson)

  // h. 已完成："是否转化"不为空
  if (isConverted) {
    return TrialLessonStatus.COMPLETED
  }

  // f. 已排待上课：时间还未到，且未转化
  if (lessonTime > today) {
    return TrialLessonStatus.SCHEDULED
  }

  // g. 上完待反馈：时间已过，且"是否转化"为空
  // 课程时间已过但没有转化标记
  if (lessonTime <= today) {
    return TrialLessonStatus.WAITING_FEEDBACK
  }

  // 默认返回已完成
  return TrialLessonStatus.COMPLETED
}

/**
 * 计算是否转化
 *
 * 规则：
 * - 是：产生正式订单 or "是否转化（手动）"=是
 * - 其他选项都等于"是否转化（手动）"的值
 */
export async function calculateIsConverted(lesson: any): Promise<boolean> {
  // 检查是否产生正式订单
  const hasFormalOrder = await checkIfHasFormalOrderFromLesson(lesson.id)
  if (hasFormalOrder) {
    return true
  }

  // 检查手动标记
  const manualConverted = lesson.manual_converted

  // 手动标记为"是"
  if (manualConverted === '是') {
    return true
  }

  // 手动标记为"否"或"待定"
  if (manualConverted === '否' || manualConverted === '待定') {
    return false
  }

  // 没有手动标记，默认未转化
  if (!manualConverted || manualConverted.trim() === '') {
    return false
  }

  // 其他情况默认未转化
  return false
}

/**
 * 获取试听状态的中文显示名称
 */
export function getTrialLessonStatusName(status: TrialLessonStatus): string {
  const names = {
    [TrialLessonStatus.CANCELLED]: '取消试听',
    [TrialLessonStatus.WAITING_MATCH]: '待匹配老师',
    [TrialLessonStatus.WAITING_CONFIRM]: '待确认老师',
    [TrialLessonStatus.WAITING_TIME]: '待确认时间',
    [TrialLessonStatus.WAITING_LINK]: '待开链接',
    [TrialLessonStatus.SCHEDULED]: '已排待上课',
    [TrialLessonStatus.WAITING_FEEDBACK]: '上完待反馈',
    [TrialLessonStatus.COMPLETED]: '已完成',
  }
  return names[status] || status
}

// ==================== 学生状态 ====================

/**
 * 学生状态
 */
export enum StudentStatus {
  MISSING = 'missing',           // 缺状态
  LOW_HOURS = 'low_hours',       // 快没课
  NORMAL = 'normal',             // 正常
}

/**
 * 新生状态
 */
export enum StudentNewStatus {
  WEEK_1 = 'week_1',             // 一周新生
  WEEK_2 = 'week_2',             // 两周新生
  WEEK_3 = 'week_3',             // 三周新生
  WEEK_4 = 'week_4',             // 四周新生
  OLD = 'old',                   // 老生
}

/**
 * 回访状态
 */
export enum VisitStatus {
  VISITED = 'visited',           // 已回访
  NOT_VISITED = 'not_visited',   // 未回访
}

/**
 * 查询本月回访次数
 */
async function countVisitsThisMonth(studentId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const { data } = await supabaseServer
    .from('visit_records')
    .select('id')
    .eq('student_id', studentId)
    .gte('visit_date', startOfMonth.toISOString().split('T')[0]) // 使用日期格式
    .lt('visit_date', endOfMonth.toISOString().split('T')[0])

  return data?.length || 0
}

/**
 * 计算学生状态
 */
export function calculateStudentStatus(student: any): StudentStatus {
  if (!student.status) {
    return StudentStatus.MISSING
  }

  if (student.course_end_date) {
    const today = new Date()
    const endDate = new Date(student.course_end_date)
    const diffDays = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 7) {
      return StudentStatus.LOW_HOURS
    }
  }

  return StudentStatus.NORMAL
}

/**
 * 计算新生状态
 */
export function calculateStudentNewStatus(student: any): StudentNewStatus {
  if (!student.first_enrollment_date) {
    return StudentNewStatus.OLD
  }

  const today = new Date()
  const enrollDate = new Date(student.first_enrollment_date)
  const diffWeeks = Math.floor((today.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24 * 7))

  if (diffWeeks < 1) return StudentNewStatus.WEEK_1
  if (diffWeeks < 2) return StudentNewStatus.WEEK_2
  if (diffWeeks < 3) return StudentNewStatus.WEEK_3
  if (diffWeeks < 4) return StudentNewStatus.WEEK_4

  return StudentNewStatus.OLD
}

/**
 * 计算回访状态
 */
export async function calculateVisitStatus(student: any): Promise<VisitStatus> {
  const thisMonthVisits = await countVisitsThisMonth(student.id)
  return thisMonthVisits > 0 ? VisitStatus.VISITED : VisitStatus.NOT_VISITED
}

/**
 * 获取学生状态的中文显示名称
 */
export function getStudentStatusName(status: StudentStatus): string {
  const names = {
    [StudentStatus.MISSING]: '缺状态',
    [StudentStatus.LOW_HOURS]: '快没课',
    [StudentStatus.NORMAL]: '正常',
  }
  return names[status] || status
}

/**
 * 获取新生状态的中文显示名称
 */
export function getStudentNewStatusName(status: StudentNewStatus): string {
  const names = {
    [StudentNewStatus.WEEK_1]: '一周新生',
    [StudentNewStatus.WEEK_2]: '两周新生',
    [StudentNewStatus.WEEK_3]: '三周新生',
    [StudentNewStatus.WEEK_4]: '四周新生',
    [StudentNewStatus.OLD]: '老生',
  }
  return names[status] || status
}

/**
 * 获取回访状态的中文显示名称
 */
export function getVisitStatusName(status: VisitStatus): string {
  const names = {
    [VisitStatus.VISITED]: '已回访',
    [VisitStatus.NOT_VISITED]: '未回访',
  }
  return names[status] || status
}

// ==================== 退费状态 ====================

/**
 * 退费状态
 */
export enum RefundStatus {
  WAITING_VERIFY = 'waiting_verify',     // 待核对金额
  WAITING_PAYMENT = 'waiting_payment',   // 待财务打款
  WAITING_PERFORMANCE = 'waiting_performance', // 待核对业绩
  COMPLETED = 'completed',               // 已完成
}

/**
 * 计算退费状态
 */
export function calculateRefundStatus(transaction: any): RefundStatus {
  // 根据业务流程字段判断
  if (transaction.performance_verified) {
    return RefundStatus.COMPLETED
  }

  if (transaction.payment_completed) {
    return RefundStatus.WAITING_PERFORMANCE
  }

  if (transaction.hours_verified) {
    return RefundStatus.WAITING_PAYMENT
  }

  return RefundStatus.WAITING_VERIFY
}

/**
 * 获取退费状态的中文显示名称
 */
export function getRefundStatusName(status: RefundStatus): string {
  const names = {
    [RefundStatus.WAITING_VERIFY]: '待核对金额',
    [RefundStatus.WAITING_PAYMENT]: '待财务打款',
    [RefundStatus.WAITING_PERFORMANCE]: '待核对业绩',
    [RefundStatus.COMPLETED]: '已完成',
  }
  return names[status] || status
}

// ==================== 批量计算工具 ====================

/**
 * 批量计算线索状态
 */
export async function batchCalculateLeadStatus(leads: any[]) {
  const results = []

  for (const lead of leads) {
    const addStatus = await calculateLeadAddStatus(lead)
    const convertStatus = await calculateLeadConvertStatus(lead)

    results.push({
      id: lead.id,
      addStatus,
      convertStatus,
      addStatusName: getLeadAddStatusName(addStatus),
      convertStatusName: getLeadConvertStatusName(convertStatus),
    })
  }

  return results
}

/**
 * 批量计算试听状态
 */
export async function batchCalculateTrialLessonStatus(lessons: any[]) {
  const results = []

  for (const lesson of lessons) {
    const status = await calculateTrialLessonStatus(lesson)
    const isConverted = await calculateIsConverted(lesson)

    results.push({
      id: lesson.id,
      status,
      isConverted,
      statusName: getTrialLessonStatusName(status),
    })
  }

  return results
}

/**
 * 批量计算学生状态
 */
export async function batchCalculateStudentStatus(students: any[]) {
  const results = []

  for (const student of students) {
    const status = calculateStudentStatus(student)
    const newStatus = calculateStudentNewStatus(student)
    const visitStatus = await calculateVisitStatus(student)

    results.push({
      id: student.id,
      status,
      newStatus,
      visitStatus,
      statusName: getStudentStatusName(status),
      newStatusName: getStudentNewStatusName(newStatus),
      visitStatusName: getVisitStatusName(visitStatus),
    })
  }

  return results
}
