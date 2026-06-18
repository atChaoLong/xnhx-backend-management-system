import { supabaseAdmin } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/safe-error'

type UploadArgs = {
  bucketName: string
  filePath: string
  fileBuffer: Buffer
  contentType: string
}

type SignedUploadArgs = {
  bucketName: string
  filePath: string
}

type StorageErrorLike = {
  message?: string
  status?: number
  statusCode?: string | number
}

function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate))
}

function getStorageErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null

  const errorLike = error as StorageErrorLike
  const status = errorLike.status ?? errorLike.statusCode
  const parsedStatus = typeof status === 'string' ? Number.parseInt(status, 10) : status

  return Number.isFinite(parsedStatus) ? parsedStatus : null
}

function isAlreadyExistsError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  const status = getStorageErrorStatus(error)

  return status === 409 || includesAny(message, ['already exists', 'duplicate'])
}

export function isBucketMissingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  const status = getStorageErrorStatus(error)

  return status === 404 && (
    message.includes('bucket') ||
    includesAny(message, ['the resource was not found', 'not found'])
  )
}

export function isBucketProvisionError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()

  return isBucketMissingError(error) || (
    message.includes('bucket') &&
    includesAny(message, ['create', 'already exists', 'duplicate', 'does not exist'])
  )
}

async function createPublicBucket(bucketName: string) {
  const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
    public: true,
  })

  if (error && !isAlreadyExistsError(error)) {
    return { error }
  }

  return { error: null }
}

export async function uploadToPublicBucketWithEnsure({
  bucketName,
  filePath,
  fileBuffer,
  contentType,
}: UploadArgs) {
  const firstAttempt = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    })

  if (!firstAttempt.error) {
    return firstAttempt
  }

  if (!isBucketMissingError(firstAttempt.error)) {
    return firstAttempt
  }

  const createResult = await createPublicBucket(bucketName)
  if (createResult.error) {
    return {
      data: null,
      error: createResult.error,
    }
  }

  return supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    })
}

export async function createSignedUploadUrlWithEnsure({
  bucketName,
  filePath,
}: SignedUploadArgs) {
  const firstAttempt = await supabaseAdmin.storage
    .from(bucketName)
    .createSignedUploadUrl(filePath)

  if (!firstAttempt.error) {
    return firstAttempt
  }

  if (!isBucketMissingError(firstAttempt.error)) {
    return firstAttempt
  }

  const createResult = await createPublicBucket(bucketName)
  if (createResult.error) {
    return {
      data: null,
      error: createResult.error,
    }
  }

  return supabaseAdmin.storage
    .from(bucketName)
    .createSignedUploadUrl(filePath)
}
