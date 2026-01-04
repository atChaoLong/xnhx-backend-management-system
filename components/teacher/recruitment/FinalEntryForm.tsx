/**
 * 第五步：最终入库 - 只读总结
 * 展示教师已正式入库，可开始排课
 */

"use client"

import { Button } from "@/components/ui/button"
import { X, CheckCircle } from "lucide-react"
import { TeacherCandidate } from "@/lib/services/teacherCandidates"
import { format } from "date-fns"

interface FinalEntryFormProps {
  candidate: TeacherCandidate
  onClose: () => void
}

export default function FinalEntryForm({
  candidate,
  onClose,
}: FinalEntryFormProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <h1 className="text-lg font-semibold">入库完成</h1>
              <p className="text-sm text-gray-500 mt-1">教师已正式入库，可开始排课</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">基本信息</h3>
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">姓名</p>
                    <p className="font-medium">{candidate.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">微信号</p>
                    <p className="font-medium">{candidate.wechat_id || "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600">简历</p>
                  {candidate.resume_url ? (
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate"
                    >
                      查看简历
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">-</p>
                  )}
                </div>
              </div>
            </div>

            {/* 教学信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">教学信息</h3>
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">年级段</p>
                    <p className="font-medium">{candidate.grade_level || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">教授学科</p>
                    <p className="font-medium">
                      {candidate.subjects_taught?.join(", ") || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">教师类型</p>
                    <p className="font-medium">{candidate.teacher_type || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">试讲学科</p>
                    <p className="font-medium">{candidate.trial_subject || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 薪资信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">薪资信息</h3>
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">课时费</p>
                    <p className="font-medium text-lg">
                      ¥{candidate.approved_hourly_rate || "-"}/小时
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">可教毕业班</p>
                    <p className="font-medium">
                      {candidate.can_teach_graduation_class ? "是" : "否"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 银行信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">银行信息</h3>
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">开户银行</p>
                    <p className="font-medium">{candidate.bank_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">开户支行</p>
                    <p className="font-medium">{candidate.bank_branch || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600">银行卡号</p>
                    <p className="font-medium">
                      {candidate.bank_account
                        ? candidate.bank_account.slice(-4).padStart(candidate.bank_account.length, "*")
                        : "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600">持卡人姓名</p>
                    <p className="font-medium">{candidate.bank_account_name || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 评审信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">评审信息</h3>
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">面试总体评分</p>
                    <p className="font-medium">{candidate.interview_score || "-"}/10</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">面试评级</p>
                    <p className="font-medium">{candidate.interview_rating || "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600">初步评价</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {candidate.initial_evaluation || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* 时间戳 */}
            {candidate.salary_confirmed_at && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-500">入库记录</h3>
                <div className="border rounded-lg p-4 bg-green-50 space-y-2 text-sm">
                  <p className="text-gray-600">
                    入库完成时间：{format(new Date(candidate.salary_confirmed_at), 'yyyy-MM-dd HH:mm:ss')}
                  </p>
                  {candidate.salary_confirmed_by && (
                    <p className="text-gray-600">确认人：{candidate.salary_confirmed_by}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            onClick={onClose}
            className="h-9 bg-green-500 hover:bg-green-600"
          >
            完成
          </Button>
        </div>
      </div>
    </div>
  )
}
