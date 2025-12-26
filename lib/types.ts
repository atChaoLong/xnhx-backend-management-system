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
  classinUid: number               // ClassIn 唯一标识符
  studentNumber?: string          // 学生学号
  name: string
  grade: string
  region: string
  parentPhone: string
  parentWechat: string
  mobile?: string                 // 学生本人联系电话
  school?: string                 // 学校
  headTeacherId?: string          // 班主任ID
  status?: string                 // 状态

  // ClassIn 额外字段
  schoolUid?: number              // ClassIn 学校 UID
  serveState?: number             // 服务状态 (2=在籍)
  joinType?: number               // 加入类型
  studId?: number                 // ClassIn 学生 ID
  classinExtra?: {                // ClassIn 额外信息
    labelInfo?: any[]
    progressInfo?: any
    publicResourceStatus?: number
  }

  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// ClassIn 学生原始数据类型
// ============================================
export interface StudentClassin {
  uid: number                       // ClassIn 唯一标识符（主键）
  createdAt: string
  updatedAt: string

  // 数据库字段（snake_case）
  stud_id?: number                  // 学生ID (对应 API: studId)
  name: string                      // 学生姓名
  join_type?: number                // 加入类型 (对应 API: joinType)
  mobile?: string                   // 手机号
  email?: string                    // 邮箱
  account_status?: number           // 账号状态 (对应 API: accountStatus)
  cat_info?: any[]                  // 分类信息 (对应 API: catInfo)
  lable_info?: any[]                // 标签信息 (对应 API: lableInfo)
  stuno?: string                    // 学号
  isdel?: number                    // 是否删除 (0=正常, 1=已删除)
  addtime?: number                  // 添加时间 (Unix时间戳)
  serve_state?: number              // 服务状态 (对应 API: serveState)

  // 同步相关字段
  sync_time?: string                // 最后同步时间
  notes?: string                    // 备注
}

// ============================================
// 老师档案类型
// ============================================
export interface TeacherProfile {
  id: string
  createdAt: string
  updatedAt: string

  // 基本信息
  classinUid: number                  // ClassIn 唯一标识符
  teacherName: string              // 老师姓名
  gender: string                   // 性别
  wechat: string                   // 微信号
  classinPhone: string             // ClassIn注册手机号
  mobile?: string                  // 常用联系电话
  location: string                 // 老师所在地

  // 教学信息
  subjects: string[]               // 教授学科
  gradeLevels: string[]            // 教授年级段
  usedClassin: boolean             // 是否用过Classin
  hasCertificate: boolean          // 是否有教资证

  // 学历背景
  education: string                // 学历
  university: string               // 毕业院校

  // 教学能力
  availableTimes?: string[]        // 可排课时间
  textbookVersions?: string[]      // 熟悉的教材版本
  studentRegions?: string[]        // 带过学生地域
  studentLevels?: string[]         // 擅长的学生水平
  teachingYears?: number           // 教学年限

  // 教学经历
  teachingStyle?: string           // 教学特点
  successCases?: string            // 优秀学员提分案例

  // 附件
  photoUrl?: string                // 老师形象照URL
  reviewScreenshots?: string[]     // 提分/好评截图URLs

  // 其他
  notes?: string                   // 备注
  bankCardInfo?: any               // 银行卡信息 (JSONB)
}

// ============================================
// 老师类型
// ============================================
export interface Teacher {
  id: string
  createdAt: string
  updatedAt: string

  // ClassIn 核心字段
  classinUid: number               // ClassIn 唯一标识符
  name: string                     // 老师姓名
  mobile: string                   // 手机号
  email: string                    // 邮箱
  gender: string                   // 性别
  location: string                 // 所在地

  // 教学信息
  subject: string                  // 教授科目
  grade: string                    // 教授年级
  teachType: string                // 教学类型
  education: string                // 学历
  university: string               // 毕业院校

  // ClassIn 特有字段
  schoolUid?: number              // 学校编号
  joinType?: number               // 加入类型
  serveState?: number             // 服务状态
  teaId?: number                  // 老师ID
  isDel?: number                  // 是否删除

  // 状态字段
  status: string                   // 本地状态
  syncTime?: string                // 最后同步时间
  notes?: string                   // 备注

  // ClassIn 额外信息
  classinExtra?: {                // ClassIn 额外信息
    labelInfo?: any[]
    [key: string]: any
  }
}

// ============================================
// ClassIn 老师原始数据类型
// ============================================
export interface TeacherClassin {
  uid: number                      // ClassIn 唯一标识符（主键）
  createdAt: string
  updatedAt: string

  // 数据库字段（snake_case）
  st_id?: number                   // 老师ID (对应 API: stId)
  name: string                     // 老师姓名
  logo?: string                    // 头像URL
  emp_no?: string                  // 工号 (对应 API: empNo)
  position?: string                // 职位
  is_del?: number                  // 是否删除 (0=正常, 1=已删除, 对应 API: isDel)
  join_type?: number               // 加入类型 (1=正常加入, 对应 API: joinType)
  departments_info?: any[]         // 部门信息 (对应 API: departmentsInfo)
  mobile?: string                  // 手机号
  email?: string                   // 邮箱
  account_status?: number          // 账号状态 (对应 API: accountStatus)

  // 同步相关字段
  sync_time?: string               // 最后同步时间
  notes?: string                   // 备注
}

// ============================================
// 老师类型（旧版，用于内部老师管理）
// ============================================
export interface OldTeacher {
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

export type NewTeacherProfile = Omit<TeacherProfile, "id" "createdAt" "updatedAt">
export type UpdateTeacherProfile = Partial<NewTeacherProfile> & { id: string }

export type NewStudent = Omit<Student, "id" "createdAt" "updatedAt">
export type UpdateStudent = Partial<NewStudent> & { id: string }

export type NewStudentClassin = Omit<StudentClassin, "uid" "createdAt" "updatedAt">
export type UpdateStudentClassin = Partial<NewStudentClassin> & { uid: number }

export type NewTeacher = Omit<Teacher, "id" "createdAt" "updatedAt">
export type UpdateTeacher = Partial<NewTeacher> & { id: string }

export type NewTeacherClassin = Omit<TeacherClassin, "uid" "createdAt" "updatedAt">
export type UpdateTeacherClassin = Partial<NewTeacherClassin> & { uid: number }

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
