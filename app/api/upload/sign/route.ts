import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logger'
import { authenticateUser, AuthStatus } from '@/lib/middleware'
import { ACTIONS, hasPermission, RESOURCES, type Action, type Resource, type Role } from '@/lib/permissions'
import { summarizeError } from '@/lib/safe-error'
import { createSignedUploadUrlWithEnsure, isBucketProvisionError } from '@/lib/server-storage'

const logger = createLogger('API:UploadSign')

export const runtime = 'nodejs'

const MB = 1024 * 1024
const IMAGE_EXTENSIONS = [
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
]

const BUCKET_CONFIG = {
  'teacher-photos': {
    maxSize: 20 * MB,
    allowedPrefixes: ['image/'],
    allowedExtensions: IMAGE_EXTENSIONS,
  },
  'teacher-resumes': {
    maxSize: 50 * MB,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedPrefixes: ['image/'],
    allowedExtensions: ['.pdf', '.doc', '.docx', ...IMAGE_EXTENSIONS],
  },
  'lead-resumes': {
    maxSize: 50 * MB,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedPrefixes: ['image/'],
    allowedExtensions: ['.pdf', '.doc', '.docx', ...IMAGE_EXTENSIONS],
  },
  'lead-attachments': {
    maxSize: 50 * MB,
    allowedPrefixes: ['image/'],
    allowedExtensions: ['.pdf', '.doc', '.docx', ...IMAGE_EXTENSIONS],
  },
  'payment-proofs': {
    maxSize: 20 * MB,
    allowedTypes: ['application/pdf'],
    allowedPrefixes: ['image/'],
    allowedExtensions: ['.pdf', ...IMAGE_EXTENSIONS],
  },
  'chat-screenshots': {
    maxSize: 20 * MB,
    allowedPrefixes: ['image/'],
    allowedExtensions: IMAGE_EXTENSIONS,
  },
  'teacher-interview-videos': {
    maxSize: 500 * MB,
    allowedPrefixes: ['video/'],
    allowedExtensions: ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'],
  },
} as const

type BucketName = keyof typeof BUCKET_CONFIG
type UploadRequirement = {
  resource: Resource
  action: Action
}

const BUCKET_PERMISSION_REQUIREMENTS: Record<BucketName, UploadRequirement[]> = {
  'teacher-photos': [
    { resource: RESOURCES.teachers, action: ACTIONS.create },
    { resource: RESOURCES.teachers, action: ACTIONS.edit },
  ],
  'teacher-resumes': [
    { resource: RESOURCES.teacherCandidates, action: ACTIONS.interview },
    { resource: RESOURCES.teacherCandidates, action: ACTIONS.evaluate },
  ],
  'lead-resumes': [
    { resource: RESOURCES.leads, action: ACTIONS.create },
    { resource: RESOURCES.leads, action: ACTIONS.edit },
  ],
  'lead-attachments': [
    { resource: RESOURCES.leads, action: ACTIONS.create },
    { resource: RESOURCES.leads, action: ACTIONS.edit },
  ],
  'payment-proofs': [
    { resource: RESOURCES.trialLessons, action: ACTIONS.create },
    { resource: RESOURCES.trialLessons, action: ACTIONS.edit },
    { resource: RESOURCES.formalOrders, action: ACTIONS.create },
    { resource: RESOURCES.formalOrders, action: ACTIONS.edit },
    { resource: RESOURCES.transactions, action: ACTIONS.create },
    { resource: RESOURCES.transactions, action: ACTIONS.payment },
  ],
  'chat-screenshots': [
    { resource: RESOURCES.leads, action: ACTIONS.create },
    { resource: RESOURCES.leads, action: ACTIONS.edit },
    { resource: RESOURCES.leads, action: ACTIONS.feedback },
  ],
  'teacher-interview-videos': [
    { resource: RESOURCES.teacherCandidates, action: ACTIONS.uploadVideo },
  ],
}

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
}

const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/webm': '.webm',
}

