/**
 * 教师招聘流程配置
 * 完整流程：约面 -> 上传面试视频 -> 教学复核 -> 谈薪入库 -> 老师库
 */

export type RecruitmentStep = 'scheduling' | 'interview_video' | 'teaching_review' | 'salary_negotiation' | 'final_entry' | 'rejected'

export type RecruitmentStatus = 'waiting_contact' | 'scheduled' | 'video_uploaded' | 'pending_teaching_review' | 'teaching_review_approved' | 'pending_salary' | 'in_teacher_pool' | 'review_rejected'

export interface RecruitmentStepConfig {
  step: number | null
  name: string
  description?: string
  roles: string[]
  status: RecruitmentStatus
  fields: {
    [category: string]: string[]
  }
  editableFields: string[]
  requiredFields?: string[]
  nextStep?: RecruitmentStep
  rejectStep?: RecruitmentStep
  archiveAtBottom?: boolean
}

export const TEACHER_RECRUITMENT_FLOW: Record<RecruitmentStep, RecruitmentStepConfig> = {
  // 第1步：约面
  scheduling: {
    step: 1,
    name: '约面',
    description: '安排面试时间、地点、面试官',
    roles: ['operations', 'sales'],
    status: 'scheduled',
    fields: {
      contact: ['wechat_id'],
      interview: ['interview_date', 'interview_time', 'interview_officer', 'interview_link'],
      notes: ['interview_notes']
    },
    editableFields: ['wechat_id', 'interview_date', 'interview_time', 'interview_officer', 'interview_link', 'interview_notes'],
    requiredFields: ['interview_date', 'interview_time', 'interview_officer'],
    nextStep: 'interview_video'
  },

  // 第2步：上传面试视频
  interview_video: {
    step: 2,
    name: '上传面试视频',
    description: '上传面试过程录像，为教学复核做准备',
    roles: ['sales', 'operations'],
    status: 'video_uploaded',
    fields: {
      video: ['video_recording_url', 'interview_exception'],
      basic: ['name', 'wechat_id'],
      notes: ['interview_notes']
    },
    editableFields: ['video_recording_url', 'interview_exception', 'interview_notes'],
    requiredFields: ['video_recording_url'],
    nextStep: 'teaching_review'
  },

  // 第3步：教学复核（鉴黄师 = 教学主管）
  teaching_review: {
    step: 3,
    name: '教学复核',
    description: '教学主管评估面试质量、专业素养、亲和力等',
    roles: ['teaching_manager'],
    status: 'pending_teaching_review',
    fields: {
      video: ['video_recording_url'],
      interview_info: ['interview_date', 'interview_time', 'interview_officer'],
      interview_scores: ['interview_score', 'interview_rating', 'dress_appearance_score', 'logical_expression_score', 'material_preparation_score'],
      qualities: ['affinity', 'service_awareness', 'teacher_characteristics', 'mandarin_level', 'research_ability'],
      evaluation: ['initial_evaluation'],
      decision: ['review_status'],
      notes: ['review_notes']
    },
    editableFields: [
      'interview_score',
      'interview_rating',
      'dress_appearance_score',
      'logical_expression_score',
      'material_preparation_score',
      'affinity',
      'service_awareness',
      'teacher_characteristics',
      'mandarin_level',
      'research_ability',
      'initial_evaluation',
      'review_status',
      'review_notes'
    ],
    requiredFields: ['interview_score', 'review_status'],
    nextStep: 'salary_negotiation',
    rejectStep: 'rejected'
  },

  // 第4步：谈薪入库
  salary_negotiation: {
    step: 4,
    name: '谈薪入库',
    description: '确定课时费、教学科目、银行账户等，正式入库',
    roles: ['hr', 'finance'],
    status: 'pending_salary',
    fields: {
      salary_info: ['approved_hourly_rate', 'trial_subject', 'can_teach_graduation_class'],
      teaching_info: ['grade_level', 'subjects_taught', 'teacher_type'],
      bank_info: ['bank_account', 'bank_account_name', 'bank_name', 'bank_branch'],
      notes: ['hired_notes', 'notes_external']
    },
    editableFields: [
      'approved_hourly_rate',
      'trial_subject',
      'can_teach_graduation_class',
      'grade_level',
      'subjects_taught',
      'teacher_type',
      'bank_account',
      'bank_account_name',
      'bank_name',
      'bank_branch',
      'hired_notes',
      'notes_external'
    ],
    requiredFields: ['approved_hourly_rate', 'bank_account'],
    nextStep: 'final_entry'
  },

  // 第5步：最终入库（老师库）
  final_entry: {
    step: 5,
    name: '入库完成',
    description: '教师已正式入库，可开始排课',
    roles: ['hr', 'operations'],
    status: 'in_teacher_pool',
    fields: {
      summary: ['name', 'wechat_id', 'approved_hourly_rate', 'subjects_taught', 'grade_level', 'review_status', 'notes_external']
    },
    editableFields: [],
    requiredFields: []
  },

  // 拒绝路由
  rejected: {
    step: null,
    name: '复核拒绝',
    description: '教学复核未通过，记录保留但沉底',
    roles: ['teaching_manager'],
    status: 'review_rejected',
    fields: {
      reject_info: ['review_status', 'review_notes'],
      archive_notice: ['name', 'wechat_id']
    },
    editableFields: ['review_notes'],
    archiveAtBottom: true
  }
}

/**
 * 获取当前步骤配置
 */
export function getStepConfig(step: RecruitmentStep): RecruitmentStepConfig {
  return TEACHER_RECRUITMENT_FLOW[step]
}

/**
 * 获取下一步
 */
export function getNextStep(currentStep: RecruitmentStep, approved: boolean = true): RecruitmentStep | null {
  const config = getStepConfig(currentStep)
  if (!approved && config.rejectStep) {
    return config.rejectStep
  }
  return config.nextStep || null
}

/**
 * 检查用户是否可以操作当前步骤
 */
export function canAccessStep(userRole: string, step: RecruitmentStep): boolean {
  const config = getStepConfig(step)
  return config.roles.includes(userRole)
}

/**
 * 获取步骤进度（用于UI显示）
 */
export const RECRUITMENT_STEPS_ORDER: RecruitmentStep[] = [
  'scheduling',
  'interview_video',
  'teaching_review',
  'salary_negotiation',
  'final_entry'
]

export function getStepProgress(currentStep: RecruitmentStep): number {
  const index = RECRUITMENT_STEPS_ORDER.indexOf(currentStep)
  return index >= 0 ? index + 1 : 0
}
