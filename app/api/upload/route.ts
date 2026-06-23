import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { createLogger } from "@/lib/logger"
import { authenticateUser, AuthStatus } from "@/lib/middleware"
import { ACTIONS, hasPermission, RESOURCES, type Action, type Resource, type Role } from "@/lib/permissions"
import { summarizeError } from "@/lib/safe-error"
import { uploadToOss } from '@/lib/server-oss'

const logger = createLogger('API:Upload')

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

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] || ''
}

function getContentType(file: File): string {
  const fromFile = file.type?.trim()
  if (fromFile) return fromFile

  const extension = getFileExtension(file.name)
  return CONTENT_TYPES_BY_EXTENSION[extension] || 'application/octet-stream'
}

function isAllowedFile(file: File, bucketName: BucketName): boolean {
  const config = BUCKET_CONFIG[bucketName]
  const extension = getFileExtension(file.name)
  const contentType = getContentType(file)
  const allowedTypes = 'allowedTypes' in config ? config.allowedTypes as readonly string[] : []
  const allowedExtensions = config.allowedExtensions as readonly string[]
  const matchesType = allowedTypes.includes(contentType)
  const matchesPrefix = config.allowedPrefixes.some(prefix => contentType.startsWith(prefix))
  const matchesExtension = allowedExtensions.includes(extension)

  return matchesType || matchesPrefix || matchesExtension
}

function hasAscii(buffer: Buffer, offset: number, value: string): boolean {
  return buffer.subarray(offset, offset + value.length).equals(Buffer.from(value, 'ascii'))
}

function hasHex(buffer: Buffer, hex: string): boolean {
  return buffer.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'))
}

function hasZipSignature(buffer: Buffer): boolean {
  return hasAscii(buffer, 0, 'PK\u0003\u0004')
}

function includesAscii(buffer: Buffer, value: string): boolean {
  return buffer.includes(Buffer.from(value, 'ascii'))
}

function isDocxArchive(buffer: Buffer): boolean {
  return hasZipSignature(buffer) &&
    includesAscii(buffer, '[Content_Types].xml') &&
    includesAscii(buffer, 'word/document.xml')
}

