'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, CheckCircle2, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DictionaryService } from '@/lib/services/dictionary'

// 常量定义
const GENDER_OPTIONS = ['女', '男']
const GRADE_LEVEL_OPTIONS = ['小学', '初中', '高中']
const USED_CLASSIN_OPTIONS = ['用过', '没用过']
const HAS_CERTIFICATE_OPTIONS = ['有', '暂时没有']
const EDUCATION_OPTIONS = ['本科', '硕士', '博士', '其他']
const STUDENT_LEVEL_OPTIONS = [
  '基础差，开窍',
  '中等，查缺补漏',
  '培优拔高',
  '懂考点，毕业班',
  '带不了毕业班'
]

export default function TeacherFormPage() {
  const router = useRouter()
  const { toast } = useToast()

  // 字典数据
  const [dictOptions, setDictOptions] = useState<{
    subject: Array<{ code: string; label: string }>
    grade: Array<{ code: string; label: string }>
    free_time: Array<{ code: string; label: string }>
    textbook_version: Array<{ code: string; label: string }>
    province: Array<{ code: string; label: string }>
    student_type: Array<{ code: string; label: string }>
  }>({
    subject: [],
    grade: [],
    free_time: [],
    textbook_version: [],
    province: [],
    student_type: [],
  })

  // 表单数据
  const [formData, setFormData] = useState({
    teacher_name: '',
    gender: '',
    subjects: [] as string[],
    grade_levels: [] as string[],
    wechat: '',
    classin_phone: '',
    used_classin: '',
    has_certificate: '',
    location: '',
    education: '',
    university: '',
    teaching_years: '',
    available_times: [] as string[],
    textbook_versions: [] as string[],
    student_regions: [] as string[],
    student_levels: [] as string[],
    teaching_style: '',
    teaching_experience: '',
    success_cases: '',
    notes: '',
    photo_url: '',
    review_screenshots: [] as string[]
  })

  // 上传状态
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isLoadingDict, setIsLoadingDict] = useState(true)

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getAllDictionaries()

        setDictOptions({
          subject: dicts.subject || [],
          grade: dicts.grade || [],
          free_time: dicts.free_time || [],
          textbook_version: dicts.textbook_version || [],
          province: dicts.province || [],
          student_type: dicts.student_type || [],
        })
      } catch (error) {
        console.error("加载字典失败:", error)
      } finally {
        setIsLoadingDict(false)
      }
    }

    loadDictionaries()
  }, [])

  // 处理多选框变化
  const handleMultiSelectChange = (field: string, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentValues = prev[field as keyof typeof prev] as string[]
      if (checked) {
        return { ...prev, [field]: [...currentValues, value] }
      } else {
        return { ...prev, [field]: currentValues.filter(v => v !== value) }
      }
    })
  }

  // 处理文件上传
  const handleFileUpload = async (file: File, type: 'photo' | 'screenshots') => {
    const uploadFormData = new FormData()
    uploadFormData.append('file', file)
    uploadFormData.append('type', type)

    if (type === 'photo') {
      setUploadingPhoto(true)
    } else {
      setUploadingScreenshots(true)
    }

    try {
      const response = await fetch('/api/teacher-form/upload', {
        method: 'POST',
        body: uploadFormData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '上传失败')
      }

      const data = await response.json()

      if (type === 'photo') {
        setFormData(prev => ({ ...prev, photo_url: data.url }))
      } else {
        setFormData(prev => ({
          ...prev,
          review_screenshots: [...prev.review_screenshots, data.url]
        }))
      }

      toast({
        title: '上传成功',
        description: '文件已成功上传',
        variant: 'default'
      })

      return data.url
    } catch (error) {
      toast({
        title: '上传失败',
        description: error instanceof Error ? error.message : '文件上传失败',
        variant: 'destructive'
      })
      throw error
    } finally {
      if (type === 'photo') {
        setUploadingPhoto(false)
      } else {
        setUploadingScreenshots(false)
      }
    }
  }

  // 表单验证
  const validateForm = (): string | null => {
    if (!formData.teacher_name) return '请输入老师姓名'
    if (!formData.gender) return '请选择性别'
    if (formData.subjects.length === 0) return '请选择教授学科'
    if (formData.grade_levels.length === 0) return '请选择教授年级段'
    if (!formData.wechat) return '请输入微信号'
    if (!formData.classin_phone) return '请输入ClassIn注册手机号'
    if (!formData.used_classin) return '请选择是否用过ClassIn'
    if (!formData.has_certificate) return '请选择是否有教资证'
    if (!formData.location) return '请输入老师所在地'
    if (!formData.education) return '请选择学历'
    if (!formData.university) return '请输入毕业院校'
    if (!formData.teaching_years) return '请输入教学年限'
    if (formData.available_times.length === 0) return '请选择可排课时间'
    if (formData.textbook_versions.length === 0) return '请选择熟悉的教材版本'
    if (formData.student_regions.length === 0) return '请选择带过学生地域'
    if (formData.student_levels.length === 0) return '请选择擅长的学生水平'
    if (!formData.teaching_style) return '请输入教学特点'
    if (!formData.teaching_experience) return '请输入教学经历'
    if (!formData.success_cases) return '请输入优秀学员提分案例'
    if (!formData.photo_url) return '请上传老师形象照'

    // 验证年级段选择
    if (formData.grade_levels.length > 2) {
      return '至多选择2个学龄段'
    }

    // 验证教学年限
    const years = parseFloat(formData.teaching_years)
    if (isNaN(years) || years < 0) {
      return '教学年限必须是有效的数字'
    }

    return null
  }

  // 提交表单
  const handleSubmit = async () => {
    // 1. 验证表单
    const validationError = validateForm()
    if (validationError) {
      toast({
        title: '验证失败',
        description: validationError,
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)

    try {
      // 2. 先验证手机号（验证候选人身份，用手机号匹配wechat_id）
      const verifyResponse = await fetch('/api/teacher-form/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.classin_phone })
      })

      const verifyData = await verifyResponse.json()

      if (!verifyResponse.ok) {
        toast({
          title: '身份验证失败',
          description: verifyData.message || verifyData.error || '请确认您已经通过面试',
          variant: 'destructive'
        })
        return
      }

      // 3. 验证通过，提交表单数据
      const response = await fetch('/api/teacher-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          candidate_id: verifyData.data.id,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '提交失败')
      }

      toast({
        title: '提交成功',
        description: `欢迎，${formData.teacher_name}老师！您的信息已成功提交，我们会尽快与您联系`,
        variant: 'default'
      })

      // 延迟后重定向
      setTimeout(() => {
        router.push('/teacher-form/success')
      }, 2000)

    } catch (error) {
      toast({
        title: '提交失败',
        description: error instanceof Error ? error.message : '提交失败，请重试',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoadingDict) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">小牛好学 - 老师排课信息收集表</CardTitle>
            <CardDescription>
              该表单用于收集排课相关信息，目的为高效率匹配，不外发，排课前会跟您沟通具体时间及学员学情，如有问题，请联系小牛好学教务老师
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">

              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">基本信息</h3>

                <div>
                  <Label htmlFor="teacher_name">老师姓名 *</Label>
                  <Input
                    id="teacher_name"
                    value={formData.teacher_name}
                    onChange={(e) => setFormData({ ...formData, teacher_name: e.target.value })}
                    placeholder="请输入老师姓名"
                  />
                </div>

                <div>
                  <Label>性别 *</Label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择性别" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>教授学科 *（请选择所授学科）</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {dictOptions.subject.map(option => (
                      <div key={option.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subject-${option.code}`}
                          checked={formData.subjects.includes(option.label)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('subjects', option.label, checked as boolean)
                          }
                        />
                        <Label htmlFor={`subject-${option.code}`} className="text-sm font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>教授年级段（可多选）*（至多2个学龄段，小初或初高）</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {GRADE_LEVEL_OPTIONS.map(option => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`grade-${option}`}
                          checked={formData.grade_levels.includes(option)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('grade_levels', option, checked as boolean)
                          }
                        />
                        <Label htmlFor={`grade-${option}`} className="text-sm font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.grade_levels.length > 2 && (
                    <p className="text-sm text-red-500 mt-1">至多选择2个学龄段</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="wechat">微信号 *（常用微信号）</Label>
                  <Input
                    id="wechat"
                    value={formData.wechat}
                    onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                    placeholder="请输入微信号"
                  />
                </div>

                <div>
                  <Label htmlFor="classin_phone">ClassIn注册手机号 *</Label>
                  <p className="text-sm text-gray-500 mb-2">用于后续开课，请使用面试时填写的手机号</p>
                  <Input
                    id="classin_phone"
                    value={formData.classin_phone}
                    onChange={(e) => setFormData({ ...formData, classin_phone: e.target.value })}
                    placeholder="请输入手机号"
                    maxLength={11}
                  />
                </div>

                <div>
                  <Label>是否用过ClassIn *</Label>
                  <Select value={formData.used_classin} onValueChange={(value) => setFormData({ ...formData, used_classin: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {USED_CLASSIN_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>是否有教资证 *</Label>
                  <Select value={formData.has_certificate} onValueChange={(value) => setFormData({ ...formData, has_certificate: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {HAS_CERTIFICATE_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">老师所在地 *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="请输入老师所在地"
                  />
                </div>

                <div>
                  <Label>学历 *</Label>
                  <Select value={formData.education} onValueChange={(value) => setFormData({ ...formData, education: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择学历" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="university">毕业院校 *</Label>
                  <Input
                    id="university"
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    placeholder="请输入毕业院校"
                  />
                </div>
              </div>

              {/* 教学相关 */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">教学相关信息</h3>

                <div>
                  <Label>可排课时间（多选）*</Label>
                  <p className="text-sm text-gray-500 mb-2">大致空闲时间，排课前会跟您沟通；学期中尽量多选晚上或周末</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {dictOptions.free_time.map(option => (
                      <div key={option.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`time-${option.code}`}
                          checked={formData.available_times.includes(option.label)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('available_times', option.label, checked as boolean)
                          }
                        />
                        <Label htmlFor={`time-${option.code}`} className="text-sm font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>熟悉的教材版本（多选）*</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {dictOptions.textbook_version.map(option => (
                      <div key={option.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`textbook-${option.code}`}
                          checked={formData.textbook_versions.includes(option.label)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('textbook_versions', option.label, checked as boolean)
                          }
                        />
                        <Label htmlFor={`textbook-${option.code}`} className="text-sm font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>带过学生地域（多选）*</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {dictOptions.province.map(option => (
                      <div key={option.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`region-${option.code}`}
                          checked={formData.student_regions.includes(option.label)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('student_regions', option.label, checked as boolean)
                          }
                        />
                        <Label htmlFor={`region-${option.code}`} className="text-sm font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>擅长的学生水平（多选）*</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {STUDENT_LEVEL_OPTIONS.map(option => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`level-${option}`}
                          checked={formData.student_levels.includes(option)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('student_levels', option, checked as boolean)
                          }
                        />
                        <Label htmlFor={`level-${option}`} className="text-sm font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="teaching_years">教学年限 *</Label>
                  <p className="text-sm text-gray-500 mb-2">填数字，单位（年）</p>
                  <Input
                    id="teaching_years"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.teaching_years}
                    onChange={(e) => setFormData({ ...formData, teaching_years: e.target.value })}
                    placeholder="请输入教学年限"
                  />
                </div>
              </div>

              {/* 教师简历 */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">教师简历</h3>

                <div>
                  <Label htmlFor="teaching_style">教学特点 *（教师简历 Part-1）</Label>
                  <Textarea
                    id="teaching_style"
                    value={formData.teaching_style}
                    onChange={(e) => setFormData({ ...formData, teaching_style: e.target.value })}
                    placeholder="请描述您的教学特点"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="teaching_experience">教学经历 *（教师简历 Part-2）</Label>
                  <Textarea
                    id="teaching_experience"
                    value={formData.teaching_experience}
                    onChange={(e) => setFormData({ ...formData, teaching_experience: e.target.value })}
                    placeholder="请描述您的教学经历"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="success_cases">优秀学员提分案例 *（教师简历 Part-3）</Label>
                  <Textarea
                    id="success_cases"
                    value={formData.success_cases}
                    onChange={(e) => setFormData({ ...formData, success_cases: e.target.value })}
                    placeholder="请描述您的优秀学员提分案例"
                    rows={4}
                  />
                </div>
              </div>

              {/* 文件上传 */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">上传文件</h3>

                <div>
                  <Label>老师形象照 *</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(file, 'photo')
                        }
                      }}
                      disabled={uploadingPhoto}
                    />
                    {uploadingPhoto && (
                      <p className="text-sm text-gray-500 mt-1 flex items-center">
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        上传中...
                      </p>
                    )}
                    {formData.photo_url && (
                      <div className="mt-2">
                        <img
                          src={formData.photo_url}
                          alt="形象照"
                          className="w-32 h-32 object-cover rounded"
                        />
                        <p className="text-sm text-green-600 mt-1 flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          已上传
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>提分/好评截图（选填）</Label>
                  <p className="text-sm text-gray-500 mb-2">可上传多张图片</p>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        files.forEach(file => {
                          handleFileUpload(file, 'screenshots')
                        })
                      }}
                      disabled={uploadingScreenshots}
                    />
                    {uploadingScreenshots && (
                      <p className="text-sm text-gray-500 mt-1 flex items-center">
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        上传中...
                      </p>
                    )}
                    {formData.review_screenshots.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {formData.review_screenshots.map((url, index) => (
                          <div key={index} className="relative">
                            <img
                              src={url}
                              alt={`截图 ${index + 1}`}
                              className="w-full h-24 object-cover rounded"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 备注 */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label htmlFor="notes">备注（选填）</Label>
                  <p className="text-sm text-gray-500 mb-2">有其他擅长、排课偏好、或能教其他赛道等，都可以告诉我们</p>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="请输入备注信息"
                    rows={3}
                  />
                </div>
              </div>

              {/* 提示信息 */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  提交时将验证您的手机号，只有通过面试的老师才能成功提交。
                  所有标记 * 的字段为必填项，请确保填写完整后提交。
                </AlertDescription>
              </Alert>

              {/* 提交按钮 */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || uploadingPhoto || uploadingScreenshots}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '提交'
                  )}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
