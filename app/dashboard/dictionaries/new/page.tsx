"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Loader2 } from "lucide-react"
import { DictionaryService, NewDictionaryItem } from "@/lib/services/dictionary"
import { useToast } from "@/hooks/use-toast"

// 字典分类选项（与主页面保持一致）
const CATEGORY_OPTIONS = [
  { value: "subject", label: "学科" },
  { value: "grade", label: "年级" },
  { value: "province", label: "省份" },
  { value: "textbook_version", label: "教材版本" },
  { value: "order_type", label: "订单类型" },
  { value: "payment_channel", label: "付款渠道" },
  { value: "consultant", label: "顾问" },
  { value: "class_duration", label: "课时长" },
  { value: "fixed_mode", label: "固定模式" },
  { value: "class_frequency", label: "频次" },
  { value: "teacher_feature", label: "教师特点" },
  { value: "scheduling_mode", label: "排课模式" },
  { value: "advisor", label: "顾问" },
  { value: "free_time", label: "空闲时间" },
  { value: "add_method", label: "添加方式" },
  { value: "xhs_source", label: "小红书来源" },
  { value: "teacher_type", label: "教师类型" },
  { value: "student_type", label: "学生类型" },
  { value: "teacher_level", label: "教师等级" },
  { value: "mandarin_level", label: "普通话等级" },
  { value: "visit_type", label: "访问类型" },
  { value: "payment_type", label: "付款类型" },
  { value: "recruiter", label: "招聘人" },
]

export default function NewDictionaryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    category: "",
    code: "",
    label: "",
    sort_order: 0,
    is_active: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证
    if (!formData.category || !formData.code || !formData.label) {
      toast({
        variant: "destructive",
        title: "验证失败",
        description: "请填写所有必填字段",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const data: NewDictionaryItem = {
        category: formData.category,
        code: formData.code,
        label: formData.label,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      }

      await DictionaryService.createDictionary(data)

      toast({
        title: "创建成功",
        description: "字典项已创建",
      })

      router.push("/dashboard/dictionaries")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: error.message || "无法创建字典项",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="新增字典项"
        description="创建新的系统字典数据"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={handleBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 分类 */}
                <div className="space-y-2">
                  <Label htmlFor="category">
                    分类 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 代码 */}
                <div className="space-y-2">
                  <Label htmlFor="code">
                    代码 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    placeholder="例如: chinese, math, grade_1"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    建议使用英文或下划线命名，例如: chinese, grade_1
                  </p>
                </div>

                {/* 标签 */}
                <div className="space-y-2">
                  <Label htmlFor="label">
                    标签 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="label"
                    placeholder="例如: 语文, 小学一年级"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    显示名称，例如: 语文, 小学一年级
                  </p>
                </div>

                {/* 排序 */}
                <div className="space-y-2">
                  <Label htmlFor="sort_order">
                    排序 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sort_order"
                    type="number"
                    placeholder="数字越小越靠前"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    数字越小排序越靠前，默认为 0
                  </p>
                </div>

                {/* 按钮 */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      "提交"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
