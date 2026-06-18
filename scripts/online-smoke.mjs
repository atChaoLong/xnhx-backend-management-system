#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const defaultBaseUrl = 'https://xiaoniuhaoxue.paitongai.cn'

const baseUrl = normalizeBaseUrl(
  readArg('--base-url') || process.env.XNHX_BASE_URL || defaultBaseUrl,
)
const alsoUrls = [
  ...readArgs('--also-url').map(normalizeBaseUrl),
  ...splitEnvList(process.env.XNHX_SMOKE_ALSO_URLS).map(normalizeBaseUrl),
].filter(Boolean)
const reportDir = readArg('--report-dir') || process.env.XNHX_QA_REPORT_DIR || '.gstack/qa-reports'
const timeoutMs = parsePositiveInt(
  readArg('--timeout-ms') || process.env.XNHX_SMOKE_TIMEOUT_MS,
  10_000,
)
const allowSecondaryFail = args.includes('--allow-secondary-fail')

const checks = [
  {
    key: 'health',
    label: 'Health endpoint',
    path: '/api/health',
    expectedStatus: 200,
    validate: ({ body }) => {
      if (body.json?.status === 'ok') return { pass: true, detail: 'status=ok' }
      return { pass: false, detail: 'health json status is not ok' }
    },
  },
  {
    key: 'login',
    label: 'Login page',
    path: '/login',
    expectedStatus: 200,
    validate: ({ body }) => {
      const text = body.text || ''
      if (text.includes('<html') || text.includes('登录') || text.includes('login')) {
        return { pass: true, detail: 'html rendered' }
      }
      return { pass: false, detail: 'login page body did not look like html' }
    },
  },
  {
    key: 'anonymous-auth-guard',
    label: 'Anonymous API guard',
    path: '/api/leads',
    expectedStatus: [401, 403],
    validate: () => ({ pass: true, detail: 'protected from anonymous access' }),
  },
  {
    key: 'public-dictionaries',
    label: 'Public dictionaries',
    path: '/api/teacher-form/dictionaries',
    expectedStatus: 200,
    validate: ({ body }) => {
      const json = body.json
      const hasData =
        Array.isArray(json?.data) ||
        (json?.data && typeof json.data === 'object') ||
        Array.isArray(json?.items) ||
        (json && typeof json === 'object' && Object.keys(json).length > 0)

      if (hasData) return { pass: true, detail: 'json data returned' }
      return { pass: false, detail: 'dictionary json payload was empty' }
    },
  },
]

