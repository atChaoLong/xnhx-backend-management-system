#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL = (process.env.XNHX_BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn').replace(/\/$/, '')
const REPORT_DIR = process.env.XNHX_QA_REPORT_DIR || '.gstack/qa-reports'
const STAMP = process.env.XNHX_REPORT_STAMP || new Date().toISOString().slice(0, 10)
const REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.XNHX_ONLINE_REQUEST_TIMEOUT_MS, 60_000)
const REQUEST_RETRIES = parseNonNegativeInt(process.env.XNHX_ONLINE_REQUEST_RETRIES, 0)
const RETRY_DELAY_MS = parseNonNegativeInt(process.env.XNHX_ONLINE_RETRY_DELAY_MS, 1_000)

const accounts = [
  {
    key: 'operator',
    label: '运营',
    username: process.env.XNHX_OPERATOR_USER || 'yy001',
    password: process.env.XNHX_OPERATOR_PASSWORD,
    expectedRole: 'operator',
  },
  {
    key: 'sales',
    label: '销售',
    username: process.env.XNHX_SALES_USER || 'xs001',
    password: process.env.XNHX_SALES_PASSWORD,
    expectedRole: 'sales',
  },
  {
    key: 'head_teacher',
    label: '班主任',
    username: process.env.XNHX_HEAD_TEACHER_USER || 'bzr001',
    password: process.env.XNHX_HEAD_TEACHER_PASSWORD,
    expectedRole: 'head_teacher',
  },
  {
    key: 'academic_affairs',
    label: '教务',
    username: process.env.XNHX_ACADEMIC_AFFAIRS_USER || 'jw001',
    password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD,
    expectedRole: 'academic_affairs',
  },
  {
    key: 'admin',
    label: '管理员',
    username: process.env.XNHX_ADMIN_USER || 'admin',
    password: process.env.XNHX_ADMIN_PASSWORD,
    expectedRole: 'admin',
  },
]

const missing = accounts.filter((account) => !account.password)
if (missing.length > 0) {
  console.error(`Missing password env vars for: ${missing.map((account) => account.key).join(', ')}`)
  console.error('Required: XNHX_OPERATOR_PASSWORD, XNHX_SALES_PASSWORD, XNHX_HEAD_TEACHER_PASSWORD, XNHX_ACADEMIC_AFFAIRS_PASSWORD, XNHX_ADMIN_PASSWORD')
  process.exit(2)
}

const results = []
const sessions = new Map()

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function redactText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/g, '"refresh_token":"[redacted]"')
    .replace(/xnhx_(access|refresh)_token=[^;,\s]+/g, 'xnhx_$1_token=[redacted]')
    .slice(0, 220)
}

function summarizeBody(body) {
  if (!body) return ''
  if (body.json && typeof body.json === 'object') {
    const { error, code, message, hint } = body.json
    return [error, code, message, hint].filter(Boolean).join(' | ').slice(0, 220)
  }
  return redactText(body.text)
}

function summarizeRequestError(error) {
  const code = error?.cause?.code || error?.code
  const name = error?.cause?.name || error?.name || 'RequestError'
  const message = error?.cause?.message || error?.message || 'request failed'
  return [name, code, message].filter(Boolean).join(' | ').slice(0, 220)
}

function extractCookieHeader(response) {
  const cookieLines =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean)

  const pairs = []
  for (const line of cookieLines) {
    const matches = line.matchAll(/(xnhx_(?:access|refresh)_token)=[^;,\s]+/g)
    for (const match of matches) {
      pairs.push(match[0])
    }
  }

  return [...new Set(pairs)].join('; ')
}

async function parseBody(response) {
  const text = await response.text()
  try {
    return { text, json: text ? JSON.parse(text) : null }
  } catch {
    return { text, json: null }
  }
}

async function request(path, options = {}) {
  const start = Date.now()
  let lastError

  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        redirect: options.redirect || 'manual',
        ...options,
        signal: controller.signal,
        headers: {
          accept: 'application/json,text/html,*/*',
          ...(options.headers || {}),
        },
      })
      clearTimeout(timer)
      const body = await parseBody(response)
      return {
        response,
        body,
        durationMs: Date.now() - start,
        attempts: attempt + 1,
      }
    } catch (error) {
      clearTimeout(timer)
      lastError = error
      if (attempt < REQUEST_RETRIES) {
        await wait(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }

  return {
    response: null,
    body: { text: '', json: null },
    durationMs: Date.now() - start,
    attempts: REQUEST_RETRIES + 1,
    errorSummary: summarizeRequestError(lastError),
  }
}

function expectedStatusMatches(actual, expected) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected
}

