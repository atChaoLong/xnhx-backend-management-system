/**
 * 招聘流程步骤导航组件
 */

import { Check, Clock, Video, BarChart3, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import { TEACHER_RECRUITMENT_FLOW, RECRUITMENT_STEPS_ORDER, RecruitmentStep } from '@/lib/config/teacherRecruitmentFlow'

interface RecruitmentStepsProps {
  currentStep: RecruitmentStep
  status: string
  onStepClick?: (step: RecruitmentStep) => void
}

const STEP_ICONS: Record<RecruitmentStep, React.ReactNode> = {
  scheduling: <Clock className="h-5 w-5" />,
  interview_video: <Video className="h-5 w-5" />,
  teaching_review: <BarChart3 className="h-5 w-5" />,
  salary_negotiation: <DollarSign className="h-5 w-5" />,
  final_entry: <CheckCircle className="h-5 w-5" />,
  rejected: <XCircle className="h-5 w-5" />
}

export default function RecruitmentSteps({ currentStep, status, onStepClick }: RecruitmentStepsProps) {
  if (status === 'review_rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-red-700 font-medium">
          <XCircle className="h-5 w-5" />
          <span>复核拒绝 - 此记录已归档</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {RECRUITMENT_STEPS_ORDER.map((step, index) => {
          const config = TEACHER_RECRUITMENT_FLOW[step]
          const isCompleted = RECRUITMENT_STEPS_ORDER.indexOf(currentStep as RecruitmentStep) > index
          const isCurrent = step === currentStep

          return (
            <div
              key={step}
              className="flex flex-col items-center flex-1"
              onClick={() => onStepClick?.(step)}
            >
              {/* 连接线 */}
              {index < RECRUITMENT_STEPS_ORDER.length - 1 && (
                <div
                  className={`absolute top-5 left-[50%] w-[calc(100%-2rem)] h-1 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  style={{ transform: 'translateX(calc(-50% - 1rem))' }}
                />
              )}

              {/* 步骤圆圈 */}
              <div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isCurrent
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  STEP_ICONS[step]
                )}
              </div>

              {/* 步骤标签 */}
              <div className="mt-3 text-center">
                <p className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-600'}`}>
                  {config.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">第 {config.step} 步</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
