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
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DictionaryService } from '@/lib/services/dictionary'
import { getClientSafeErrorMessage, summarizeError } from '@/lib/safe-error'

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
const TEACHER_FORM_IMAGE_ACCEPT = 'image/*'
const TEACHER_FORM_MAX_IMAGE_SIZE = 20 * 1024 * 1024
const TEACHER_FORM_ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
  '.bmp',
  '.tif',
  '.tiff',
])
const TEACHER_FORM_UPLOAD_TIMEOUT_MS = 45_000
const TEACHER_FORM_UPLOAD_MAX_ATTEMPTS = 3
const TEACHER_FORM_UPLOAD_RETRY_DELAY_MS = 600
const TEACHER_FORM_REQUEST_TIMEOUT_MS = 30_000
const TEACHER_FORM_REQUEST_MAX_ATTEMPTS = 3
const TEACHER_FORM_REQUEST_RETRY_DELAY_MS = 500
const TEACHER_FORM_ALLOWED_UPLOAD_ERRORS = [
  '文件为空，请重新选择文件',
  '文件大小超过限制，最大支持 20MB',
  '不支持的文件类型，仅支持图片',
  '文件内容与图片类型不匹配，请重新选择文件',
  '请使用招师发送的专属表单链接上传文件',
  '未找到候选人信息，请使用招师发送的专属表单链接',
  '该候选人尚未通过面试',
  '您已经提交过信息，如需修改请联系教务老师',
  '上传超时，请检查网络后重试',
  '上传失败，未返回文件链接',
  '上传失败',
] as const
const TEACHER_FORM_ALLOWED_VERIFY_ERRORS = [
  '请使用招师发送的专属表单链接',
  '请确认您使用的是招师发送的专属表单链接',
  '请确认您已经通过面试',
  '如需修改信息，请联系教务老师',
  '候选人链接验证超时，请检查网络后重试',
  '候选人链接验证失败',
] as const
const TEACHER_FORM_ALLOWED_SUBMIT_ERRORS = [
  '缺少候选人信息，请使用招师发送的专属表单链接',
  '未找到候选人信息',
  '该候选人尚未通过面试',
  '您已经提交过信息，如需修改请联系教务老师',
  '提交超时，请检查网络后重试',
  '提交失败，请稍后重试',
] as const

type TeacherFormUploadResponse = {
  url?: string
  error?: string
  code?: string
}

type TeacherFormJsonResponse<T = unknown> = {
  data?: T
  error?: string
  message?: string
  success?: boolean
}

type TeacherFormCandidateVerification = {
  id: string
  name?: string | null
  wechat_id?: string | null
  phone?: string | null
  subjects?: string[] | null
  grade_levels?: string[] | null
}

type TeacherFormSubmitResult = {
  id?: string
  candidate_id?: string
  created_at?: string
}

class NonRetriableUploadError extends Error {}
class NonRetriableTeacherFormRequestError extends Error {}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] || ''
}

