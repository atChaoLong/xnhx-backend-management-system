/**
 * 教师招聘流程服务
 * 处理招聘流程的推进、验证和权限控制
 */

import { api } from '@/lib/fetch'
import { TeacherCandidate } from './teacherCandidates'
import {
  TEACHER_RECRUITMENT_FLOW,
  RecruitmentStep,
  getNextStep,
  canAccessStep,
  getStepConfig
} from '@/lib/config/teacherRecruitmentFlow'

/**
 * 验证是否可以进入下一步
 */
export function validateStepCompletion(candidate: TeacherCandidate, currentStep: RecruitmentStep): {
  valid: boolean
  errors: string[]
} {
  const config = getStepConfig(currentStep)
  const errors: string[] = []

  // 检查必填字段
  if (config.requiredFields) {
    for (const field of config.requiredFields) {
      const value = candidate[field as keyof TeacherCandidate]
      if (!value || (typeof value === 'string' && !value.trim())) {
        errors.push(`${field} 不能为空`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 推进到下一步
 */
export async function advanceToNextStep(
  candidateId: string,
  currentStep: RecruitmentStep,
  approved: boolean = true
): Promise<{ success: boolean; nextStep: RecruitmentStep | null; error?: string }> {
  try {
    const nextStep = getNextStep(currentStep, approved)

    if (!nextStep) {
      return { success: false, nextStep: null, error: '无下一步' }
    }

    // 调用 API 更新步骤
    const response = await api.put('/api/teacher-candidates/recruitment-flow', {
      id: candidateId,
      recruitment_step: nextStep,
      recruitment_status: getStepConfig(nextStep).status
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '更新失败' }))
      throw new Error(error.error || '更新招聘步骤失败')
    }

    return { success: true, nextStep }
  } catch (error: any) {
    return { success: false, nextStep: null, error: error.message }
  }
}

/**
 * 拒绝候选人（返回到拒绝步骤）
 */
export async function rejectCandidate(
  candidateId: string,
  currentStep: RecruitmentStep,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.put('/api/teacher-candidates/recruitment-flow', {
      id: candidateId,
      recruitment_step: 'rejected',
      recruitment_status: 'review_rejected',
      review_notes: rejectionReason
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '更新失败' }))
      throw new Error(error.error || '拒绝候选人失败')
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * 获取候选人当前步骤的可编辑字段
 */
export function getEditableFieldsForStep(step: RecruitmentStep): string[] {
  const config = getStepConfig(step)
  return config.editableFields
}

/**
 * 获取候选人当前步骤的可见字段
 */
export function getVisibleFieldsForStep(step: RecruitmentStep): string[] {
  const config = getStepConfig(step)
  const fields: string[] = []
  Object.values(config.fields).forEach(fieldArray => {
    fields.push(...fieldArray)
  })
  return fields
}

/**
 * 检查用户是否可以操作某个步骤
 */
export function canUserAccessStep(userRole: string, step: RecruitmentStep): boolean {
  return canAccessStep(userRole, step)
}

/**
 * 获取候选人的进度信息
 */
export function getProgressInfo(candidate: TeacherCandidate): {
  currentStep: RecruitmentStep
  stepName: string
  stepNumber: number
  totalSteps: number
  isRejected: boolean
  isCompleted: boolean
} {
  const step = (candidate.recruitment_step || 'scheduling') as RecruitmentStep
  const config = getStepConfig(step)
  const totalSteps = 5

  return {
    currentStep: step,
    stepName: config.name,
    stepNumber: config.step || 0,
    totalSteps,
    isRejected: candidate.recruitment_status === 'review_rejected',
    isCompleted: candidate.recruitment_status === 'in_teacher_pool'
  }
}