function detectFileKind(buffer: Buffer): 'image' | 'pdf' | 'word' | 'video' | null {
  if (buffer.length < 4) return null

  if (
    hasHex(buffer, 'ffd8ff') ||
    hasHex(buffer, '89504e47') ||
    hasAscii(buffer, 0, 'GIF87a') ||
    hasAscii(buffer, 0, 'GIF89a') ||
    hasAscii(buffer, 0, 'BM') ||
    hasHex(buffer, '49492a00') ||
    hasHex(buffer, '4d4d002a') ||
    (hasAscii(buffer, 0, 'RIFF') && hasAscii(buffer, 8, 'WEBP'))
  ) {
    return 'image'
  }

  const ftypBrand = buffer.length >= 12 ? buffer.subarray(8, 12).toString('ascii') : ''
  if (hasAscii(buffer, 4, 'ftyp') && ['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ftypBrand)) {
    return 'image'
  }

  if (hasAscii(buffer, 0, '%PDF')) return 'pdf'
  if (hasHex(buffer, 'd0cf11e0a1b11ae1')) return 'word'
  if (isDocxArchive(buffer)) return 'word'

  if (
    (hasAscii(buffer, 4, 'ftyp') && ['mp41', 'mp42', 'isom', 'iso2', 'avc1', 'qt  ', 'M4V '].includes(ftypBrand)) ||
    (hasAscii(buffer, 0, 'RIFF') && hasAscii(buffer, 8, 'AVI ')) ||
    hasHex(buffer, '1a45dfa3')
  ) {
    return 'video'
  }

  return null
}

function isAllowedFileContent(file: File, bucketName: BucketName, buffer: Buffer): boolean {
  const extension = getFileExtension(file.name)
  const kind = detectFileKind(buffer)

  if (!kind) return false

  if (bucketName === 'teacher-interview-videos') {
    return kind === 'video'
  }

  if (kind === 'image') {
    return (BUCKET_CONFIG[bucketName].allowedExtensions as readonly string[]).includes(extension)
  }

  if (kind === 'pdf') {
    return (BUCKET_CONFIG[bucketName].allowedExtensions as readonly string[]).includes('.pdf')
  }

  if (kind === 'word') {
    return ['.doc', '.docx'].includes(extension) &&
      (BUCKET_CONFIG[bucketName].allowedExtensions as readonly string[]).includes(extension)
  }

  return false
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / MB)}MB`
}

function getStorageExtension(file: File, bucketName: BucketName): string {
  const config = BUCKET_CONFIG[bucketName]
  const allowedExtensions = config.allowedExtensions as readonly string[]
  const extension = getFileExtension(file.name)

  if (allowedExtensions.includes(extension)) {
    return extension
  }

  const contentTypeExtension = EXTENSIONS_BY_CONTENT_TYPE[getContentType(file)]
  if (contentTypeExtension && allowedExtensions.includes(contentTypeExtension)) {
    return contentTypeExtension
  }

  return ''
}

function makeStorageFileName(file: File, bucketName: BucketName): string {
  const extension = getStorageExtension(file, bucketName)

  return `${uuidv4()}${extension}`
}

function canUploadToBucket(role: Role, bucketName: BucketName): boolean {
  return BUCKET_PERMISSION_REQUIREMENTS[bucketName].some(({ resource, action }) => {
    return hasPermission(role, resource, action)
  })
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

function summarizeUploadFile(file: File, bucketName: string) {
  return {
    bucketName,
    fileSize: file.size,
    fileType: getContentType(file),
    extension: getFileExtension(file.name) || null,
  }
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

    const formData = await request.formData()
    const file = formData.get('file')
    const bucketName = (formData.get('bucket') as string) || 'chat-screenshots'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '没有上传文件', code: 'UPLOAD_MISSING_FILE' }, { status: 400 })
    }

    // Validate bucket name
    if (!(bucketName in BUCKET_CONFIG)) {
      return NextResponse.json({
        error: 'Invalid bucket name',
        code: 'UPLOAD_INVALID_BUCKET',
      }, { status: 400 })
    }

    const bucket = bucketName as BucketName
    const bucketConfig = BUCKET_CONFIG[bucket]

    if (file.size <= 0) {
      return NextResponse.json({
        error: '文件为空，请重新选择文件',
        code: 'UPLOAD_EMPTY_FILE',
      }, { status: 400 })
    }

    if (!canUploadToBucket(authResult.role, bucket)) {
      logger.warn('Upload permission denied', {
        bucketName: bucket,
        role: authResult.role,
        userId: authResult.userId,
      })
      return NextResponse.json({
        error: '权限不足，不能上传到该业务目录',
        code: 'UPLOAD_BUCKET_PERMISSION_DENIED',
      }, { status: 403 })
    }

    if (file.size > bucketConfig.maxSize) {
      return NextResponse.json({
        error: `文件大小超过限制，最大支持 ${formatBytes(bucketConfig.maxSize)}`,
        code: 'UPLOAD_FILE_TOO_LARGE',
      }, { status: 400 })
    }

    if (!isAllowedFile(file, bucket)) {
      return NextResponse.json({
        error: '不支持的文件类型',
        code: 'UPLOAD_UNSUPPORTED_TYPE',
      }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    if (!isAllowedFileContent(file, bucket, fileBuffer)) {
      return NextResponse.json({
        error: '文件内容与类型不匹配，请重新选择文件',
        code: 'UPLOAD_CONTENT_TYPE_MISMATCH',
      }, { status: 400 })
    }

    logger.debug('Uploading file', {
      file: summarizeUploadFile(file, bucketName),
    })

    const storageFileName = makeStorageFileName(file, bucket)
    const contentType = getContentType(file)

    let ossResult: { key: string; url: string }
    try {
      ossResult = await uploadToOss({
        bucketName,
        filePath: storageFileName,
        fileBuffer,
        contentType,
      })
    } catch (ossError) {
      logger.error('OSS upload error', {
        bucketName,
        file: summarizeUploadFile(file, bucketName),
        ...summarizeError(ossError),
      })
      return NextResponse.json({
        error: '上传失败',
        code: 'UPLOAD_STORAGE_ERROR',
      }, { status: 500 })
    }

    logger.info('File uploaded to OSS successfully', {
      bucketName,
    })

    return NextResponse.json({ url: ossResult.url, path: ossResult.key })
  } catch (error: unknown) {
    logger.error('Upload exception', summarizeError(error))
    return NextResponse.json({
      error: '上传失败',
      code: 'UPLOAD_FAILED',
    }, { status: 500 })
  }
}
