// ============================================
// 用户类型
// ============================================
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: "admin" | "operator" | "sales" | "head_teacher" | "teacher" | "academic_affairs" | "finance" | "hr"
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

  // 业务状态字段（由 status-calculator 计算得出）
  add_status?: 'unassigned' | 'added' | 'not_added' | 'waiting_feedback'  // 添加状态
  add_status_name?: string     // 添加状态中文名
  convert_status?: 'trial' | 'formal' | 'empty'  // 转化状态
  convert_status_name?: string // 转化状态中文名
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

// 学生状态枚举
export enum StudentStatus {
  STUDYING = 'studying',     // 在读
  SUSPENDED = 'suspended',  // 停课
  COMPLETED = 'completed',   // 结课
  REFUNDED = 'refunded'      // 退费
}

// 学生状态显示名称映射
export const StudentStatusLabels: Record<StudentStatus, string> = {
  [StudentStatus.STUDYING]: '在读',
  [StudentStatus.SUSPENDED]: '停课',
  [StudentStatus.COMPLETED]: '结课',
  [StudentStatus.REFUNDED]: '退费',
}

export interface Student {
  id: string
  classinUid: number               // ClassIn 唯一标识符
  studentNumber?: string          // 学生学号
  student_code?: string           // 学生编号（数据库字段）
  name: string
  student_name?: string           // 学生姓名（数据库字段）
  grade: string
  region: string
  parentPhone: string
  parent_phone?: string           // 家长电话（数据库字段）
  parentWechat: string
  mobile?: string                 // 学生本人联系电话
  school?: string                 // 学校
  headTeacherId?: string          // 班主任ID
  head_teacher_id?: string        // 班主任ID（数据库字段）
  head_teacher_name?: string      // 班主任姓名（数据库字段，关联查询）
  status?: StudentStatus | string // 学生状态

  // ClassIn 额外字段
  schoolUid?: number              // ClassIn 学校 UID
  serveState?: number             // 服务状态 (2=在籍)
  joinType?: number               // 加入类型
  studId?: number                 // ClassIn 学生 ID
  classinInitialPassword?: string // ClassIn 初始密码
  classin_uid?: number            // ClassIn UID（数据库字段）
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
  name: string                      // 学生姓名 (对应 API: studentName)
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
// ClassIn 班级原始数据类型
// ============================================
export interface ClassClassin {
  course_id: number                // ClassIn 班级ID（主键）
  created_at: string               // 创建时间
  updated_at: string               // 更新时间

  // 基本信息
  course_name: string              // 班级名称
  creater_name?: string            // 创建者名称
  add_time?: number                // 添加时间 Unix时间戳
  creator_uid?: number             // 创建者UID
  subject_id?: number              // 科目ID
  course_state?: number            // 课程状态
  first_class_begin_time?: number  // 第一次上课时间（Unix时间戳）

  // 同步相关字段
  sync_time?: string               // 最后同步时间
  notes?: string                   // 备注
}

// ============================================
// ClassIn 课堂原始数据类型（简化版）
// ============================================
export interface ClassroomClassin {
  class_id: number                   // ClassIn 课堂ID（主键）
  created_at: string                // 创建时间
  updated_at: string                // 更新时间

  // 基本信息
  name: string                       // 课堂名称
  start_time?: number                // 开始时间 Unix时间戳
  end_time?: number                  // 结束时间 Unix时间戳
  teach_mode?: number                // 教学模式
  is_auto_onstage?: number            // 是否自动上台

  // 关联字段
  course_id?: number                 // 班级ID（关联 class_classin）
  created_at_timestamp?: number      // 创建时间 Unix时间戳
  biz_type?: number                  // 业务类型
  process_flag?: number              // 处理标志

  // 额外字段
  course_name?: string               // 课程名称（冗余）

  // 同步相关字段
  sync_time?: string                 // 最后同步时间
  notes?: string                     // 备注
  omo_station_broadcast?: number     // OMO站点广播
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
  confirmedTime?: string
  classLink?: string
  manualConverted?: string

  createdAt: string
  updatedAt: string

  // 业务状态字段（由 status-calculator 计算得出）
  lesson_status?: 'cancelled' | 'waiting_match' | 'waiting_confirm' | 'waiting_time' | 'waiting_link' | 'scheduled' | 'waiting_feedback' | 'completed'
  lesson_status_name?: string     // 试听状态中文名
  is_converted_calculated?: boolean  // 是否已转化（自动计算）
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
// 课程类型（业务层）
// ============================================
export interface Course {
  id: string
  orderId: string
  studentId?: string  // 学生ID

  // ClassIn 关联
  classinCourseId?: number

  // 课程基本信息
  courseName?: string
  subject?: string
  grade?: string

  // 教师信息
  teacherId?: string
  teacherName?: string

