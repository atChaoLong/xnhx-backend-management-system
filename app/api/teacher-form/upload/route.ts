import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { v4 as uuidv4 } from 'uuid'
import { uploadToOss } from '@/lib/server-oss'

export const runtime = 'nodejs'

const logger = createLogger('API:TeacherFormUpload')
const MB = 1024 * 1024
const MAX_IMAGE_SIZE = 20 * MB
const ALLOWED_IMAGE_EXTENSIONS = new Set([
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
const UPLOAD_TYPES = new Set(['photo', 'screenshots'])
const CANDIDATE_UPLOAD_SELECT = 'id, interview_result'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] || ''
}

function getContentTypeFromExtension(extension: string): string | null {
  const contentTypes: Record<string, string> = {
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
  }

  return contentTypes[extension] || null
}

function isAllowedImage(file: File): boolean {
  const extension = getFileExtension(file.name)
  return file.type.startsWith('image/') || ALLOWED_IMAGE_EXTENSIONS.has(extension)
}

function hasAscii(buffer: Buffer, offset: number, value: string): boolean {
  return buffer.subarray(offset, offset + value.length).equals(Buffer.from(value, 'ascii'))
}

function hasHex(buffer: Buffer, hex: string): boolean {
  return buffer.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'))
}

function isImageContent(buffer: Buffer): boolean {
  if (buffer.length < 4) return false

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
    return true
  }

  const ftypBrand = buffer.length >= 12 ? buffer.subarray(8, 12).toString('ascii') : ''
  return hasAscii(buffer, 4, 'ftyp') && ['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ftypBrand)
}

function makeStorageFileName(fileName: string): string {
  const extension = getFileExtension(fileName)

  return `${uuidv4()}${extension}`
}

function normalizeOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const maybeFile = value as Partial<File>
  return typeof maybeFile.arrayBuffer === 'function' &&
    typeof maybeFile.name === 'string' &&
    typeof maybeFile.size === 'number'
}

