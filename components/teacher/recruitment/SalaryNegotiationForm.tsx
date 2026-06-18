/**
 * 第四步：谈薪入库表单
 * HR/财务确定课时费、教学科目、银行账户等
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X } from "lucide-react"
import { TeacherCandidate, TeacherCandidatesService } from "@/lib/services/teacherCandidates"
import { advanceToNextStep } from "@/lib/services/recruitmentFlow"
import { api } from "@/lib/fetch"
import { useToast } from "@/hooks/use-toast"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

interface SalaryNegotiationFormProps {
  candidate: TeacherCandidate
  onClose: () => void
  onSuccess: () => void
  isReadonly?: boolean
}

export default function SalaryNegotiationForm({
  candidate,
  onClose,
  onSuccess,
  isReadonly = false,
}: SalaryNegotiationFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { items: gradeLevels, loading: gradeLevelsLoading } = useDictionary('grade')
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    candidate.subjects_taught || []
  )

  const [formData, setFormData] = useState({
    approved_hourly_rate: candidate.approved_hourly_rate?.toString() || "",
    trial_subject: candidate.trial_subject || "",
    can_teach_graduation_class: candidate.can_teach_graduation_class || false,
    grade_level: candidate.grade_level || "",
    teacher_type: candidate.teacher_type || "",
    bank_account: candidate.bank_account || "",
    bank_account_name: candidate.bank_account_name || "",
    bank_name: candidate.bank_name || "",
    bank_branch: candidate.bank_branch || "",
    hired_notes: candidate.hired_notes || "",
    notes_external: candidate.notes_external || "",
  })

  // 加载字典数据
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubjectToggle = (subjectCode: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subjectCode)) {
        return prev.filter((s) => s !== subjectCode)
      } else {
        return [...prev, subjectCode]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const approvedHourlyRate = Number(formData.approved_hourly_rate)

    // 验证必填字段
    if (!Number.isFinite(approvedHourlyRate) || approvedHourlyRate <= 0) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入大于 0 的课时费",
      })
      return
    }

    if (!formData.bank_account.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入银行卡号",
      })
      return
    }

    if (!formData.bank_account_name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入持卡人姓名",
      })
      return
    }

    if (!formData.bank_name.trim()) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请输入开户银行",
      })
      return
    }

    const entryMobile = (candidate.phone || candidate.wechat_id || "").trim()
    if (!entryMobile) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "缺少老师入库手机号或微信号，请先补充联系方式",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await TeacherCandidatesService.updateTeacherCandidate({
        id: candidate.id,
        approved_hourly_rate: approvedHourlyRate,
        trial_subject: formData.trial_subject.trim() || undefined,
        can_teach_graduation_class: formData.can_teach_graduation_class,
        grade_level: formData.grade_level || undefined,
        teacher_type: formData.teacher_type || undefined,
        subjects_taught: selectedSubjects,
        bank_account: formData.bank_account.trim(),
        bank_account_name: formData.bank_account_name.trim(),
        bank_name: formData.bank_name.trim(),
        bank_branch: formData.bank_branch.trim() || undefined,
        hired_notes: formData.hired_notes.trim() || undefined,
        notes_external: formData.notes_external.trim() || undefined,
      } as TeacherCandidate)

      if (candidate.recruitment_step !== "salary_negotiation") {
        const salaryStepResult = await advanceToNextStep(candidate.id, "teaching_review")
        if (!salaryStepResult.success) {
          throw new Error(salaryStepResult.error || "无法进入谈薪步骤")
        }
      }

      const entryResponse = await api.post("/api/teacher-entries/confirm", {
        candidate_id: candidate.id,
        status: "active",
        name: candidate.name,
        mobile: entryMobile,
        teacher_level: candidate.teacher_level || undefined,
        approved_hourly_rate: approvedHourlyRate,
      })

      if (!entryResponse.ok) {
        if (entryResponse.status === 403) {
          throw new Error("没有确认入库的权限")
        }
        if (entryResponse.status === 409) {
          throw new Error("候选人已入库，不能重复确认")
        }
        throw new Error("老师入库失败")
      }

      const entryResult = await entryResponse.json()
      const teacherCode = entryResult.data?.teacher?.teacher_code

      toast({
        title: "入库信息已保存",
        description: teacherCode ? `老师编号：${teacherCode}` : "已完成老师入库",
      })

      onSuccess()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: getClientSafeErrorMessage(error, "无法保存入库信息，请稍后重试", [
          "没有确认入库的权限",
          "候选人已入库，不能重复确认",
          "老师入库失败",
        ]),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h1 className="text-lg font-semibold">谈薪入库 - {candidate.name}</h1>
            <p className="text-sm text-gray-500 mt-1">确定课时费、教学科目、银行账户等信息</p>
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 薪资信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">薪资信息</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 课时费 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="hourly_rate" className="text-xs min-w-32">
                    课时费 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      id="hourly_rate"
                      type="number"
                      placeholder="请输入课时费"
                      value={formData.approved_hourly_rate}
                      onChange={(e) => handleInputChange("approved_hourly_rate", e.target.value)}
                      className="h-9 text-sm flex-1"
                      disabled={isReadonly || isSubmitting}
                      required
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">元/小时</span>
                  </div>
                </div>

                {/* 可教授毕业班 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="graduation_class" className="text-xs min-w-32">
                    可教毕业班
                  </Label>
                  <input
                    id="graduation_class"
                    type="checkbox"
                    checked={formData.can_teach_graduation_class}
                    onChange={(e) => handleInputChange("can_teach_graduation_class", e.target.checked)}
                    className="w-4 h-4"
                    disabled={isReadonly || isSubmitting}
                  />
                  <span className="text-xs text-gray-600">是</span>
                </div>
              </div>
            </div>

            {/* 教学信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">教学信息</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 年级段 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="grade_level" className="text-xs min-w-32">
                    年级段
                  </Label>
                  <select
                    id="grade_level"
                    value={formData.grade_level}
                    onChange={(e) => handleInputChange("grade_level", e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    disabled={isReadonly || isSubmitting}
                  >
                    <option value="">请选择</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade.id} value={grade.code}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 教授学科 */}
                <div className="flex gap-4">
                  <Label className="text-xs min-w-32 pt-2">教授学科</Label>
                  <div className="border rounded-md p-2 space-y-2 max-h-28 overflow-y-auto bg-gray-50 flex-1">
                    {subjects.map((subject) => (
                      <div key={subject.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`subject-${subject.code}`}
                          checked={selectedSubjects.includes(subject.code)}
                          onChange={() => handleSubjectToggle(subject.code)}
                          className="h-4 w-4 rounded border-gray-300"
                          disabled={isReadonly || isSubmitting}
                        />
                        <label
                          htmlFor={`subject-${subject.code}`}
                          className="text-xs cursor-pointer"
                        >
                          {subject.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 试讲学科 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="trial_subject" className="text-xs min-w-32">
                    试讲学科
                  </Label>
                  <Input
                    id="trial_subject"
                    placeholder="推荐试讲的学科"
                    value={formData.trial_subject}
                    onChange={(e) => handleInputChange("trial_subject", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>

                {/* 教师类型 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="teacher_type" className="text-xs min-w-32">
                    教师类型
                  </Label>
                  <select
                    id="teacher_type"
                    value={formData.teacher_type}
                    onChange={(e) => handleInputChange("teacher_type", e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    disabled={isReadonly || isSubmitting}
                  >
                    <option value="">请选择</option>
                    <option value="全职">全职</option>
                    <option value="兼职">兼职</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 银行信息 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">银行信息</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 银行卡号 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="bank_account" className="text-xs min-w-32">
                    银行卡号 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank_account"
                    placeholder="请输入银行卡号"
                    value={formData.bank_account}
                    onChange={(e) => handleInputChange("bank_account", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                    required
                  />
                </div>

                {/* 持卡人姓名 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="bank_account_name" className="text-xs min-w-32">
                    持卡人姓名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank_account_name"
                    placeholder="请确认无误"
                    value={formData.bank_account_name}
                    onChange={(e) => handleInputChange("bank_account_name", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                    required
                  />
                </div>

                {/* 开户银行 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="bank_name" className="text-xs min-w-32">
                    开户银行 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank_name"
                    placeholder="如：中国银行、工商银行等"
                    value={formData.bank_name}
                    onChange={(e) => handleInputChange("bank_name", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                    required
                  />
                </div>

                {/* 开户支行 */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="bank_branch" className="text-xs min-w-32">
                    开户支行
                  </Label>
                  <Input
                    id="bank_branch"
                    placeholder="支行名称"
                    value={formData.bank_branch}
                    onChange={(e) => handleInputChange("bank_branch", e.target.value)}
                    className="h-9 text-sm flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 备注 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-500">备注</h3>
              <div className="border-b pb-4 space-y-3">
                {/* 入库备注 */}
                <div className="flex gap-4">
                  <Label htmlFor="hired_notes" className="text-xs min-w-32 pt-2">
                    入库备注
                  </Label>
                  <Textarea
                    id="hired_notes"
                    placeholder="HR/财务的特殊说明"
                    value={formData.hired_notes}
                    onChange={(e) => handleInputChange("hired_notes", e.target.value)}
                    className="min-h-16 text-sm resize-none flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>

                {/* 外显备注 */}
                <div className="flex gap-4">
                  <Label htmlFor="notes_external" className="text-xs min-w-32 pt-2">
                    外显备注
                  </Label>
                  <Textarea
                    id="notes_external"
                    placeholder="老师可见的备注信息"
                    value={formData.notes_external}
                    onChange={(e) => handleInputChange("notes_external", e.target.value)}
                    className="min-h-16 text-sm resize-none flex-1"
                    disabled={isReadonly || isSubmitting}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9"
          >
            取消
          </Button>
          {!isReadonly && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-9 bg-blue-500 hover:bg-blue-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "完成入库"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
