/**
 * 文件上传工具函数
 */

import { api } from '@/lib/fetch'
import { getClientSafeErrorMessage } from '@/lib/safe-error'
import { supabase } from '@/lib/supabase'

const MB = 1024 * 1024
const IMAGE_EXTENSIONS = new Set([
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
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx'])
const PAYMENT_PROOF_ALLOWED_TYPES = new Set([
  'application/pdf',
])
const PAYMENT_PROOF_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  ...IMAGE_EXTENSIONS,
])
const RESUME_ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const RESUME_ALLOWED_EXTENSIONS = new Set([
  ...DOCUMENT_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
])
const INTERVIEW_VIDEO_ALLOWED_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
])
const INTERVIEW_VIDEO_ALLOWED_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm',
])

export const CHAT_SCREENSHOT_ACCEPT = 'image/*'
export const CHAT_SCREENSHOT_MAX_SIZE = 20 * MB
export const PAYMENT_PROOF_ACCEPT = 'image/*,application/pdf'
export const PAYMENT_PROOF_MAX_SIZE = 20 * MB
export const TEACHER_PHOTO_ACCEPT = 'image/*'
export const TEACHER_PHOTO_MAX_SIZE = 20 * MB
export const TEACHER_RESUME_ACCEPT = '.pdf,.doc,.docx,image/*'
export const TEACHER_RESUME_MAX_SIZE = 50 * MB
export const LEAD_RESUME_ACCEPT = TEACHER_RESUME_ACCEPT
export const LEAD_RESUME_MAX_SIZE = TEACHER_RESUME_MAX_SIZE
export const INTERVIEW_VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/x-m4v,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.m4v,.avi,.mkv,.webm'
export const INTERVIEW_VIDEO_MAX_SIZE = 500 * MB
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000
const UPLOAD_REQUEST_MAX_ATTEMPTS = 3
const UPLOAD_REQUEST_RETRY_DELAY_MS = 700
const UPLOAD_DEFAULT_ERROR_MESSAGE = '上传失败，请稍后重试'
const UPLOAD_SAFE_ERROR_MESSAGES: readonly string[] = [
  '文件为空，请重新选择文件',
  '文件大小超过限制，最大支持 20MB',
  '文件大小超过限制，最大支持 50MB',
  '文件大小超过限制，最大支持 500MB',
  '不支持的文件类型，仅支持图片或 PDF',
  '不支持的文件类型，仅支持图片',
  '不支持的文件类型，仅支持 PDF、Word 或图片',
  '不支持的视频类型，仅支持 MP4、MOV、M4V、AVI、MKV、WebM',
  '上传失败，未返回文件链接',
  '上传超时，请检查网络后重试',
  '未登录或登录已过期',
  '登录已过期，请重新登录',
  '账号已停用，请联系管理员',
  '用户档案暂时不可用，请稍后重试',
  '登录信息无效，请重新登录',
  '用户角色未配置，请联系管理员',
  '没有上传文件',
  '权限不足，不能上传到该业务目录',
  '不支持的文件类型',
  '文件内容与类型不匹配，请重新选择文件',
  '存储目录初始化失败，请稍后重试',
  '上传失败',
]

type SignedUploadResponse = {
  signedUrl: string
  token: string
  path: string
  url: string
  contentType?: string
}

function getFileExtension(fileName: string): string {
  const cleanName = fileName.split('?')[0].split('#')[0]
  const lastDot = cleanName.lastIndexOf('.')
  return lastDot >= 0 ? cleanName.slice(lastDot).toLowerCase() : ''
}

export function isPaymentProofImagePath(fileNameOrUrl: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(fileNameOrUrl))
}

export function isPaymentProofImageFile(file: File): boolean {
  return file.type.startsWith('image/') || isPaymentProofImagePath(file.name)
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXTENSIONS.has(getFileExtension(file.name))
}

export function validatePaymentProofFile(file: File): string | null {
  if (file.size <= 0) {
    return '文件为空，请重新选择文件'
  }

  if (file.size > PAYMENT_PROOF_MAX_SIZE) {
    return '文件大小超过限制，最大支持 20MB'
  }

  const extension = getFileExtension(file.name)
  if (!PAYMENT_PROOF_ALLOWED_TYPES.has(file.type) && !isImageFile(file) && !PAYMENT_PROOF_ALLOWED_EXTENSIONS.has(extension)) {
    return '不支持的文件类型，仅支持图片或 PDF'
  }

  return null
}

export function validateChatScreenshotFile(file: File): string | null {
  if (file.size <= 0) {
    return '文件为空，请重新选择文件'
  }

  if (file.size > CHAT_SCREENSHOT_MAX_SIZE) {
    return '文件大小超过限制，最大支持 20MB'
  }

  if (!isImageFile(file)) {
    return '不支持的文件类型，仅支持图片'
  }

  return null
}

export function validateTeacherPhotoFile(file: File): string | null {
  if (file.size <= 0) {
    return '文件为空，请重新选择文件'
  }

  if (file.size > TEACHER_PHOTO_MAX_SIZE) {
    return '文件大小超过限制，最大支持 20MB'
  }

  if (!isImageFile(file)) {
    return '不支持的文件类型，仅支持图片'
  }

  return null
}

export function validateTeacherResumeFile(file: File): string | null {
  if (file.size <= 0) {
    return '文件为空，请重新选择文件'
  }

  if (file.size > TEACHER_RESUME_MAX_SIZE) {
    return '文件大小超过限制，最大支持 50MB'
  }

  const extension = getFileExtension(file.name)
  if (!RESUME_ALLOWED_TYPES.has(file.type) && !isImageFile(file) && !RESUME_ALLOWED_EXTENSIONS.has(extension)) {
    return '不支持的文件类型，仅支持 PDF、Word 或图片'
  }

  return null
}