function validateTeacherFormImage(file: File): string | null {
  if (file.size <= 0) {
    return '文件为空，请重新选择文件'
  }

  if (file.size > TEACHER_FORM_MAX_IMAGE_SIZE) {
    return '文件大小超过限制，最大支持 20MB'
  }

  const extension = getFileExtension(file.name)
  if (!file.type.startsWith('image/') && !TEACHER_FORM_ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return '不支持的文件类型，仅支持图片'
  }

  return null
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function isRetriableUploadStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function isRetriableTeacherFormRequestStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function getAllowedMessage(message: string | undefined | null, allowedMessages: readonly string[], fallback: string): string {
  return message && allowedMessages.includes(message) ? message : fallback
}

function getUploadErrorMessage(data: TeacherFormUploadResponse | null, fallback: string): string {
  return getAllowedMessage(data?.error, TEACHER_FORM_ALLOWED_UPLOAD_ERRORS, fallback)
}

function getTeacherFormRequestErrorMessage(
  data: TeacherFormJsonResponse | null,
  fallback: string,
  allowedMessages: readonly string[]
): string {
  return getAllowedMessage(data?.message || data?.error, allowedMessages, fallback)
}

function getTeacherFormRequestTimeoutMessage(fallbackError: string): string {
  return fallbackError.includes('候选人链接验证')
    ? '候选人链接验证超时，请检查网络后重试'
    : '提交超时，请检查网络后重试'
}

async function postTeacherFormUpload(formData: FormData): Promise<{
  ok: boolean
  status: number
  data: TeacherFormUploadResponse | null
}> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), TEACHER_FORM_UPLOAD_TIMEOUT_MS)

  try {
    const response = await fetch('/api/teacher-form/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)

    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function postTeacherFormJson<T>(
  path: '/api/teacher-form/verify' | '/api/teacher-form',
  payload: Record<string, unknown>,
  fallbackError: string,
  allowedMessages: readonly string[] = []
): Promise<TeacherFormJsonResponse<T>> {
  let lastErrorMessage = fallbackError

  for (let attempt = 1; attempt <= TEACHER_FORM_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), TEACHER_FORM_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as TeacherFormJsonResponse<T> | null

      if (response.ok) {
        return data || {}
      }

      lastErrorMessage = getTeacherFormRequestErrorMessage(data, fallbackError, allowedMessages)

      if (!isRetriableTeacherFormRequestStatus(response.status)) {
        throw new NonRetriableTeacherFormRequestError(lastErrorMessage)
      }
    } catch (error) {
      if (error instanceof NonRetriableTeacherFormRequestError) {
        throw error
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastErrorMessage = getTeacherFormRequestTimeoutMessage(fallbackError)
      } else {
        lastErrorMessage = getClientSafeErrorMessage(error, fallbackError, allowedMessages)
      }

      if (attempt === TEACHER_FORM_REQUEST_MAX_ATTEMPTS) {
        throw new Error(lastErrorMessage)
      }
    } finally {
      window.clearTimeout(timeoutId)
    }

    if (attempt < TEACHER_FORM_REQUEST_MAX_ATTEMPTS) {
      await delay(TEACHER_FORM_REQUEST_RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(lastErrorMessage)
}

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
  const [candidateIdFromLink, setCandidateIdFromLink] = useState<string | null>(null)
  const [isVerifyingCandidate, setIsVerifyingCandidate] = useState(false)
  const [verifiedCandidateId, setVerifiedCandidateId] = useState<string | null>(null)
  const [verifiedCandidateName, setVerifiedCandidateName] = useState<string>("")

  // 加载字典数据
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        setIsLoadingDict(true)
        const dicts = await DictionaryService.getTeacherFormDictionaries()

        setDictOptions({
          subject: dicts.subject || [],
          grade: dicts.grade || [],
          free_time: dicts.free_time || [],
          textbook_version: dicts.textbook_version || [],
          province: dicts.province || [],
          student_type: dicts.student_type || [],
        })
      } catch (error) {
        console.error("加载字典失败:", summarizeError(error))
      } finally {
        setIsLoadingDict(false)
      }
    }

    loadDictionaries()
  }, [])

  useEffect(() => {
    setCandidateIdFromLink(new URLSearchParams(window.location.search).get('candidate_id'))
  }, [])

  useEffect(() => {
    if (!candidateIdFromLink) {
      setIsVerifyingCandidate(false)
      return
    }

    const verifyCandidateLink = async () => {
      try {
        setIsVerifyingCandidate(true)
        const result = await postTeacherFormJson<TeacherFormCandidateVerification>(
          '/api/teacher-form/verify',
          { candidate_id: candidateIdFromLink },
          '候选人链接验证失败',
          TEACHER_FORM_ALLOWED_VERIFY_ERRORS
        )

        const candidate = result.data
        if (!candidate?.id) {
          throw new Error('候选人链接验证失败')
        }

        setVerifiedCandidateId(candidate.id)
        setVerifiedCandidateName(candidate.name || "")
        setFormData(prev => ({
          ...prev,
          teacher_name: candidate.name || prev.teacher_name,
          wechat: candidate.wechat_id || prev.wechat,
          classin_phone: candidate.phone || prev.classin_phone,
          subjects: Array.isArray(candidate.subjects) && candidate.subjects.length > 0 ? candidate.subjects : prev.subjects,
          grade_levels: Array.isArray(candidate.grade_levels) && candidate.grade_levels.length > 0 ? candidate.grade_levels : prev.grade_levels,
        }))
      } catch (error) {
        toast({
          title: '候选人链接验证失败',
          description: getClientSafeErrorMessage(
            error,
            '请联系招师老师重新发送链接',
            TEACHER_FORM_ALLOWED_VERIFY_ERRORS
          ),
          variant: 'destructive'
        })
      } finally {
        setIsVerifyingCandidate(false)
      }
    }

    verifyCandidateLink()
  }, [candidateIdFromLink, toast])

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

  const uploadTeacherFormFile = async (file: File, type: 'photo' | 'screenshots'): Promise<string> => {
    const validationError = validateTeacherFormImage(file)
    if (validationError) {
      throw new Error(validationError)
    }

    if (!verifiedCandidateId) {
      throw new NonRetriableUploadError('请使用招师发送的专属表单链接上传文件')
    }

    const uploadFormData = new FormData()
    uploadFormData.append('file', file)
    uploadFormData.append('type', type)
    uploadFormData.append('candidate_id', verifiedCandidateId)

    let lastErrorMessage = '上传失败'

    for (let attempt = 1; attempt <= TEACHER_FORM_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        const { ok, status, data } = await postTeacherFormUpload(uploadFormData)

        if (ok) {
          if (!data?.url) {
            throw new NonRetriableUploadError('上传失败，未返回文件链接')
          }

          return data.url
        }

        lastErrorMessage = getUploadErrorMessage(data, '上传失败')

        if (!isRetriableUploadStatus(status)) {
          throw new NonRetriableUploadError(lastErrorMessage)
        }
      } catch (error) {
        if (error instanceof NonRetriableUploadError) {
          throw error
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          lastErrorMessage = '上传超时，请检查网络后重试'
        } else {
          lastErrorMessage = getClientSafeErrorMessage(error, '上传失败', TEACHER_FORM_ALLOWED_UPLOAD_ERRORS)
        }

        if (attempt === TEACHER_FORM_UPLOAD_MAX_ATTEMPTS) {
          throw new Error(lastErrorMessage)
        }
      }

      if (attempt < TEACHER_FORM_UPLOAD_MAX_ATTEMPTS) {
        await delay(TEACHER_FORM_UPLOAD_RETRY_DELAY_MS * attempt)
      }
    }

    throw new Error(lastErrorMessage)
  }

  // 处理文件上传
  const handleFileUpload = async (file: File, type: 'photo' | 'screenshots') => {
    try {
      const validationError = validateTeacherFormImage(file)
      if (validationError) {
        throw new Error(validationError)
      }

      if (type === 'photo') {
        setUploadingPhoto(true)
      } else {
        setUploadingScreenshots(true)
      }

      const url = await uploadTeacherFormFile(file, type)

      if (type === 'photo') {
        setFormData(prev => ({ ...prev, photo_url: url }))
      } else {
        setFormData(prev => ({
          ...prev,
          review_screenshots: [...prev.review_screenshots, url]
        }))
      }

      toast({
        title: '上传成功',
        description: '文件已成功上传',
        variant: 'default'
      })

      return url
    } catch (error) {
      toast({
        title: '上传失败',
        description: getClientSafeErrorMessage(
          error,
          '文件上传失败，请稍后重试',
          TEACHER_FORM_ALLOWED_UPLOAD_ERRORS
        ),
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

  const handleScreenshotUpload = async (files: File[]) => {
    if (files.length === 0) {
      return
    }

    try {
      const validationError = files
        .map(validateTeacherFormImage)
        .find((message): message is string => Boolean(message))

      if (validationError) {
        throw new Error(validationError)
      }

      setUploadingScreenshots(true)

      const urls = await Promise.all(files.map(file => uploadTeacherFormFile(file, 'screenshots')))

      setFormData(prev => ({
        ...prev,
        review_screenshots: [...prev.review_screenshots, ...urls]
      }))

      toast({
        title: '上传成功',
        description: `已成功上传 ${urls.length} 张图片`,
        variant: 'default'
      })

      return urls
    } catch (error) {
      toast({
        title: '上传失败',
        description: getClientSafeErrorMessage(
          error,
          '文件上传失败，请稍后重试',
          TEACHER_FORM_ALLOWED_UPLOAD_ERRORS
        ),
        variant: 'destructive'
      })
      throw error
    } finally {
      setUploadingScreenshots(false)
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
      let candidateId = verifiedCandidateId

      if (!candidateId) {
        toast({
          title: '身份验证失败',
          description: '请使用招师发送的专属表单链接提交信息',
          variant: 'destructive'
        })
        return
      }

      // 3. 验证通过，提交表单数据
      await postTeacherFormJson<TeacherFormSubmitResult>(
        '/api/teacher-form',
        {
          ...formData,
          candidate_id: candidateId,
        },
        '提交失败，请稍后重试',
        TEACHER_FORM_ALLOWED_SUBMIT_ERRORS
      )

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
        description: getClientSafeErrorMessage(error, '提交失败，请稍后重试', TEACHER_FORM_ALLOWED_SUBMIT_ERRORS),
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoadingDict || isVerifyingCandidate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{isVerifyingCandidate ? '正在验证表单链接...' : '加载中...'}</p>
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
            {verifiedCandidateName && (
              <p className="text-sm text-muted-foreground mt-2">
                已识别候选人：{verifiedCandidateName}
              </p>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-8">

              {/* 基本信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">基本信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher_name">
                      老师姓名 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="teacher_name"
                      value={formData.teacher_name}
                      onChange={(e) => setFormData({ ...formData, teacher_name: e.target.value })}
                      placeholder="请输入老师姓名"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      性别 <span className="text-destructive">*</span>
                    </Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="wechat">
                      微信号 <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">请输入面试时填写的微信号，用于验证您的身份</p>
                    <Input
                      id="wechat"
                      value={formData.wechat}
                      onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                      placeholder="请输入微信号"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classin_phone">
                      ClassIn注册手机号 <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">用于后续开课</p>
                    <Input
                      id="classin_phone"
                      value={formData.classin_phone}
                      onChange={(e) => setFormData({ ...formData, classin_phone: e.target.value })}
                      placeholder="请输入手机号"
                      maxLength={11}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      是否用过ClassIn <span className="text-destructive">*</span>
                    </Label>
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

                  <div className="space-y-2">
                    <Label>
                      是否有教资证 <span className="text-destructive">*</span>
                    </Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="location">
                      老师所在地 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="请输入老师所在地"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      学历 <span className="text-destructive">*</span>
                    </Label>
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

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="university">
                      毕业院校 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="university"
                      value={formData.university}
                      onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                      placeholder="请输入毕业院校"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    教授学科 <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground font-normal ml-2">（请选择所授学科）</span>
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
                    {dictOptions.subject.map(option => (
                      <div key={option.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subject-${option.code}`}
                          checked={formData.subjects.includes(option.label)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('subjects', option.label, checked as boolean)
                          }
                        />
                        <Label htmlFor={`subject-${option.code}`} className="text-sm font-normal cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    教授年级段 <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground font-normal ml-2">（至多2个学龄段，小初或初高）</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
                    {GRADE_LEVEL_OPTIONS.map(option => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`grade-${option}`}
                          checked={formData.grade_levels.includes(option)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange('grade_levels', option, checked as boolean)
                          }
                        />
                        <Label htmlFor={`grade-${option}`} className="text-sm font-normal cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.grade_levels.length > 2 && (
                    <p className="text-sm text-destructive mt-1">至多选择2个学龄段</p>
                  )}
                </div>
              </div>

              {/* 教学相关 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">教学相关信息</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      可排课时间 <span className="text-destructive">*</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">（大致空闲时间，排课前会跟您沟通；学期中尽量多选晚上或周末）</span>
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
                      {dictOptions.free_time.map(option => (
                        <div key={option.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`time-${option.code}`}
                            checked={formData.available_times.includes(option.label)}
                            onCheckedChange={(checked) =>
                              handleMultiSelectChange('available_times', option.label, checked as boolean)
                            }
                          />
                          <Label htmlFor={`time-${option.code}`} className="text-sm font-normal cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      熟悉的教材版本 <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
                      {dictOptions.textbook_version.map(option => (
                        <div key={option.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`textbook-${option.code}`}
                            checked={formData.textbook_versions.includes(option.label)}
                            onCheckedChange={(checked) =>
                              handleMultiSelectChange('textbook_versions', option.label, checked as boolean)
                            }
                          />
                          <Label htmlFor={`textbook-${option.code}`} className="text-sm font-normal cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      带过学生地域 <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
                      {dictOptions.province.map(option => (
                        <div key={option.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`region-${option.code}`}
                            checked={formData.student_regions.includes(option.label)}
                            onCheckedChange={(checked) =>
                              handleMultiSelectChange('student_regions', option.label, checked as boolean)
                            }
                          />
                          <Label htmlFor={`region-${option.code}`} className="text-sm font-normal cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      擅长的学生水平 <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
                      {STUDENT_LEVEL_OPTIONS.map(option => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`level-${option}`}
                            checked={formData.student_levels.includes(option)}
                            onCheckedChange={(checked) =>
                              handleMultiSelectChange('student_levels', option, checked as boolean)
                            }
                          />
                          <Label htmlFor={`level-${option}`} className="text-sm font-normal cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teaching_years">
                      教学年限 <span className="text-destructive">*</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">（单位：年）</span>
                    </Label>
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
              </div>

              {/* 教师简历 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">教师简历</h3>

                <div className="space-y-2">
                  <Label htmlFor="teaching_style">
                    教学特点 <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground font-normal ml-2">（教师简历 Part-1）</span>
                  </Label>
                  <Textarea
                    id="teaching_style"
                    value={formData.teaching_style}
                    onChange={(e) => setFormData({ ...formData, teaching_style: e.target.value })}
                    placeholder="请描述您的教学特点"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teaching_experience">
                    教学经历 <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground font-normal ml-2">（教师简历 Part-2）</span>
                  </Label>
                  <Textarea
                    id="teaching_experience"
                    value={formData.teaching_experience}
                    onChange={(e) => setFormData({ ...formData, teaching_experience: e.target.value })}
                    placeholder="请描述您的教学经历"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="success_cases">
                    优秀学员提分案例 <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground font-normal ml-2">（教师简历 Part-3）</span>
                  </Label>
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
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">上传文件</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      老师形象照 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="file"
                      accept={TEACHER_FORM_IMAGE_ACCEPT}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(file, 'photo').catch(() => undefined)
                        }
                      }}
                      disabled={uploadingPhoto}
                    />
                    {uploadingPhoto && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center">
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        上传中...
                      </p>
                    )}
                    {formData.photo_url && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={formData.photo_url}
                          alt="形象照"
                          className="w-16 h-16 object-cover rounded"
                        />
                        <p className="text-sm text-green-600 flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          已上传
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>提分/好评截图</Label>
                    <p className="text-xs text-muted-foreground">可上传多张图片（选填）</p>
                    <Input
                      type="file"
                      accept={TEACHER_FORM_IMAGE_ACCEPT}
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        handleScreenshotUpload(files).catch(() => undefined)
                      }}
                      disabled={uploadingScreenshots}
                    />
                    {uploadingScreenshots && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center">
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        上传中...
                      </p>
                    )}
                    {formData.review_screenshots.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {formData.review_screenshots.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`截图 ${index + 1}`}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 备注 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">备注</Label>
                  <p className="text-xs text-muted-foreground">有其他擅长、排课偏好、或能教其他赛道等，都可以告诉我们（选填）</p>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="请输入备注信息"
                    rows={3}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  type="submit"
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