function itemCount(json) {
  if (!json || typeof json !== 'object') return undefined
  if (Array.isArray(json)) return json.length
  if (Array.isArray(json.data)) return json.data.length
  if (Array.isArray(json.items)) return json.items.length
  if (Array.isArray(json.records)) return json.records.length
  if (json.data && typeof json.data === 'object') {
    if (Array.isArray(json.data.items)) return json.data.items.length
    if (Array.isArray(json.data.records)) return json.data.records.length
    if (Array.isArray(json.data.users)) return json.data.users.length
    if (Array.isArray(json.data.reports)) return json.data.reports.length
  }
  return undefined
}

function addResult(result) {
  results.push({
    group: result.group,
    role: result.role || '',
    path: result.path,
    expected: result.expected,
    actual: result.actual,
    pass: Boolean(result.pass),
    durationMs: result.durationMs,
    attempts: result.attempts,
    count: result.count,
    summary: result.summary || '',
  })
}

async function checkStatus({ group, role, path, expected, headers, method = 'GET', body, validate }) {
  const { response, body: parsedBody, durationMs, attempts, errorSummary } = await request(path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const actual = response ? response.status : 'ERROR'
  const basePass = response ? expectedStatusMatches(actual, expected) : false
  const validation = response && validate ? validate({ response, body: parsedBody }) : { pass: Boolean(response) }
  const pass = basePass && validation.pass

  addResult({
    group,
    role,
    path,
    expected: Array.isArray(expected) ? expected.join('/') : String(expected),
    actual,
    pass,
    durationMs,
    attempts,
    count: itemCount(parsedBody.json),
    summary: errorSummary || validation.summary || summarizeBody(parsedBody),
  })

  return { response, body: parsedBody, durationMs, pass }
}

async function runPublicChecks() {
  await checkStatus({
    group: 'phase-a',
    path: '/api/health',
    expected: 200,
    validate: ({ response, body }) => ({
      pass: body.json?.status === 'ok' && response.headers.get('x-ratelimit-policy') === 'api-read',
      summary: `status=${body.json?.status || 'unknown'}; rateLimit=${response.headers.get('x-ratelimit-policy') || 'missing'}`,
    }),
  })

  await checkStatus({
    group: 'phase-b',
    path: '/',
    expected: 200,
  })
  await checkStatus({
    group: 'phase-b',
    path: '/login',
    expected: 200,
  })
  await checkStatus({
    group: 'phase-b',
    path: '/teacher-form',
    expected: 200,
  })
  await checkStatus({
    group: 'phase-b',
    path: '/api/teacher-form/dictionaries',
    expected: 200,
  })
  await checkStatus({
    group: 'phase-b',
    path: '/api/auth/session',
    expected: 401,
  })
  await checkStatus({
    group: 'phase-b',
    path: '/api/quality-reports',
    expected: 401,
  })
  await checkStatus({
    group: 'phase-b',
    path: '/api/auth/signin',
    method: 'POST',
    body: {},
    expected: 400,
    validate: ({ response, body }) => ({
      pass: response.headers.get('x-ratelimit-policy') === 'auth-sensitive' && !redactText(JSON.stringify(body.json || body.text)).includes('PROFILE_LOOKUP_FAILED'),
      summary: `rateLimit=${response.headers.get('x-ratelimit-policy') || 'missing'}; ${summarizeBody(body)}`,
    }),
  })
}

async function signIn(account) {
  const { response, body, durationMs, attempts, errorSummary } = await request('/api/auth/signin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.username, password: account.password }),
  })
  const cookie = response ? extractCookieHeader(response) : ''
  const hasAuthCookies = cookie.includes('xnhx_access_token=') && cookie.includes('xnhx_refresh_token=')
  const pass = response?.status === 200 && hasAuthCookies && !summarizeBody(body).includes('PROFILE_LOOKUP_FAILED')

  addResult({
    group: 'auth',
    role: account.key,
    path: '/api/auth/signin',
    expected: '200 + auth cookies',
    actual: response?.status || 'ERROR',
    pass,
    durationMs,
    attempts,
    summary: errorSummary || (hasAuthCookies ? 'auth cookies present' : summarizeBody(body)),
  })

  if (pass) {
    sessions.set(account.key, { cookie, account })
  }
}

async function runAuthChecks() {
  for (const account of accounts) {
    await signIn(account)
  }

  for (const { account, cookie } of sessions.values()) {
    const authHeaders = { cookie }
    await checkStatus({
      group: 'auth',
      role: account.key,
      path: '/api/auth/session',
      expected: 200,
      headers: authHeaders,
      validate: ({ body }) => {
        const role = body.json?.data?.user?.role
        return {
          pass: role === account.expectedRole,
          summary: `role=${role || 'missing'}`,
        }
      },
    })

    await checkStatus({
      group: 'auth',
      role: account.key,
      path: '/dashboard',
      expected: 200,
      headers: authHeaders,
    })
    await checkStatus({
      group: 'auth',
      role: account.key,
      path: '/dashboard/leads',
      expected: 200,
      headers: authHeaders,
    })
  }
}