export function validateLeadResumeFile(file: File): string | null {
  return validateTeacherResumeFile(file)
}

export function validateInterviewVideoFile(file: File): string | null {
  if (file.size <= 0) {
    return '文件为空，请重新选择文件'
  }

  if (file.size > INTERVIEW_VIDEO_MAX_SIZE) {
    return '文件大小超过限制，最大支持 500MB'
  }

  const extension = getFileExtension(file.name)
  if (!INTERVIEW_VIDEO_ALLOWED_TYPES.has(file.type) && !INTERVIEW_VIDEO_ALLOWED_EXTENSIONS.has(extension)) {
    return '不支持的视频类型，仅支持 MP4、MOV、M4V、AVI、MKV、WebM'
  }

  return null
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function isRetriableUploadStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function isRetriableUploadError(error: unknown): boolean {
  return error instanceof TypeError
}

function getUploadResponseErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return UPLOAD_DEFAULT_ERROR_MESSAGE
  }

  const message = (data as { error?: unknown }).error
  return typeof message === 'string' && UPLOAD_SAFE_ERROR_MESSAGES.includes(message)
    ? message
    : UPLOAD_DEFAULT_ERROR_MESSAGE
}

function isSignedUploadResponse(data: unknown): data is SignedUploadResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as SignedUploadResponse).token === 'string' &&
    typeof (data as SignedUploadResponse).path === 'string' &&
    typeof (data as SignedUploadResponse).url === 'string' &&
    Boolean((data as SignedUploadResponse).token) &&
    Boolean((data as SignedUploadResponse).path) &&
    Boolean((data as SignedUploadResponse).url)
  )
}

function runWithUploadTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      controller.abort()
      reject(new DOMException('Upload timed out', 'AbortError'))
    }, UPLOAD_REQUEST_TIMEOUT_MS)

    operation(controller.signal)
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

async function uploadWithSignedUrl(file: File, bucket: string, signal: AbortSignal): Promise<string> {
  const signResponse = await api.post('/api/upload/sign', {
    bucket,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || '',
  }, {
    signal,
  })

  const responseData = await signResponse.json().catch(() => null)

  if (!signResponse.ok) {
    const error = new Error(getUploadResponseErrorMessage(responseData))
    Object.assign(error, { status: signResponse.status })
    throw error
  }

  if (!isSignedUploadResponse(responseData)) {
    throw new Error('上传失败，未返回文件链接')
  }

  const uploadResult = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(responseData.path, responseData.token, file, {
      cacheControl: '3600',
      contentType: responseData.contentType || file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadResult.error) {
    throw new Error(UPLOAD_DEFAULT_ERROR_MESSAGE)
  }

  return responseData.url
}

/**
 * 上传文件到 Supabase Storage
 * @param file 要上传的文件
 * @param bucket 存储桶名称
 * @returns 公开的 URL
 */
export async function uploadFile(file: File, bucket: string): Promise<string> {
  let lastErrorMessage = UPLOAD_DEFAULT_ERROR_MESSAGE

  for (let attempt = 1; attempt <= UPLOAD_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runWithUploadTimeout(signal => uploadWithSignedUrl(file, bucket, signal))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastErrorMessage = '上传超时，请检查网络后重试'
      } else {
        lastErrorMessage = getClientSafeErrorMessage(
          error,
          UPLOAD_DEFAULT_ERROR_MESSAGE,
          UPLOAD_SAFE_ERROR_MESSAGES
        )

        const errorStatus = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : null
        const isRetriableStatus = Number.isFinite(errorStatus) && errorStatus !== null
          ? isRetriableUploadStatus(errorStatus)
          : false

        if (
          attempt < UPLOAD_REQUEST_MAX_ATTEMPTS &&
          !isRetriableUploadError(error) &&
          !isRetriableStatus
        ) {
          throw new Error(lastErrorMessage)
        }
      }
    }

    if (attempt < UPLOAD_REQUEST_MAX_ATTEMPTS) {
      await delay(UPLOAD_REQUEST_RETRY_DELAY_MS * attempt)
    }
  }

  throw new Error(lastErrorMessage)
}

/**
 * 上传聊天截图
 */
export async function uploadChatScreenshot(file: File): Promise<string> {
  const validationError = validateChatScreenshotFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  return uploadFile(file, 'chat-screenshots')
}

/**
 * 上传教师简历
 */
export async function uploadTeacherResume(file: File): Promise<string> {
  const validationError = validateTeacherResumeFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  return uploadFile(file, 'teacher-resumes')
}

/**
 * 上传教师照片
 */
export async function uploadTeacherPhoto(file: File): Promise<string> {
  const validationError = validateTeacherPhotoFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  return uploadFile(file, 'teacher-photos')
}

/**
 * 上传线索简历
 */
export async function uploadLeadResume(file: File): Promise<string> {
  const validationError = validateLeadResumeFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  return uploadFile(file, 'lead-resumes')
}

/**
 * 上传教师面试视频
 */
export async function uploadTeacherInterviewVideo(file: File): Promise<string> {
  const validationError = validateInterviewVideoFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  return uploadFile(file, 'teacher-interview-videos')
}

/**
 * 上传付款凭证
 */
export async function uploadPaymentProof(file: File): Promise<string> {
  const validationError = validatePaymentProofFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  return uploadFile(file, 'payment-proofs')
}
