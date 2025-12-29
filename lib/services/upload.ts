/**
 * 文件上传工具函数
 */

import { api } from '@/lib/fetch'

/**
 * 上传文件到 Supabase Storage
 * @param file 要上传的文件
 * @param bucket 存储桶名称
 * @returns 公开的 URL
 */
export async function uploadFile(file: File, bucket: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('bucket', bucket)

  const response = await api.post('/api/upload', formData)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || `Failed to upload file to ${bucket}`)
  }

  const { url } = await response.json()
  return url
}

/**
 * 上传聊天截图
 */
export async function uploadChatScreenshot(file: File): Promise<string> {
  return uploadFile(file, 'chat-screenshots')
}

/**
 * 上传教师简历
 */
export async function uploadTeacherResume(file: File): Promise<string> {
  return uploadFile(file, 'teacher-resumes')
}

/**
 * 上传教师照片
 */
export async function uploadTeacherPhoto(file: File): Promise<string> {
  return uploadFile(file, 'teacher-photos')
}

/**
 * 上传线索简历
 */
export async function uploadLeadResume(file: File): Promise<string> {
  return uploadFile(file, 'lead-resumes')
}

/**
 * 上传付款凭证
 */
export async function uploadPaymentProof(file: File): Promise<string> {
  return uploadFile(file, 'payment-proofs')
}
