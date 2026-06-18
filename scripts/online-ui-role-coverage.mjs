#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const BASE_URL = (process.env.XNHX_BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn').replace(/\/$/, '')
const REPORT_DIR = process.env.XNHX_QA_REPORT_DIR || '.gstack/qa-reports'
const STAMP = process.env.XNHX_REPORT_STAMP || new Date().toISOString().slice(0, 10)
const HEADLESS = process.env.XNHX_UI_HEADLESS !== '0'
const BROWSER_CHANNEL = process.env.XNHX_BROWSER_CHANNEL || 'chrome'
const CHROME_PATH = process.env.XNHX_CHROME_PATH || detectChromePath()
const ROLE_FILTER = new Set((process.env.XNHX_UI_ROLES || '').split(',').map((role) => role.trim()).filter(Boolean))
const NAV_TIMEOUT_MS = parsePositiveInt(process.env.XNHX_UI_NAV_TIMEOUT_MS, 45_000)
const STEP_TIMEOUT_MS = parsePositiveInt(process.env.XNHX_UI_STEP_TIMEOUT_MS, 12_000)

const allAccounts = [
  {
    key: 'operator',
    label: '运营',
    username: process.env.XNHX_OPERATOR_USER || 'yy001',
    password: process.env.XNHX_OPERATOR_PASSWORD,
    passwordEnv: 'XNHX_OPERATOR_PASSWORD',
    expectedRole: 'operator',
    allowedRoutes: ['/dashboard', '/dashboard/leads', '/dashboard/todos'],
    deniedRoutes: ['/dashboard/public-leads', '/dashboard/trial-lessons', '/dashboard/students', '/dashboard/schedule/batch', '/dashboard/accounts'],
    hiddenSidebarTexts: ['公共线索池', '试听课', '学生管理', '排课管理', '用户管理'],
    forbiddenActionTexts: ['删除', '转正式', '续费', '扩科'],
  },
  {
    key: 'sales',
    label: '销售',
    username: process.env.XNHX_SALES_USER || 'xs001',
    password: process.env.XNHX_SALES_PASSWORD,
    passwordEnv: 'XNHX_SALES_PASSWORD',
    expectedRole: 'sales',
    allowedRoutes: ['/dashboard', '/dashboard/leads', '/dashboard/public-leads', '/dashboard/trial-lessons', '/dashboard/formal-orders', '/dashboard/todos'],
    deniedRoutes: ['/dashboard/students', '/dashboard/schedule/batch', '/dashboard/accounts'],
    hiddenSidebarTexts: ['学生管理', '排课管理', '用户管理'],
    forbiddenActionTexts: ['删除'],
  },
  {
    key: 'head_teacher',
    label: '班主任',
    username: process.env.XNHX_HEAD_TEACHER_USER || 'bzr001',
    password: process.env.XNHX_HEAD_TEACHER_PASSWORD,
    passwordEnv: 'XNHX_HEAD_TEACHER_PASSWORD',
    expectedRole: 'head_teacher',
    allowedRoutes: ['/dashboard', '/dashboard/leads', '/dashboard/trial-lessons', '/dashboard/students', '/dashboard/formal-students', '/dashboard/schedule/batch', '/dashboard/todos'],
    deniedRoutes: ['/dashboard/public-leads', '/dashboard/accounts'],
    hiddenSidebarTexts: ['公共线索池', '用户管理'],
    forbiddenActionTexts: ['删除', '新建任务'],
  },
  {
    key: 'academic_affairs',
    label: '教务',
    username: process.env.XNHX_ACADEMIC_AFFAIRS_USER || 'jw001',
    password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD,
    passwordEnv: 'XNHX_ACADEMIC_AFFAIRS_PASSWORD',
    expectedRole: 'academic_affairs',
    allowedRoutes: ['/dashboard', '/dashboard/trial-lessons', '/dashboard/academic/pending-trials', '/dashboard/students', '/dashboard/academic/students', '/dashboard/formal-students', '/dashboard/schedule/batch', '/dashboard/todos'],
    deniedRoutes: ['/dashboard/leads', '/dashboard/public-leads', '/dashboard/accounts'],
    hiddenSidebarTexts: ['线索跟进', '公共线索池', '用户管理'],
    forbiddenActionTexts: ['删除'],
  },
  {
    key: 'teacher_recruiter',
    label: '招师',
    username: process.env.XNHX_TEACHER_RECRUITER_USER || 'zs001',
    password: process.env.XNHX_TEACHER_RECRUITER_PASSWORD,
    passwordEnv: 'XNHX_TEACHER_RECRUITER_PASSWORD',
    optional: true,
    expectedRole: 'teacher_recruiter',
    allowedRoutes: [
      '/dashboard',
      '/dashboard/teacher-candidates',
      '/dashboard/teacher-candidates/interview',
      '/dashboard/teacher-candidates/upload',
      '/dashboard/teacher-candidates/reserve',
    ],
    deniedRoutes: [
      '/dashboard/leads',
      '/dashboard/public-leads',
      '/dashboard/trial-lessons',
      '/dashboard/formal-orders',
      '/dashboard/students',
      '/dashboard/formal-students',
      '/dashboard/schedule/batch',
      '/dashboard/accounts',
      '/dashboard/teacher-candidates/review',
      '/dashboard/teacher-candidates/pending',
      '/dashboard/teachers',
    ],
    requiredSidebarTexts: ['面试管理'],
    hiddenSidebarTexts: ['线索跟进', '公共线索池', '试听课', '正式课', '学生管理', '排课管理', '用户管理', '老师约面', '初试录像上传', '教学复核', '待入库老师', '老师库存管理'],
    forbiddenActionTexts: ['删除', '教学复核', '入库确认'],
  },
  {
    key: 'admin',
    label: '管理员',
    username: process.env.XNHX_ADMIN_USER || 'admin',
    password: process.env.XNHX_ADMIN_PASSWORD,
    passwordEnv: 'XNHX_ADMIN_PASSWORD',
    expectedRole: 'admin',
    allowedRoutes: ['/dashboard', '/dashboard/leads', '/dashboard/trial-lessons', '/dashboard/formal-orders', '/dashboard/students', '/dashboard/schedule/batch', '/dashboard/todos', '/dashboard/accounts'],
    deniedRoutes: ['/dashboard/public-leads'],
    hiddenSidebarTexts: ['公共线索池'],
    forbiddenActionTexts: [],
  },
]

