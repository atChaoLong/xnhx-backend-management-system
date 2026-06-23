import OSS from 'ali-oss'
import { createLogger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/safe-error'

const logger = createLogger('OSS')

const ossAccessKeyId = process.env.OSS_ACCESS_KEY_ID || ''
const ossAccessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || ''
const ossRegion = process.env.OSS_REGION || ''
const ossBucket = process.env.bucket_name || ''

const OSS_BASE_DIR = 'backend_management_system'

let ossClient: OSS | null = null

function getOssClient(): OSS {
  if (ossClient) return ossClient

  if (!ossAccessKeyId || !ossAccessKeySecret || !ossRegion || !ossBucket) {
    throw new Error('OSS 环境变量未配置，请检查 OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_REGION, bucket_name')
  }

  ossClient = new OSS({
    accessKeyId: ossAccessKeyId,
    accessKeySecret: ossAccessKeySecret,
    region: ossRegion,
    bucket: ossBucket,
  })

  return ossClient
}

type UploadArgs = {
  bucketName: string
  filePath: string
  fileBuffer: Buffer
  contentType: string
}

type SignedUploadArgs = {
  bucketName: string
  filePath: string
  contentType: string
}

const ensuredDirs = new Set<string>()

async function ensureDirExists(dirPath: string): Promise<void> {
  if (ensuredDirs.has(dirPath)) return

  const client = getOssClient()

  try {
    await client.head(dirPath)
    logger.info('OSS 目录已存在', { dirPath })
  } catch {
    try {
      await client.put(dirPath, Buffer.alloc(0))
      logger.info('OSS 目录已自动创建', { dirPath })
    } catch (createError) {
      logger.warn('OSS 目录创建失败（可能已存在）', {
        dirPath,
        ...{ error: getErrorMessage(createError) },
      })
    }
  }

  ensuredDirs.add(dirPath)
}

function buildOssKey(bucketName: string, filePath: string): string {
  return `${OSS_BASE_DIR}/${bucketName}/${filePath}`
}

export async function uploadToOss({
  bucketName,
  filePath,
  fileBuffer,
  contentType,
}: UploadArgs): Promise<{ key: string; url: string }> {
  const client = getOssClient()
  const dirPath = `${OSS_BASE_DIR}/${bucketName}/`
  await ensureDirExists(dirPath)

  const key = buildOssKey(bucketName, filePath)

  const result = await client.put(key, fileBuffer, {
    mime: contentType,
  })

  if (result.res.status !== 200) {
    throw new Error(`OSS 上传失败，状态码: ${result.res.status}`)
  }

  const signedUrl = client.signatureUrl(key, {
    method: 'GET',
    expires: 31536000,
  })

  return {
    key,
    url: signedUrl,
  }
}

export async function createOssSignedUploadUrl({
  bucketName,
  filePath,
  contentType,
}: SignedUploadArgs): Promise<{ signedUrl: string; key: string; url: string }> {
  const client = getOssClient()
  const dirPath = `${OSS_BASE_DIR}/${bucketName}/`
  await ensureDirExists(dirPath)

  const key = buildOssKey(bucketName, filePath)

  const signedUrl = client.signatureUrl(key, {
    method: 'PUT',
    expires: 600,
    'Content-Type': contentType,
  })

  const getUrl = client.signatureUrl(key, {
    method: 'GET',
    expires: 31536000,
  })

  return {
    signedUrl,
    key,
    url: getUrl,
  }
}