function authFailureResponse(status: AuthStatus) {
  if (status === AuthStatus.NO_TOKEN) {
    return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 })
  }

  if (status === AuthStatus.EXPIRED_TOKEN) {
    return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 })
  }

  if (status === AuthStatus.ACCOUNT_DISABLED) {
    return NextResponse.json({
      error: '账号已停用，请联系管理员',
      code: 'ACCOUNT_DISABLED',
    }, { status: 403 })
  }

  if (status === AuthStatus.PROFILE_UNAVAILABLE) {
    return NextResponse.json({
      error: '用户档案暂时不可用，请稍后重试',
      code: 'PROFILE_UNAVAILABLE',
    }, { status: 500 })
  }

  return NextResponse.json({ error: '登录信息无效，请重新登录' }, { status: 401 })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getStringBodyValue(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

function getFileSize(body: Record<string, unknown>): number {
  const value = body.fileSize
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN

  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function getFileExtension(fileName: string): string {
  const cleanName = fileName.split('?')[0].split('#')[0].toLowerCase()
  const lastDot = cleanName.lastIndexOf('.')
  return lastDot >= 0 ? cleanName.slice(lastDot) : ''
}

function getContentType(fileName: string, contentType: string): string {
  const normalized = contentType.trim()
  if (normalized) return normalized

  const extension = getFileExtension(fileName)
  return CONTENT_TYPES_BY_EXTENSION[extension] || 'application/octet-stream'
}

function isAllowedFile(fileName: string, contentType: string, bucketName: BucketName): boolean {
  const config = BUCKET_CONFIG[bucketName]
  const extension = getFileExtension(fileName)
  const normalizedType = getContentType(fileName, contentType)
  const allowedTypes = 'allowedTypes' in config ? config.allowedTypes as readonly string[] : []
  const allowedExtensions = config.allowedExtensions as readonly string[]
  const matchesType = allowedTypes.includes(normalizedType)
  const matchesPrefix = config.allowedPrefixes.some(prefix => normalizedType.startsWith(prefix))
  const matchesExtension = allowedExtensions.includes(extension)

  return matchesType || matchesPrefix || matchesExtension
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / MB)}MB`
}

function getStorageExtension(fileName: string, contentType: string, bucketName: BucketName): string {
  const config = BUCKET_CONFIG[bucketName]
  const allowedExtensions = config.allowedExtensions as readonly string[]
  const extension = getFileExtension(fileName)

  if (allowedExtensions.includes(extension)) {
    return extension
  }

  const contentTypeExtension = EXTENSIONS_BY_CONTENT_TYPE[getContentType(fileName, contentType)]
  if (contentTypeExtension && allowedExtensions.includes(contentTypeExtension)) {
    return contentTypeExtension
  }

  return ''
}

function makeStorageFileName(fileName: string, contentType: string, bucketName: BucketName): string {
  const extension = getStorageExtension(fileName, contentType, bucketName)
  return `${uuidv4()}${extension}`
}

function canUploadToBucket(role: Role, bucketName: BucketName): boolean {
  return BUCKET_PERMISSION_REQUIREMENTS[bucketName].some(({ resource, action }) => {
    return hasPermission(role, resource, action)
  })
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (authResult.status !== AuthStatus.AUTHENTICATED) {
      return authFailureResponse(authResult.status)
    }

    if (!authResult.role) {
      return NextResponse.json({ error: '用户角色未配置，请联系管理员' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({
        error: '上传参数无效',
        code: 'UPLOAD_INVALID_PAYLOAD',
      }, { status: 400 })
    }

    const bucketName = getStringBodyValue(body, 'bucket') || 'chat-screenshots'
    const fileName = getStringBodyValue(body, 'fileName')
    const contentTypeInput = getStringBodyValue(body, 'contentType')
    const fileSize = getFileSize(body)

    if (!(bucketName in BUCKET_CONFIG)) {
      return NextResponse.json({
        error: 'Invalid bucket name',
        code: 'UPLOAD_INVALID_BUCKET',
      }, { status: 400 })
    }

    if (!fileName) {
      return NextResponse.json({
        error: '没有上传文件',
        code: 'UPLOAD_MISSING_FILE',
      }, { status: 400 })
    }

    const bucket = bucketName as BucketName
    const bucketConfig = BUCKET_CONFIG[bucket]
    const contentType = getContentType(fileName, contentTypeInput)

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({
        error: '文件为空，请重新选择文件',
        code: 'UPLOAD_EMPTY_FILE',
      }, { status: 400 })
    }

    if (!canUploadToBucket(authResult.role, bucket)) {
      logger.warn('Signed upload permission denied', {
        bucketName: bucket,
        role: authResult.role,
        userId: authResult.userId,
      })
      return NextResponse.json({
        error: '权限不足，不能上传到该业务目录',
        code: 'UPLOAD_BUCKET_PERMISSION_DENIED',
      }, { status: 403 })
    }

    if (fileSize > bucketConfig.maxSize) {
      return NextResponse.json({
        error: `文件大小超过限制，最大支持 ${formatBytes(bucketConfig.maxSize)}`,
        code: 'UPLOAD_FILE_TOO_LARGE',
      }, { status: 400 })
    }

    if (!isAllowedFile(fileName, contentTypeInput, bucket)) {
      return NextResponse.json({
        error: '不支持的文件类型',
        code: 'UPLOAD_UNSUPPORTED_TYPE',
      }, { status: 400 })
    }

    const storageFileName = makeStorageFileName(fileName, contentTypeInput, bucket)
    const { data, error } = await createSignedUploadUrlWithEnsure({
      bucketName,
      filePath: storageFileName,
    })

    if (error || !data) {
      const bucketProvisionError = error ? isBucketProvisionError(error) : false

      logger.error('Signed upload URL error', {
        bucketName,
        fileSize,
        contentType,
        extension: getFileExtension(fileName) || null,
        ...summarizeError(error || new Error('missing signed upload data')),
      })
      return NextResponse.json({
        error: bucketProvisionError ? '存储目录初始化失败，请稍后重试' : '上传失败',
        code: bucketProvisionError ? 'UPLOAD_BUCKET_CREATE_FAILED' : 'UPLOAD_SIGN_FAILED',
      }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    logger.info('Signed upload URL created', {
      bucketName,
      fileSize,
    })

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      url: urlData.publicUrl,
      contentType,
    })
  } catch (error: unknown) {
    logger.error('Signed upload exception', summarizeError(error))
    return NextResponse.json({
      error: '上传失败',
      code: 'UPLOAD_SIGN_FAILED',
    }, { status: 500 })
  }
}