function summarizeUploadFile(
  file: File,
  fileType: FormDataEntryValue | null,
  candidateId: FormDataEntryValue | null
) {
  return {
    upload_type: typeof fileType === 'string' ? fileType : 'missing',
    has_candidate_id: Boolean(normalizeOptionalString(candidateId)),
    file_size: file.size,
    file_content_type: file.type || null,
    extension: getFileExtension(file.name) || null,
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 解析表单数据
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json({
        error: '请使用表单上传文件',
        code: 'TEACHER_FORM_UPLOAD_INVALID_CONTENT_TYPE',
      }, { status: 400 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (error) {
      logger.warn('教师表单文件上传表单解析失败', summarizeError(error))
      return NextResponse.json({
        error: '上传表单格式无效',
        code: 'TEACHER_FORM_UPLOAD_INVALID_FORM_DATA',
      }, { status: 400 })
    }

    const file = formData.get('file')
    const fileType = formData.get('type') // 'photo' or 'screenshots'
    const candidateIdValue = formData.get('candidate_id')
    const candidateId = normalizeOptionalString(candidateIdValue)

    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: '没有上传文件', code: 'TEACHER_FORM_UPLOAD_MISSING_FILE' }, { status: 400 })
    }

    if (typeof fileType !== 'string' || !UPLOAD_TYPES.has(fileType)) {
      return NextResponse.json({ error: '上传类型无效', code: 'TEACHER_FORM_UPLOAD_INVALID_TYPE' }, { status: 400 })
    }

    if (!candidateId) {
      return NextResponse.json({
        error: '请使用招师发送的专属表单链接上传文件',
        code: 'TEACHER_FORM_UPLOAD_CANDIDATE_REQUIRED',
      }, { status: 400 })
    }

    if (!UUID_PATTERN.test(candidateId)) {
      return NextResponse.json({
        error: '候选人链接无效，请使用招师发送的专属表单链接',
        code: 'TEACHER_FORM_UPLOAD_INVALID_CANDIDATE_ID',
      }, { status: 400 })
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('teacher_candidates')
      .select(CANDIDATE_UPLOAD_SELECT)
      .eq('id', candidateId)
      .maybeSingle()

    if (candidateError) {
      logger.error('教师表单上传候选人校验失败', {
        file_summary: summarizeUploadFile(file, fileType, candidateIdValue),
        error_summary: summarizeError(candidateError),
      })
      return NextResponse.json({
        error: '候选人校验失败，请稍后重试',
        code: 'TEACHER_FORM_UPLOAD_CANDIDATE_LOOKUP_FAILED',
      }, { status: 500 })
    }

    if (!candidate) {
      return NextResponse.json({
        error: '未找到候选人信息，请使用招师发送的专属表单链接',
        code: 'TEACHER_FORM_UPLOAD_CANDIDATE_NOT_FOUND',
      }, { status: 404 })
    }

    if (candidate.interview_result && candidate.interview_result !== '通过面试') {
      return NextResponse.json({
        error: '该候选人尚未通过面试',
        code: 'TEACHER_FORM_UPLOAD_CANDIDATE_NOT_APPROVED',
      }, { status: 400 })
    }

    const { data: existingSubmission, error: existingSubmissionError } = await supabaseAdmin
      .from('teacher_details')
      .select('id')
      .eq('candidate_id', candidate.id)
      .maybeSingle()

    if (existingSubmissionError) {
      logger.error('教师表单上传重复提交校验失败', {
        candidate_id: candidate.id,
        file_summary: summarizeUploadFile(file, fileType, candidateIdValue),
        error_summary: summarizeError(existingSubmissionError),
      })
      return NextResponse.json({
        error: '提交状态校验失败，请稍后重试',
        code: 'TEACHER_FORM_UPLOAD_SUBMISSION_LOOKUP_FAILED',
      }, { status: 500 })
    }

    if (existingSubmission) {
      return NextResponse.json({
        error: '您已经提交过信息，如需修改请联系教务老师',
        code: 'TEACHER_FORM_UPLOAD_ALREADY_SUBMITTED',
      }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: '文件为空，请重新选择文件', code: 'TEACHER_FORM_UPLOAD_EMPTY_FILE' }, { status: 400 })
    }

    // 2. 验证文件类型
    if (!isAllowedImage(file)) {
      return NextResponse.json({
        error: '不支持的文件类型，仅支持图片',
        code: 'TEACHER_FORM_UPLOAD_UNSUPPORTED_TYPE',
        allowedExtensions: Array.from(ALLOWED_IMAGE_EXTENSIONS),
      }, { status: 400 })
    }

    // 3. 验证文件大小（最大 20MB）
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({
        error: '文件大小超过限制，最大支持 20MB',
        code: 'TEACHER_FORM_UPLOAD_TOO_LARGE',
        maxSize: '20MB'
      }, { status: 400 })
    }

    // 4. 转换文件为 Buffer，并校验真实图片内容
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    if (!isImageContent(fileBuffer)) {
      return NextResponse.json({
        error: '文件内容与图片类型不匹配，请重新选择文件',
        code: 'TEACHER_FORM_UPLOAD_CONTENT_TYPE_MISMATCH',
      }, { status: 400 })
    }

    // 5. 确定 bucket 名称
    const bucketName = 'teacher-form-files'

    const extension = getFileExtension(file.name)
    const fileName = `${candidate.id}/${fileType}/${makeStorageFileName(file.name)}`
    const uploadContentType = file.type || getContentTypeFromExtension(extension) || 'application/octet-stream'

    let ossResult: { key: string; url: string }
    try {
      ossResult = await uploadToOss({
        bucketName,
        filePath: fileName,
        fileBuffer,
        contentType: uploadContentType,
      })
    } catch (ossError) {
      logger.error('教师表单文件上传失败', {
        bucket_name: bucketName,
        file_summary: summarizeUploadFile(file, fileType, candidateIdValue),
        ...summarizeError(ossError),
      })
      return NextResponse.json({
        error: '上传失败',
        code: 'TEACHER_FORM_UPLOAD_STORAGE_ERROR',
      }, { status: 500 })
    }

    // 9. 返回结果
    return NextResponse.json({
      success: true,
      url: ossResult.url,
      path: ossResult.key
    }, { status: 201 })

  } catch (error) {
    logger.error('教师表单文件上传异常', summarizeError(error))
    return NextResponse.json({
      error: '服务器错误'
    }, { status: 500 })
  }
}
