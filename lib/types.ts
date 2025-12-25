// ============================================
// 用户类型
// ============================================
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: "admin" | "sales" | "manager" | "teacher"
  createdAt: string
}

// ============================================
// 线索类型
// ============================================
export interface Lead {
  id: string
  orderSerial: string          // 报单序号
  entryDate: string            // 录单日期
  sourceAccount: string        // 小红书账号来源
  addMethodCode: string        // 添加方式
  operatorName: string         // 运营人员
  grade: string                // 年级
  subjects: string[]           // 咨询学科
  regionIp: string             // 地域IP
  parentWechat: string         // 家长微信号
  chatScreenshots?: string[]   // 聊天截图
  grabWechat: string           // 抢单微信号
  feedbackStatus: "pending" | "contacted" | "converted" | "lost"  // 反馈状态
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// 老师面试类型
// ============================================
export interface TeacherCandidate {
  id: string
  dailyLeadId?: string

  // 基本信息
  name: string
  wechatId: string
  resumeUrl?: string
  profilePhotoUrl?: string

  // 岗位信息
  gradeLevel: string
  subjectsTaught: string[]
  teacherType: string
  trialSubject?: string
  teachingStyle?: string

  // 约面信息
  interviewDate?: string
  interviewerName?: string
  interviewTime?: string
  interviewLink?: string
  interviewOfficer?: string

  // 面试评分（10个评分字段）
  interviewScore?: number
  logicalExpressionScore?: number
  dressAppearanceScore?: number
  materialPreparationScore?: number
  examScore?: number
  // ... 其他评分字段

  // 素质评价
  initialEvaluation?: string
  teacherCharacteristics?: string
  mandarinLevel?: string
  researchAbility?: string
  serviceAwareness?: string
  affinity?: string

  // 复核状态
  reviewStatus: "pending" | "reviewed" | "not-suitable"
  reviewResult?: string
  reviewEvaluationComment?: string
  reviewDate?: string
  reviewedBy?: string

  // 招聘决定
  isHired: boolean
  teacherFeeling?: string
  suitableForStudents?: string
  schedulingPreference?: string
  teacherLevel?: string
  canTeachGraduationClass: boolean

  // 薪资信息
  currentRate?: number
  approvedHourlyRate?: number

  createdAt: string
  updatedAt: string
}

// ============================================
// 学生类型
// ============================================
export interface Student {
  id: string
  name: string
  grade: string
  region: string
  parentPhone: string
  parentWechat: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// 老师类型
// ============================================
export interface Teacher {
  id: string
  name: string
  wechatId: string
  gradeLevel: string
  subjects: string[]
  teacherType: string
  hourlyRate: number
  availability: string
  resumeUrl?: string
  profilePhotoUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============================================
// 试听课程类型
// ============================================
export interface TrialLesson {
  id: string
  childName: string
  status: "scheduled" | "completed" | "cancelled" | "no-show"
  leadId?: string

  region: string
  grade: string
  trialSubject: string
  trialTime: string
  trialDuration: number

  phone: string
  channel: string
  trialAmount: number
  paymentProof?: string

  urgencyLevel: "low" | "medium" | "high"
  notes?: string

  assignedConsultant?: string
  courseStatus: string
  studentType: string

  matchedTeacher?: string
  confirmedTeacher?: string
  classLink?: string

  createdAt: string
  updatedAt: string
}

// ============================================
// 正式订单类型
// ============================================
export interface FormalOrder {
  id: string
  studentId: string
  orderNumber: string           // 自动生成

  teacherNames: string[]
  subjects: string[]

  orderType: string
  totalHours: number
  paymentChannel: string
  paymentAmount: number
  hourlyRate: number
  paymentProof?: string

  paymentTime: string
  consultantTeacher: string
  orderNotes?: string

  totalSessions: number
  sessionDuration: number
  fixedMode: string
  frequency: string

  officialStartTime: string
  firstClassTime: string

  status: "active" | "completed" | "cancelled" | "suspended"

  createdAt: string
  updatedAt: string
}

// ============================================
// 每日线索类型
// ============================================
export interface DailyLead {
  id: string
  name: string
  wechatNumber: string
  assignedPerson: string
  receivedDate: string
  isAdded: boolean
  resumeAttachment?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// 微信号管理类型
// ============================================
export interface WechatAccount {
  id: string
  accountName: string
  wechatId: string
  purpose: string
  status: "active" | "inactive" | "banned"
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// 销售人员类型
// ============================================
export interface SalesPersonnel {
  id: string
  name: string
  phone: string
  email: string
  status: "active" | "inactive"
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// 异动记录类型
// ============================================
export interface TransactionRecord {
  id: string
  studentId: string
  studentName?: string
  transactionType: string
  description: string
  transactionDate: string
  handledBy: string
  notes?: string
  createdAt: string
}

// ============================================
// 系统字典类型
// ============================================
export interface SysDictionary {
  id: string
  category: string
  code: string
  label: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============================================
// 自定义视图类型
// ============================================
export interface TeacherView {
  id: string
  name: string
  description?: string
  columns: string[]
  sortBy?: string
  sortOrder: "asc" | "desc"
  isPublic: boolean
  createdBy: string
  createdAt: string
}

// ============================================
// 活动记录类型
// ============================================
export interface Activity {
  id: string
  type: "call" | "meeting" | "email" | "note" | "deal-update" | "order-update"
  description: string
  customerId?: string
  customerName?: string
  dealId?: string
  orderId?: string
  createdAt: string
  createdBy: string
}

// ============================================
// 表单相关类型
// ============================================
export type NewLead = Omit<Lead, "id" "createdAt" "updatedAt">
export type UpdateLead = Partial<NewLead> & { id: string }

export type NewTeacherCandidate = Omit<TeacherCandidate, "id" "createdAt" "updatedAt">
export type UpdateTeacherCandidate = Partial<NewTeacherCandidate> & { id: string }

export type NewStudent = Omit<Student, "id" "createdAt" "updatedAt">
export type UpdateStudent = Partial<NewStudent> & { id: string }

export type NewTeacher = Omit<Teacher, "id" "createdAt" "updatedAt">
export type UpdateTeacher = Partial<NewTeacher> & { id: string }

export type NewTrialLesson = Omit<TrialLesson, "id" "createdAt" "updatedAt">
export type UpdateTrialLesson = Partial<NewTrialLesson> & { id: string }

export type NewFormalOrder = Omit<FormalOrder, "id" "orderNumber" "createdAt" "updatedAt">
export type UpdateFormalOrder = Partial<NewFormalOrder> & { id: string }

export type NewDailyLead = Omit<DailyLead, "id" "createdAt" "updatedAt">
export type UpdateDailyLead = Partial<NewDailyLead> & { id: string }

export type NewWechatAccount = Omit<WechatAccount, "id" "createdAt" "updatedAt">
export type UpdateWechatAccount = Partial<NewWechatAccount> & { id: string }

export type NewSalesPersonnel = Omit<SalesPersonnel, "id" "createdAt" "updatedAt">
export type UpdateSalesPersonnel = Partial<NewSalesPersonnel> & { id: string }

export type NewTransactionRecord = Omit<TransactionRecord, "id" "createdAt">
export type UpdateTransactionRecord = Partial<NewTransactionRecord> & { id: string }

export type NewSysDictionary = Omit<SysDictionary, "id" "createdAt" "updatedAt">
export type UpdateSysDictionary = Partial<NewSysDictionary> & { id: string }