function expectedFor(account, path) {
  const role = account.key
  const staffExceptAcademic = ['operator', 'sales', 'head_teacher', 'admin']
  const teacherFlowRoles = ['academic_affairs', 'admin']

  if (path === '/api/quality-reports') return 200
  if (path === '/api/leads') return staffExceptAcademic.includes(role) ? 200 : 403
  if (path === '/api/public-leads') return (role === 'sales' || role === 'admin') ? 200 : 403
  if (path === '/api/teacher-candidates') return teacherFlowRoles.includes(role) ? 200 : 403
  if (path === '/api/teacher-candidates/recruitment-flow') return teacherFlowRoles.includes(role) ? 200 : 403
  if (path === '/api/users') return role === 'admin' ? 200 : 403
  return 200
}

async function runBlockingApiMatrix() {
  const paths = [
    '/api/quality-reports',
    '/api/leads',
    '/api/public-leads',
    '/api/teacher-candidates',
    '/api/teacher-candidates/recruitment-flow',
    '/api/users',
  ]

  for (const { account, cookie } of sessions.values()) {
    for (const path of paths) {
      await checkStatus({
        group: 'p0-p1-api',
        role: account.key,
        path,
        expected: expectedFor(account, path),
        headers: { cookie },
      })
    }
  }
}

async function runAdminDeepLinks() {
  const admin = sessions.get('admin')
  if (!admin) return

  const paths = [
    '/dashboard/leads',
    '/dashboard/public-leads',
    '/dashboard/trial-lessons',
    '/dashboard/students',
    '/dashboard/teacher-candidates',
    '/dashboard/accounts',
    '/dashboard/quality/service',
  ]

  for (const path of paths) {
    await checkStatus({
      group: 'admin-deeplink',
      role: 'admin',
      path,
      expected: 200,
      headers: { cookie: admin.cookie },
      validate: ({ body }) => ({
        pass: !body.text.includes('/login') && !body.text.includes('未登录或登录已过期'),
        summary: body.text.includes('/login') ? 'possible login redirect marker found' : '',
      }),
    })
  }
}

function markdownReport(summary) {
  const rows = results
    .map((result) => {
      return `| ${result.group} | ${result.role || '-'} | \`${result.path}\` | ${result.expected} | ${result.actual} | ${result.pass ? 'PASS' : 'FAIL'} | ${result.durationMs} | ${result.attempts ?? ''} | ${result.count ?? ''} | ${String(result.summary || '').replace(/\|/g, '/')} |`
    })
    .join('\n')

  const failures = results.filter((result) => !result.pass)
  const failureRows =
    failures.length === 0
      ? '- 无'
      : failures
          .map((result) => `- ${result.group} ${result.role || '-'} \`${result.path}\`: expected ${result.expected}, got ${result.actual}; ${result.summary || 'no summary'}`)
          .join('\n')

  return `# Online Release Regression - ${STAMP}

Base: ${BASE_URL}
Started: ${summary.startedAt}
Finished: ${summary.finishedAt}

## Summary

- Total checks: ${summary.total}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Request timeout: ${REQUEST_TIMEOUT_MS}ms
- Request retries: ${REQUEST_RETRIES}
- Accounts tested: ${accounts.map((account) => `${account.label}/${account.username}`).join(', ')}
- Secrets: passwords, cookies and tokens are not written to this report.

## Failures

${failureRows}

## Checks

| Group | Role | Path | Expected | Actual | Result | ms | Attempts | Count | Summary |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |
${rows}

## Remaining Manual Gates

- Supabase production RLS must still be verified table by table with direct low-privilege access attempts.
- Destructive/write business flows are intentionally not run by this script: lead creation/editing, trial lesson creation/status changes, student scheduling, financial records, and teacher recruitment state changes need dedicated test data.
- ClassIn real write flows and callbacks still need approved test ClassIn resources before release sign-off.
`
}

async function main() {
  const startedAt = new Date().toISOString()
  await runPublicChecks()
  await runAuthChecks()
  await runBlockingApiMatrix()
  await runAdminDeepLinks()

  const finishedAt = new Date().toISOString()
  const summary = {
    baseUrl: BASE_URL,
    startedAt,
    finishedAt,
    total: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    requestRetries: REQUEST_RETRIES,
  }

  await mkdir(REPORT_DIR, { recursive: true })
  const jsonPath = join(REPORT_DIR, `online-release-regression-${STAMP}.json`)
  const mdPath = join(REPORT_DIR, `online-release-regression-${STAMP}.md`)
  await writeFile(jsonPath, JSON.stringify({ summary, results }, null, 2))
  await writeFile(mdPath, markdownReport(summary))

  console.log(`Online release regression: ${summary.passed}/${summary.total} passed`)
  console.log(`JSON: ${jsonPath}`)
  console.log(`MD: ${mdPath}`)

  if (summary.failed > 0) {
    for (const result of results.filter((item) => !item.pass)) {
      console.error(`FAIL ${result.group} ${result.role || '-'} ${result.path}: expected ${result.expected}, got ${result.actual}; ${result.summary}`)
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