  // 课程统计
  sessionCount: number
  totalHours: number

  // 课程状态
  courseStatus: "active" | "completed" | "suspended" | "cancelled"

  // ClassIn 统计信息（JSON）
  courseConsumptionInfo?: string  // JSON string

  // 备注
  notes?: string

  createdAt: string
  updatedAt: string

  // 关联数据（查询时返回）
  teacher?: {
    id: string
    name: string
  }
  orders?: {
    id: string
    orderNumber: string
    studentId: string
  }
}

// ============================================
// 课时类型（业务层）
// ============================================
export interface ClassSession {
  id: string
  courseId: string

  // ClassIn 关联
  classroomId?: number

  // 课时基本信息
  sessionNumber: number
  sessionName?: string

  // 排课信息
  scheduledDate?: string
  scheduledTimeStart?: string
  scheduledTimeEnd?: string
  scheduledDurationMinutes?: number

  // 实际上课信息（从 classroom_classin 同步）
  actualStartTime?: string
  actualEndTime?: string
  actualDurationMinutes?: number

  // 课时状态
  status: "scheduled" | "completed" | "cancelled" | "missed"

  // 教师信息
  teacherId?: string
  teacherName?: string

  // 学生出勤
  studentAttendanceStatus?: "present" | "absent" | "late"

  // 课堂备注
  notes?: string

  createdAt: string
  updatedAt: string

  // 关联数据（查询时返回）
  course?: {
    id: string
    courseName: string
  }
}

// ============================================
// 表单相关类型
// ============================================
export type NewLead = Omit<Lead, "id" | "createdAt" | "updatedAt">
export type UpdateLead = Partial<NewLead> & { id: string }

export type NewTeacherCandidate = Omit<TeacherCandidate, "id" | "createdAt" | "updatedAt">
export type UpdateTeacherCandidate = Partial<NewTeacherCandidate> & { id: string }

export type NewTeacherProfile = Omit<TeacherProfile, "id" | "createdAt" | "updatedAt">
export type UpdateTeacherProfile = Partial<NewTeacherProfile> & { id: string }

export type NewStudent = Omit<Student, "id" | "createdAt" | "updatedAt">
export type UpdateStudent = Partial<NewStudent> & { id: string }

export type NewStudentClassin = Omit<StudentClassin, "uid" | "createdAt" | "updatedAt">
export type UpdateStudentClassin = Partial<NewStudentClassin> & { uid: number }

export type NewClassClassin = Omit<ClassClassin, "course_id" | "createdAt" | "updatedAt">
export type UpdateClassClassin = Partial<NewClassClassin> & { course_id: number }

export type NewClassroomClassin = Omit<ClassroomClassin, "class_id" | "createdAt" | "updatedAt">
export type UpdateClassroomClassin = Partial<NewClassroomClassin> & { class_id: number }

export type NewTeacher = Omit<Teacher, "id" | "createdAt" | "updatedAt">
export type UpdateTeacher = Partial<NewTeacher> & { id: string }

export type NewTeacherClassin = Omit<TeacherClassin, "uid" | "createdAt" | "updatedAt">
export type UpdateTeacherClassin = Partial<NewTeacherClassin> & { uid: number }

export type NewTrialLesson = Omit<TrialLesson, "id" | "createdAt" | "updatedAt">
export type UpdateTrialLesson = Partial<NewTrialLesson> & { id: string }

export type NewFormalOrder = Omit<FormalOrder, "id" | "orderNumber" | "createdAt" | "updatedAt">
export type UpdateFormalOrder = Partial<NewFormalOrder> & { id: string }

export type NewDailyLead = Omit<DailyLead, "id" | "createdAt" | "updatedAt">
export type UpdateDailyLead = Partial<NewDailyLead> & { id: string }

export type NewWechatAccount = Omit<WechatAccount, "id" | "createdAt" | "updatedAt">
export type UpdateWechatAccount = Partial<NewWechatAccount> & { id: string }

export type NewSalesPersonnel = Omit<SalesPersonnel, "id" | "createdAt" | "updatedAt">
export type UpdateSalesPersonnel = Partial<NewSalesPersonnel> & { id: string }

export type NewTransactionRecord = Omit<TransactionRecord, "id" | "createdAt">
export type UpdateTransactionRecord = Partial<NewTransactionRecord> & { id: string }

export type NewSysDictionary = Omit<SysDictionary, "id" | "createdAt" | "updatedAt">
export type UpdateSysDictionary = Partial<NewSysDictionary> & { id: string }

export type NewCourse = Omit<Course, "id" | "createdAt" | "updatedAt">
export type UpdateCourse = Partial<NewCourse> & { id: string }

export type NewClassSession = Omit<ClassSession, "id" | "createdAt" | "updatedAt">
export type UpdateClassSession = Partial<NewClassSession> & { id: string }