const accounts = ROLE_FILTER.size > 0
  ? allAccounts.filter((account) => ROLE_FILTER.has(account.key))
  : allAccounts.filter((account) => !account.optional || account.password)

if (accounts.length === 0) {
  console.error(`No accounts selected. XNHX_UI_ROLES can include: ${allAccounts.map((account) => account.key).join(', ')}`)
  process.exit(2)
}

const missing = accounts.filter((account) => !account.password)
if (missing.length > 0) {
  console.error(`Missing password env vars for: ${missing.map((account) => account.key).join(', ')}`)
  console.error(`Required for selected roles: ${missing.map((account) => account.passwordEnv).filter(Boolean).join(', ')}`)
  process.exit(2)
}

const suiteId = `UI-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
const startedAt = new Date().toISOString()
const results = []

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function detectChromePath() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function addResult(result) {
  results.push({
    group: result.group,
    role: result.role || '',
    target: result.target || '',
    expected: result.expected || '',
    actual: result.actual || '',
    pass: Boolean(result.pass),
    severity: result.pass ? '' : result.severity || 'P1',
    summary: result.summary || '',
  })
}

function summarizePageErrors(pageState) {
  const failed = pageState.responses.filter((item) => item.status >= 400)
  const consoleErrors = pageState.console.filter((item) => item.type === 'error')
  return {
    failed,
    consoleErrors,
    summary: [
      failed.length ? `HTTP ${failed.map((item) => `${item.status} ${item.url}`).slice(0, 4).join('; ')}` : '',
      consoleErrors.length ? `console ${consoleErrors.map((item) => item.text).slice(0, 2).join('; ')}` : '',
    ].filter(Boolean).join(' | '),
  }
}

function routeLabel(path) {
  return `${BASE_URL}${path}`
}

async function getVisibleTexts(page, selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const style = window.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  )
}

async function safeWait(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT_MS }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT_MS }).catch(() => undefined)
}

async function login(page, account) {
  const response = await page.request.post(`${BASE_URL}/api/auth/signin`, {
    data: {
      email: account.username,
      password: account.password,
    },
  })
  if (!response.ok()) {
    const text = await response.text().catch(() => '')
    throw new Error(`signin failed for ${account.key}: ${response.status()} ${text.slice(0, 160)}`)
  }

  const body = await response.json().catch(() => null)
  const session = body?.data || {}
  if (session.access_token) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await page.evaluate((storedSession) => {
      window.localStorage.setItem('supabase.auth.session', JSON.stringify(storedSession))
      window.localStorage.setItem('supabase.auth.token', storedSession.access_token)
      window.sessionStorage.removeItem('currentUser')
      window.localStorage.removeItem('user')
    }, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user?.id ? { id: session.user.id } : null,
    })
  }

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
  await safeWait(page)
}

async function assertLogin(page, account) {
  const url = page.url()
  const profileResponse = await page.evaluate(async () => {
    const response = await fetch('/api/auth/profile', { credentials: 'same-origin' })
    let body = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { status: response.status, body }
  })
  const role = profileResponse.body?.data?.role || profileResponse.body?.role || ''
  addResult({
    group: 'login',
    role: account.key,
    target: '/login',
    expected: `dashboard + ${account.expectedRole}`,
    actual: `${url} + ${role || `profile ${profileResponse.status}`}`,
    pass: url.includes('/dashboard') && profileResponse.status === 200 && role === account.expectedRole,
    severity: 'P0',
    summary: account.label,
  })
}

async function expandSidebar(page) {
  const groupButtons = page.locator('aside button, nav button').filter({ hasText: /控制台|客户管理|订单管理|教务管理|待办事项|系统管理|质检系统|招师管理/ })
  const count = await groupButtons.count().catch(() => 0)
  for (let i = 0; i < count; i += 1) {
    const button = groupButtons.nth(i)
    await button.click({ timeout: 2_000 }).catch(() => undefined)
  }
}

async function collectSidebar(page, account) {
  await expandSidebar(page)
  const links = await getVisibleTexts(page, 'nav a')
  const sidebarText = normalizeText(links.join(' | '))
  const hiddenHits = account.hiddenSidebarTexts.filter((text) => sidebarText.includes(text))
  const missingRequired = (account.requiredSidebarTexts || []).filter((text) => !sidebarText.includes(text))

  addResult({
    group: 'sidebar',
    role: account.key,
    target: '/dashboard',
    expected: [
      account.requiredSidebarTexts?.length ? `show ${account.requiredSidebarTexts.join(', ')}` : '',
      account.hiddenSidebarTexts.length ? `hide ${account.hiddenSidebarTexts.join(', ')}` : '',
    ].filter(Boolean).join('; ') || 'no sidebar requirement',
    actual: sidebarText,
    pass: hiddenHits.length === 0 && missingRequired.length === 0,
    severity: 'P1',
    summary: [
      missingRequired.length ? `应显示但缺失：${missingRequired.join(', ')}` : '',
      hiddenHits.length ? `不应显示：${hiddenHits.join(', ')}` : '',
    ].filter(Boolean).join('；') || `visible=${links.join(', ')}`,
  })
}

async function visitRoute(page, account, path, expectedAccess) {
  const pageState = { responses: [], console: [] }
  const onResponse = (response) => {
    const url = response.url()
    if (!url.startsWith(BASE_URL)) return
    if (url.includes('/_next/static/')) return
    pageState.responses.push({ status: response.status(), url: url.replace(BASE_URL, '') })
  }
  const onConsole = (message) => {
    pageState.console.push({ type: message.type(), text: normalizeText(message.text()).slice(0, 240) })
  }
  page.on('response', onResponse)
  page.on('console', onConsole)

  try {
    await page.goto(routeLabel(path), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await safeWait(page)
    const url = page.url()
    const bodyText = normalizeText(await page.locator('body').innerText({ timeout: STEP_TIMEOUT_MS }).catch(() => ''))
    const pageErrors = summarizePageErrors(pageState)
    const hasAuthBlock = /权限不足|PERMISSION_DENIED|Unauthorized|未授权|无法访问/.test(bodyText)
    const redirectedToLogin = url.includes('/login')
    const serverError = pageState.responses.some((item) => item.status >= 500)
    const authError = pageState.responses.some((item) => item.status === 401 || item.status === 403)

    if (expectedAccess) {
      const buttons = await getVisibleTexts(page, 'button, a[role="button"], a[href]')
      const forbiddenHits = account.forbiddenActionTexts.filter((text) => buttons.some((button) => button.includes(text)))
      addResult({
        group: 'route-access',
        role: account.key,
        target: path,
        expected: 'accessible',
        actual: `${url}; ${bodyText.slice(0, 100)}`,
        pass: !redirectedToLogin && !hasAuthBlock && !serverError && !authError,
        severity: serverError || authError ? 'P0' : 'P1',
        summary: pageErrors.summary,
      })
      addResult({
        group: 'action-visibility',
        role: account.key,
        target: path,
        expected: account.forbiddenActionTexts.length ? `hide ${account.forbiddenActionTexts.join(', ')}` : 'no forbidden action requirement',
        actual: buttons.slice(0, 30).join(' | '),
        pass: forbiddenHits.length === 0,
        severity: 'P1',
        summary: forbiddenHits.length ? `不应显示操作：${forbiddenHits.join(', ')}` : '',
      })
    } else {
      addResult({
        group: 'route-access',
        role: account.key,
        target: path,
        expected: 'blocked',
        actual: `${url}; ${bodyText.slice(0, 100)}`,
        pass: redirectedToLogin || hasAuthBlock || authError,
        severity: 'P1',
        summary: pageErrors.summary || 'direct route should be blocked or show permission notice',
      })
    }
  } catch (error) {
    addResult({
      group: 'route-access',
      role: account.key,
      target: path,
      expected: expectedAccess ? 'accessible' : 'blocked',
      actual: 'ERROR',
      pass: false,
      severity: expectedAccess ? 'P0' : 'P1',
      summary: error instanceof Error ? error.message : String(error),
    })
  } finally {
    page.off('response', onResponse)
    page.off('console', onConsole)
  }
}

async function checkLogout(page, account) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
  await safeWait(page)
  await page.getByRole('button', { name: /退出登录/ }).click({ timeout: STEP_TIMEOUT_MS })
  await page.waitForURL(/\/login(?:\?.*)?$/, { timeout: NAV_TIMEOUT_MS }).catch(() => undefined)
  const sessionStatusAfterClick = await waitForSessionToClear(page)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }).catch(() => undefined)
  await page.waitForTimeout(1_000)
  const url = page.url()
  const sessionStatus = sessionStatusAfterClick === 200
    ? await getSessionStatus(page)
    : sessionStatusAfterClick

  addResult({
    group: 'logout',
    role: account.key,
    target: '/dashboard',
    expected: 'stay on /login and session not 200',
    actual: `${url}; session=${sessionStatus}`,
    pass: url.includes('/login') && sessionStatus !== 200,
    severity: 'P0',
    summary: account.label,
  })
}

async function getSessionStatus(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin' })
    return response.status
  }).catch(() => 'ERROR')
}

async function waitForSessionToClear(page) {
  const deadline = Date.now() + Math.min(NAV_TIMEOUT_MS, 12_000)
  let lastStatus = await getSessionStatus(page)

  while (lastStatus === 200 && Date.now() < deadline) {
    await page.waitForTimeout(500)
    lastStatus = await getSessionStatus(page)
  }

  return lastStatus
}

async function run() {
  const playwright = await loadPlaywright()
  const browserLaunchOptions = {
    headless: HEADLESS,
    args: [
      '--disable-background-networking',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
    ],
  }
  if (CHROME_PATH) {
    browserLaunchOptions.executablePath = CHROME_PATH
  } else if (BROWSER_CHANNEL !== 'bundled') {
    browserLaunchOptions.channel = BROWSER_CHANNEL
  }

  const browser = await playwright.chromium.launch(browserLaunchOptions)
  try {
    for (const account of accounts) {
      const context = await browser.newContext({
        baseURL: BASE_URL,
        viewport: { width: 1440, height: 1000 },
      })
      const page = await context.newPage()
      page.setDefaultTimeout(STEP_TIMEOUT_MS)
      page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS)

      try {
        await login(page, account)
        await assertLogin(page, account)
        await collectSidebar(page, account)

        for (const path of account.allowedRoutes) {
          await visitRoute(page, account, path, true)
        }
        for (const path of account.deniedRoutes) {
          await visitRoute(page, account, path, false)
        }
        await checkLogout(page, account)
      } catch (error) {
        addResult({
          group: 'role-run',
          role: account.key,
          target: account.label,
          expected: 'role coverage completes',
          actual: 'ERROR',
          pass: false,
          severity: 'P0',
          summary: error instanceof Error ? error.message : String(error),
        })
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  await writeReports()
}

async function loadPlaywright() {
  try {
    return normalizePlaywrightModule(await import('playwright'))
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
  }

  const require = createRequire(import.meta.url)
  const searchRoots = (process.env.NODE_PATH || '')
    .split(':')
    .map((value) => value.trim())
    .filter(Boolean)

  for (const root of searchRoots) {
    try {
      const resolved = require.resolve('playwright', { paths: [root] })
      return normalizePlaywrightModule(await import(resolved))
    } catch {
      // Try the next NODE_PATH entry.
    }
  }

  return normalizePlaywrightModule(await import('playwright'))
}

function normalizePlaywrightModule(module) {
  return module.chromium ? module : module.default
}

function conclusion() {
  const failed = results.filter((result) => !result.pass)
  if (failed.some((result) => result.severity === 'P0')) return 'failed'
  if (failed.length) return 'warning'
  return 'passed'
}

async function writeReports() {
  await mkdir(REPORT_DIR, { recursive: true })
  const endedAt = new Date().toISOString()
  const failed = results.filter((result) => !result.pass)
  const stats = {
    pass: results.length - failed.length,
    fail: failed.length,
    total: results.length,
  }
  const payload = {
    suiteId,
    baseUrl: BASE_URL,
    startedAt,
    endedAt,
    conclusion: conclusion(),
    stats,
    results,
  }

  const jsonPath = join(REPORT_DIR, `online-ui-role-coverage-${STAMP}-${suiteId}.json`)
  const mdPath = join(REPORT_DIR, `online-ui-role-coverage-${STAMP}-${suiteId}.md`)
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  await writeFile(mdPath, renderMarkdown(payload), 'utf8')

  console.log(JSON.stringify({
    suiteId,
    conclusion: payload.conclusion,
    stats,
    jsonPath,
    mdPath,
  }, null, 2))

  if (failed.some((result) => result.severity === 'P0')) {
    process.exitCode = 1
  }
}

function renderMarkdown(payload) {
  const lines = []
  lines.push(`# 线上 UI 角色覆盖报告 ${payload.suiteId}`)
  lines.push('')
  lines.push(`- 环境：${payload.baseUrl}`)
  lines.push(`- 开始：${payload.startedAt}`)
  lines.push(`- 结束：${payload.endedAt}`)
  lines.push(`- 结论：${payload.conclusion}`)
  lines.push(`- 统计：pass ${payload.stats.pass} / fail ${payload.stats.fail} / total ${payload.stats.total}`)
  lines.push('')

  const failed = payload.results.filter((result) => !result.pass)
  lines.push('## 失败项')
  if (failed.length === 0) {
    lines.push('')
    lines.push('无。')
  } else {
    lines.push('')
    lines.push('| 严重级别 | 分组 | 角色 | 页面/目标 | 期望 | 实际 | 摘要 |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    for (const item of failed) {
      lines.push(`| ${escapeMd(item.severity)} | ${escapeMd(item.group)} | ${escapeMd(item.role)} | ${escapeMd(item.target)} | ${escapeMd(item.expected)} | ${escapeMd(item.actual).slice(0, 180)} | ${escapeMd(item.summary).slice(0, 180)} |`)
    }
  }

  lines.push('')
  lines.push('## 全量结果')
  lines.push('')
  lines.push('| 结果 | 分组 | 角色 | 页面/目标 | 摘要 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const item of payload.results) {
    lines.push(`| ${item.pass ? 'PASS' : 'FAIL'} | ${escapeMd(item.group)} | ${escapeMd(item.role)} | ${escapeMd(item.target)} | ${escapeMd(item.summary || item.actual).slice(0, 220)} |`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

function escapeMd(value) {
  return normalizeText(value).replace(/\|/g, '\\|')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
