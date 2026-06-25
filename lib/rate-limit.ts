import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RateLimitRule {
  name: string
  limit: number
  windowMs: number
  methods?: HttpMethod[]
  paths?: string[]
  prefixes?: string[]
  scope: 'global' | 'path'
}

interface RateLimitBucket {
  count: number
  resetAt: number
}

export interface RateLimitDecision {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
  policy: string
}

const buckets = new Map<string, RateLimitBucket>()
let cleanupCounter = 0

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    name: 'auth-sensitive',
    limit: 12,
    windowMs: 60_000,
    methods: ['POST'],
    paths: ['/api/auth/signin', '/api/auth/signup', '/api/auth/refresh'],
    scope: 'global',
  },
  {
    name: 'upload',
    limit: 20,
    windowMs: 60_000,
    methods: ['POST'],
    paths: ['/api/upload'],
    scope: 'path',
  },
  {
    name: 'public-teacher-form',
    limit: 60,
    windowMs: 60_000,
    methods: ['GET', 'POST', 'PUT', 'PATCH'],
    prefixes: ['/api/teacher-form'],
    scope: 'path',
  },
  {
    name: 'classin-and-sync-mutation',
    limit: 40,
    windowMs: 60_000,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    prefixes: ['/api/classin', '/api/classin-sdk', '/api/sync', '/api/schedule/batch'],
    scope: 'global',
  },
  {
    name: 'api-mutation',
    limit: 120,
    windowMs: 60_000,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    prefixes: ['/api'],
    scope: 'global',
  },
  {
    name: 'api-read',
    limit: 300,
    windowMs: 60_000,
    methods: ['GET'],
    prefixes: ['/api'],
    scope: 'global',
  },
]

function matchesRule(rule: RateLimitRule, pathname: string, method: string): boolean {
  if (rule.methods && !rule.methods.includes(method as HttpMethod)) return false

  const matchesPath = rule.paths?.includes(pathname) ?? false
  const matchesPrefix = rule.prefixes?.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  )) ?? false

  return matchesPath || matchesPrefix
}

function getRule(pathname: string, method: string): RateLimitRule | null {
  return RATE_LIMIT_RULES.find((rule) => matchesRule(rule, pathname, method)) ?? null
}

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  const cfIp = request.headers.get('cf-connecting-ip')?.trim()
  const userAgent = request.headers.get('user-agent')?.slice(0, 120) ?? 'unknown-agent'

  return `${forwardedFor || realIp || cfIp || 'unknown-ip'}:${userAgent}`
}

function hashString(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

function getBucketKey(rule: RateLimitRule, request: NextRequest): string {
  const pathname = request.nextUrl.pathname
  const scope = rule.scope === 'path' ? `${request.method}:${pathname}` : request.method
  return `rate-limit:${rule.name}:${hashString(`${getClientIdentifier(request)}:${scope}`)}`
}

function cleanupExpiredBuckets(now: number) {
  cleanupCounter += 1
  if (cleanupCounter % 500 !== 0) return

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(request: NextRequest): RateLimitDecision | null {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return null
  }

  const rule = getRule(request.nextUrl.pathname, request.method)
  if (!rule) return null

  const now = Date.now()
  cleanupExpiredBuckets(now)

  const key = getBucketKey(rule, request)
  const existingBucket = buckets.get(key)
  const bucket = !existingBucket || existingBucket.resetAt <= now
    ? { count: 0, resetAt: now + rule.windowMs }
    : existingBucket

  bucket.count += 1
  buckets.set(key, bucket)

  const remaining = Math.max(rule.limit - bucket.count, 0)
  const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)

  return {
    allowed: bucket.count <= rule.limit,
    limit: rule.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds,
    policy: rule.name,
  }
}

export function applyRateLimitHeaders<T extends NextResponse>(
  response: T,
  decision: RateLimitDecision | null
): T {
  if (!decision) return response

  response.headers.set('X-RateLimit-Limit', String(decision.limit))
  response.headers.set('X-RateLimit-Remaining', String(decision.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)))
  response.headers.set('X-RateLimit-Policy', decision.policy)

  if (!decision.allowed) {
    response.headers.set('Retry-After', String(decision.retryAfterSeconds))
  }

  return response
}

export function createRateLimitResponse(decision: RateLimitDecision): NextResponse {
  return applyRateLimitHeaders(
    NextResponse.json(
      {
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMITED',
        retryAfter: decision.retryAfterSeconds,
      },
      { status: 429 }
    ),
    decision
  )
}
