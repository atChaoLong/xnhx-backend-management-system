function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function summarizeError(error: unknown) {
  const errorRecord: Record<string, unknown> = isRecord(error) ? error : {}
  const message = error instanceof Error ? error.message : normalizeString(errorRecord.message)
  const stack = error instanceof Error ? error.stack : normalizeString(errorRecord.stack)
  const status = typeof errorRecord.status === 'number'
    ? errorRecord.status
    : typeof errorRecord.statusCode === 'number'
    ? errorRecord.statusCode
    : undefined

  return {
    name: error instanceof Error ? error.name : normalizeString(errorRecord.name),
    message,
    code: normalizeString(errorRecord.code),
    status,
    has_message: Boolean(message),
    has_stack: Boolean(stack),
  }
}

export function getErrorMessage(error: unknown): string {
  const errorRecord: Record<string, unknown> = isRecord(error) ? error : {}
  const message = error instanceof Error ? error.message : normalizeString(errorRecord.message)

  return message || ''
}

export function getDisplayErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error)
  if (message) return message

  return fallback
}

export function getClientSafeErrorMessage(
  error: unknown,
  fallback: string,
  allowedMessages: readonly string[] = []
): string {
  const message = getErrorMessage(error)
  if (!message) return fallback

  return allowedMessages.includes(message) ? message : fallback
}

export function createSafeErrorResponse(error: unknown, fallback: string, status = 500) {
  return {
    log: summarizeError(error),
    response: {
      error: fallback,
    },
    status,
  }
}