function readArg(name) {
  const prefix = `${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function readArgs(name) {
  const prefix = `${name}=`
  return args.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length))
}

function splitEnvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeBaseUrl(value) {
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function redactText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[jwt-redacted]')
    .replace(/\bxnhx_(access|refresh)_token=[^;,\s`]+/gi, 'xnhx_$1_token=[redacted]')
    .replace(/"(access_token|refresh_token)"\s*:\s*"[^"]+"/gi, '"$1":"[redacted]"')
    .replace(/\b(authorization\s*:\s*bearer)\s+[A-Za-z0-9._-]{8,}/gi, '$1 [redacted]')
    .replace(/\b(password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s,;`]+/gi, '$1=[redacted]')
    .slice(0, 220)
}

function summarizeError(error) {
  const name = error?.cause?.name || error?.name || 'RequestError'
  const code = error?.cause?.code || error?.code
  const message = error?.cause?.message || error?.message || 'request failed'
  return [name, code, message].filter(Boolean).join(' | ').slice(0, 220)
}

async function parseBody(response) {
  const text = await response.text()
  try {
    return { text, json: text ? JSON.parse(text) : null }
  } catch {
    return { text, json: null }
  }
}

async function request(url) {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/html,*/*',
      },
    })
    clearTimeout(timer)
    return {
      response,
      body: await parseBody(response),
      durationMs: Date.now() - start,
      errorSummary: '',
    }
  } catch (error) {
    clearTimeout(timer)
    return {
      response: null,
      body: { text: '', json: null },
      durationMs: Date.now() - start,
      errorSummary: summarizeError(error),
    }
  }
}

function statusMatches(actual, expected) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected
}

function summarizeBody(body) {
  if (body.json && typeof body.json === 'object') {
    const { error, code, message, status } = body.json
    return [error, code, message, status].filter(Boolean).join(' | ').slice(0, 220)
  }
  return redactText(body.text)
}

async function runCheck(target, check) {
  const { response, body, durationMs, errorSummary } = await request(`${target.baseUrl}${check.path}`)
  const actualStatus = response?.status || 'ERROR'
  const expectedStatusPass = response ? statusMatches(actualStatus, check.expectedStatus) : false
  const validation = response ? check.validate({ response, body }) : { pass: false, detail: errorSummary }
  const pass = expectedStatusPass && validation.pass

  return {
    baseUrl: target.baseUrl,
    role: target.role,
    required: target.required,
    key: check.key,
    label: check.label,
    path: check.path,
    expectedStatus: check.expectedStatus,
    actualStatus,
    pass,
    durationMs,
    detail: validation.detail || summarizeBody(body) || errorSummary,
    sample: summarizeBody(body),
  }
}

async function main() {
  const targets = [
    { baseUrl, role: 'primary', required: true },
    ...alsoUrls.map((url) => ({
      baseUrl: url,
      role: 'secondary',
      required: !allowSecondaryFail,
    })),
  ]

  const results = []
  for (const target of targets) {
    for (const check of checks) {
      results.push(await runCheck(target, check))
    }
  }

  const requiredFailures = results.filter((result) => result.required && !result.pass)
  const secondaryWarnings = results.filter((result) => !result.required && !result.pass)
  const passed = results.filter((result) => result.pass)
  const status = requiredFailures.length === 0 ? 'pass' : 'fail'

  await mkdir(reportDir, { recursive: true })

  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    baseUrl,
    alsoUrls,
    allowSecondaryFail,
    timeoutMs,
    summary: {
      checks: results.length,
      passed: passed.length,
      failed: results.length - passed.length,
      requiredFailures: requiredFailures.length,
      secondaryWarnings: secondaryWarnings.length,
    },
    results,
  }

  const jsonPath = join(reportDir, `online-smoke-${today}.json`)
  const mdPath = join(reportDir, `online-smoke-${today}.md`)

  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`)
  await writeFile(mdPath, renderMarkdown(payload), 'utf8')

  const summary = `Online smoke ${status.toUpperCase()}. Passed ${passed.length}/${results.length}. Required failures: ${requiredFailures.length}. Warnings: ${secondaryWarnings.length}.`
  if (status === 'pass') {
    console.log(summary)
    console.log(`Report: ${mdPath}`)
    console.log(`JSON: ${jsonPath}`)
    return
  }

  console.error(summary)
  console.error(`Report: ${mdPath}`)
  console.error(`JSON: ${jsonPath}`)
  process.exit(1)
}

function renderMarkdown(payload) {
  const rows = payload.results.map((result) => [
    result.baseUrl,
    result.role,
    result.required ? 'yes' : 'no',
    result.label,
    result.pass ? 'PASS' : 'FAIL',
    result.actualStatus,
    `${result.durationMs}ms`,
    escapeCell(result.detail || result.sample || ''),
  ])

  return [
    `# Online Smoke - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Primary base URL: ${payload.baseUrl}`,
    `- Secondary URLs: ${payload.alsoUrls.length}`,
    `- Required failures: ${payload.summary.requiredFailures}`,
    `- Secondary warnings: ${payload.summary.secondaryWarnings}`,
    `- Timeout: ${payload.timeoutMs}ms`,
    '',
    '| Base URL | Role | Required | Check | Status | HTTP | Time | Detail |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
  ].join('\n')
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 220)
}

main()
