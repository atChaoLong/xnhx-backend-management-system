#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const middlewarePath = resolve(root, 'middleware.ts')
const rateLimitPath = resolve(root, 'lib/rate-limit.ts')
const packageJsonPath = resolve(root, 'package.json')

const failures = []

function readRequiredFile(path) {
  if (!existsSync(path)) {
    failures.push(`Missing file: ${path}`)
    return ''
  }

  return readFileSync(path, 'utf8')
}

const middleware = readRequiredFile(middlewarePath)
const rateLimit = readRequiredFile(rateLimitPath)
const packageJson = readRequiredFile(packageJsonPath)

if (!middleware.includes("from '@/lib/rate-limit'")) {
  failures.push('middleware.ts does not import the rate limit module')
}

const checkIndex = middleware.indexOf('checkRateLimit(request)')
const publicPathIndex = middleware.indexOf('isPublicPath(pathname)')

if (checkIndex === -1) {
  failures.push('middleware.ts does not call checkRateLimit(request)')
}

if (publicPathIndex === -1) {
  failures.push('middleware.ts does not call isPublicPath(pathname)')
}

if (checkIndex !== -1 && publicPathIndex !== -1 && checkIndex > publicPathIndex) {
  failures.push('Rate limit check must run before public path bypass')
}

const requiredPolicies = [
  'auth-sensitive',
  'upload',
  'public-teacher-form-write',
  'classin-and-sync-mutation',
  'api-mutation',
  'api-read',
]

for (const policy of requiredPolicies) {
  if (!rateLimit.includes(`name: '${policy}'`)) {
    failures.push(`Missing rate limit policy: ${policy}`)
  }
}

const requiredPathsOrPrefixes = [
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/upload',
  '/api/teacher-form/upload',
  '/api/teacher-form',
  '/api/classin',
  '/api/classin-sdk',
  '/api/sync',
  '/api/schedule/batch',
]

for (const pathOrPrefix of requiredPathsOrPrefixes) {
  if (!rateLimit.includes(`'${pathOrPrefix}'`)) {
    failures.push(`Missing rate limit path/prefix: ${pathOrPrefix}`)
  }
}

if (!packageJson.includes('"audit:rate-limit"')) {
  failures.push('package.json is missing audit:rate-limit script')
}

if (failures.length > 0) {
  console.error('Rate limit audit failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Rate limit audit passed.')
console.log(`Policies checked: ${requiredPolicies.length}`)
