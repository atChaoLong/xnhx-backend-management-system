import { supabase } from './supabase'
import { createLogger } from './logger'
import { summarizeError } from './safe-error'
import { uploadFile as uploadFileWithSignedUrl } from './services/upload'

const logger = createLogger('SupabaseClient')

/**
 * 获取当前用户的 access token
 * 用于需要认证的 API 请求
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) return data.session.access_token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('supabase.auth.token')
      if (token && token.trim()) return token
    }
    return null
  } catch (error) {
    logger.warn('获取 access token 失败', summarizeError(error))
    return null
  }
}

/**
 * 上传文件到 Supabase Storage
 * @param file 要上传的文件
 * @param bucket 存储桶名称（默认为 'payment-proofs'）
 * @returns 公开 URL
 */
export async function uploadFile(
  file: File,
  bucket: string = 'payment-proofs'
): Promise<string> {
  const token = await getAccessToken()

  if (!token) {
    throw new Error('未登录或登录已过期')
  }

  return uploadFileWithSignedUrl(file, bucket)
}
