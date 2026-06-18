#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASE_URL = process.env.BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn'
const REPORT_DIR = path.join(ROOT, '.gstack', 'qa-reports')
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000)
const CONCURRENCY = Number(process.env.CONCURRENCY || 8)
const ROLE_FILTER = new Set((process.env.XNHX_API_ROLES || '').split(',').map(role => role.trim()).filter(Boolean))

const ALL_ACCOUNTS = [
  { key: 'operator', username: process.env.XNHX_OPERATOR_USER || 'yy001', password: process.env.XNHX_OPERATOR_PASSWORD },
  { key: 'sales', username: process.env.XNHX_SALES_USER || 'xs001', password: process.env.XNHX_SALES_PASSWORD },
  { key: 'head_teacher', username: process.env.XNHX_HEAD_TEACHER_USER || 'bzr001', password: process.env.XNHX_HEAD_TEACHER_PASSWORD },
  { key: 'academic_affairs', username: process.env.XNHX_ACADEMIC_AFFAIRS_USER || 'jw001', password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD },
  { key: 'teacher_recruiter', username: process.env.XNHX_TEACHER_RECRUITER_USER || 'zs001', password: process.env.XNHX_TEACHER_RECRUITER_PASSWORD, optional: true },
  { key: 'admin', username: process.env.XNHX_ADMIN_USER || 'admin', password: process.env.XNHX_ADMIN_PASSWORD },
]
const ACCOUNTS = ROLE_FILTER.size > 0
  ? ALL_ACCOUNTS.filter(account => ROLE_FILTER.has(account.key))
  : ALL_ACCOUNTS.filter(account => !account.optional || account.password)
if (ACCOUNTS.length === 0) {
  console.error(`No accounts selected. XNHX_API_ROLES can include: ${ALL_ACCOUNTS.map(account => account.key).join(', ')}`)
  process.exit(2)
}
const ACCOUNTS_BY_KEY = Object.fromEntries(ACCOUNTS.map(account => [account.key, account]))

const PUBLIC_PATHS = ['/api/health', '/api/init-admin', '/api/classin/callback']
const PUBLIC_PREFIXES = ['/api/auth', '/api/teacher-form']

function extractObject(source, marker) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) throw new Error(`Cannot find ${marker}`)
  const start = source.indexOf('{', markerIndex)
  if (start === -1) throw new Error(`Cannot find object start for ${marker}`)

  let depth = 0
  let quote = null
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) {
      return source.slice(start, index + 1)
    }
  }

  throw new Error(`Cannot find object end for ${marker}`)
}

function evaluateObject(objectSource, context = {}) {
  const names = Object.keys(context)
  const values = Object.values(context)
  return new Function(...names, `return (${objectSource})`)(...values)
}

function loadLocalPermissionModel() {
  const permissionsSource = fs.readFileSync(path.join(ROOT, 'lib', 'permissions.ts'), 'utf8')
  const routeSource = fs.readFileSync(path.join(ROOT, 'lib', 'route-permissions.ts'), 'utf8')

  const RESOURCES = evaluateObject(extractObject(permissionsSource, 'export const RESOURCES'))
  const ACTIONS = evaluateObject(extractObject(permissionsSource, 'export const ACTIONS'))
  const PERMISSION_MATRIX = evaluateObject(extractObject(permissionsSource, 'const PERMISSION_MATRIX'))
  const ROUTE_PERMISSIONS = evaluateObject(
    extractObject(routeSource, 'export const ROUTE_PERMISSIONS'),
    { RESOURCES, ACTIONS },
  )

  return { PERMISSION_MATRIX, ROUTE_PERMISSIONS }
}

function routePatternMatches(routePath, requestPath) {
  const routeSegments = routePath.split('/').filter(Boolean)
  const requestSegments = requestPath.split('/').filter(Boolean)

  if (routeSegments.length !== requestSegments.length) return false

  return routeSegments.every((segment, index) => {
    return /^\[[^\]]+\]$/.test(segment) || segment === requestSegments[index]
  })
}

function isPublicPath(routePath) {
  return PUBLIC_PATHS.includes(routePath) ||
    PUBLIC_PREFIXES.some(prefix => routePath === prefix || routePath.startsWith(`${prefix}/`))
}

function getRoutePermission(routePermissions, routePath, method) {
  if (routePermissions[routePath]?.[method]) {
    return routePermissions[routePath][method]
  }

  const matchingPattern = Object.keys(routePermissions)
    .sort((a, b) => b.length - a.length)
    .find(pattern => routePatternMatches(pattern, routePath) && routePermissions[pattern]?.[method])

  return matchingPattern ? routePermissions[matchingPattern][method] : null
}

function hasPermission(permissionMatrix, role, permission) {
  if (!permission) return false
  const actions = Array.isArray(permission.action) ? permission.action : [permission.action]
  const rolePermissions = permissionMatrix[role]?.[permission.resource] ?? []
  return actions.some(action => rolePermissions.includes(action))
}

function walkRouteFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(fullPath))
    } else if (entry.name === 'route.ts') {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function routePathFromFile(filePath) {
  return `/${path.relative(path.join(ROOT, 'app'), path.dirname(filePath)).split(path.sep).join('/')}`
}

function methodsFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const methods = []
  const pattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g
  let match

  while ((match = pattern.exec(source)) !== null) {
    methods.push(match[1])
  }

  return methods
}

function concretePath(routePath) {
  return routePath.replace(/\[[^\]]+\]/g, ZERO_UUID)
}

function queryFor(routePath, method, actor) {
  if (method !== 'GET') return ''

  const query = new URLSearchParams()
  query.set('from', '0')
  query.set('to', '1')

  if (routePath === '/api/students/detail') query.set('id', ZERO_UUID)
  if (routePath === '/api/students/status-history') query.set('student_id', ZERO_UUID)
  if (routePath === '/api/users' && actor !== 'admin') query.set('role', 'head_teacher')
  if (routePath === '/api/class-sessions/export') query.set('format', 'csv')
  if (routePath === '/api/quality-reports/export') query.set('format', 'csv')
  if (routePath === '/api/teacher-form') query.set('pageSize', '1')

  return `?${query.toString()}`
}

async function readResponseBody(response) {
  const text = await response.text()
  if (text.length <= 280) return text
  return `${text.slice(0, 280)}...`
}

function extractCookieHeader(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)

  return setCookies
    .map(value => value.split(';')[0])
    .filter(Boolean)
    .join('; ')
}

async function requestOnce(routePath, method, session, actor) {
  const url = `${BASE_URL}${concretePath(routePath)}${queryFor(routePath, method, actor)}`
  const headers = { accept: 'application/json' }
  if (session?.token) headers.authorization = `Bearer ${session.token}`
  if (session?.cookieHeader) headers.cookie = session.cookieHeader

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const init = { method, headers, redirect: 'manual' }
  init.signal = controller.signal

  if (method !== 'GET') {
    init.headers['content-type'] = 'application/json'
    init.body = '{}'
  }

  const started = Date.now()
  try {
    const response = await fetch(url, init)
    const body = await readResponseBody(response)
    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      body,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'FETCH_ERROR',
      ms: Date.now() - started,
      body: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

const refreshPromises = new Map()

async function refreshSession(actor, sessions) {
  if (refreshPromises.has(actor)) {
    return refreshPromises.get(actor)
  }

  const account = ACCOUNTS_BY_KEY[actor]
  if (!account) {
    return { ok: false, error: `unknown actor ${actor}` }
  }

  const promise = signIn(account)
    .then(result => {
      if (result.ok) {
        sessions[actor] = result
      }
      return result
    })
    .finally(() => {
      refreshPromises.delete(actor)
    })

  refreshPromises.set(actor, promise)
  return promise
}

async function requestWithAuthRetry(routePath, method, actor, sessions) {
  const session = actor === 'anonymous' ? null : sessions[actor]
  const first = await requestOnce(routePath, method, session, actor)

  if (actor === 'anonymous' || Number(first.status) !== 401) {
    return first
  }

  const refreshed = await refreshSession(actor, sessions)
  if (!refreshed.ok) {
    return {
      ...first,
      retried: true,
      retryError: refreshed.error ?? refreshed.status ?? 'session refresh failed',
    }
  }

  const second = await requestOnce(routePath, method, refreshed, actor)
  return {
    ...second,
    retried: true,
    firstStatus: first.status,
  }
}

async function signIn(account) {
  if (!account.password) {
    return { ok: false, error: `missing password env for ${account.key}` }
  }

  const response = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: account.username,
      password: account.password,
    }),
  })
  const text = await response.text()

  if (!response.ok) {
    return { ok: false, status: response.status, error: text.slice(0, 500) }
  }

  const payload = JSON.parse(text)
  const token = payload?.data?.access_token
  const cookieHeader = extractCookieHeader(response)
  const role = payload?.data?.user?.role ??
    payload?.data?.profile?.role ??
    payload?.data?.user?.user_metadata?.role

  if (!token) {
    return { ok: false, status: response.status, error: 'signin response missing access_token' }
  }

  return { ok: true, token, cookieHeader, role, userId: payload?.data?.user?.id }
}

function isSessionMutation(route, method) {
  return route === '/api/auth/signout' && ['GET', 'POST'].includes(method)
}

function isPlaceholderEntityProbe(route, method) {
  return method === 'GET' && (
    route.includes('[') ||
    route === '/api/students/detail' ||
    route === '/api/students/status-history'
  )
}

function expectedLabel({ route, method, actor, allowed }) {
  if (actor === 'anonymous') {
    return isPublicPath(route) ? 'public reachable' : '401/403'
  }

  if (!allowed) return '403'
  if (isPlaceholderEntityProbe(route, method)) return 'reachable or scoped 403/404'
  return 'reachable'
}

function classifyResult({ route, method, actor, result, permission, allowed }) {
  const protectedRoute = !isPublicPath(route)
  if (result.status === 'FETCH_ERROR') return 'fail'

  const status = Number(result.status)

  if (actor === 'anonymous') {
    if (protectedRoute && status !== 401 && status !== 403) return 'fail'
    if (!protectedRoute && status >= 500) return 'fail'
    return 'pass'
  }

  if (method !== 'GET') {
    if (allowed) {
      if (status === 401 || status === 403 || status >= 500) return 'fail'
      return 'pass'
    }
    return status === 403 ? 'pass' : 'fail'
  }

  if (!permission || isPublicPath(route)) {
    return status >= 500 ? 'fail' : 'pass'
  }

  if (allowed) {
    if (isPlaceholderEntityProbe(route, method) && (status === 403 || status === 404)) return 'pass'
    if (status === 401 || status === 403 || status >= 500) return 'fail'
    return 'pass'
  }

  return status === 403 ? 'pass' : 'fail'
}

function shouldRunOnline(route, method, actor, allowed) {
  if (actor !== 'anonymous' && isSessionMutation(route, method)) return false
  if (method === 'GET') return true
  if (actor === 'anonymous') return true
  if (!allowed) return true
  return false
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      await worker(item)
    }
  })

  await Promise.all(workers)
}

function makeMarkdownReport({ startedAt, finishedAt, routes, loginResults, cases, skippedWrites, failures }) {
  const routeCount = routes.length
  const methodCount = routes.reduce((sum, route) => sum + route.methods.length, 0)
  const passCount = cases.filter(item => item.classification === 'pass').length
  const failCount = cases.filter(item => item.classification === 'fail').length

  const lines = []
  lines.push(`# 线上 API 认证矩阵报告`)
  lines.push('')
  lines.push(`- 目标环境：${BASE_URL}`)
  lines.push(`- 开始时间：${startedAt}`)
  lines.push(`- 结束时间：${finishedAt}`)
  lines.push(`- 路由文件：${routeCount}`)
  lines.push(`- 路由方法：${methodCount}`)
  lines.push(`- 实际请求用例：${cases.length}`)
  lines.push(`- 安全跳过：${skippedWrites.length}`)
  lines.push(`- 通过：${passCount}`)
  lines.push(`- 失败：${failCount}`)
  lines.push('')
  lines.push(`## 登录结果`)
  lines.push('')
  lines.push(`| 角色 | 用户名 | 状态 | 线上角色 | 备注 |`)
  lines.push(`| --- | --- | --- | --- | --- |`)
  for (const item of loginResults) {
    lines.push(`| ${item.key} | ${item.username} | ${item.ok ? 'PASS' : 'FAIL'} | ${item.role ?? '-'} | ${item.ok ? '-' : String(item.error ?? item.status ?? '').replace(/\|/g, '/')} |`)
  }
  lines.push('')
  lines.push(`## 失败项`)
  lines.push('')
  if (failures.length === 0) {
    lines.push(`未发现认证/权限门禁失败。`)
  } else {
    lines.push(`| 接口 | 方法 | 角色 | 期望 | 状态码 | 重试 | 耗时 | 响应摘要 |`)
    lines.push(`| --- | --- | --- | --- | --- | --- | ---: | --- |`)
    for (const item of failures) {
      lines.push(`| ${item.route} | ${item.method} | ${item.actor} | ${item.expected} | ${item.result.status} | ${item.result.retried ? `YES (${item.result.firstStatus ?? '-'})` : 'NO'} | ${item.result.ms}ms | ${String(item.result.body).replace(/\n/g, ' ').replace(/\|/g, '/')} |`)
    }
  }
  lines.push('')
  lines.push(`## 实际请求矩阵`)
  lines.push('')
  lines.push(`| 接口 | 方法 | 角色 | 权限 | 期望 | 结果 | 状态码 | 重试 | 耗时 |`)
  lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- | ---: |`)
  for (const item of cases) {
    lines.push(`| ${item.route} | ${item.method} | ${item.actor} | ${item.permissionLabel} | ${item.expected} | ${item.classification.toUpperCase()} | ${item.result.status} | ${item.result.retried ? `YES (${item.result.firstStatus ?? '-'})` : 'NO'} | ${item.result.ms}ms |`)
  }
  lines.push('')
  lines.push(`## 安全跳过清单`)
  lines.push('')
  if (skippedWrites.length === 0) {
    lines.push(`无。`)
  } else {
    lines.push(`这些用例可能在生产产生数据、触发第三方同步，或结束当前登录会话，本轮只做静态覆盖和安全门禁测试。`)
    lines.push('')
    lines.push(`| 接口 | 方法 | 角色 | 权限 |`)
    lines.push(`| --- | --- | --- | --- |`)
    for (const item of skippedWrites) {
      lines.push(`| ${item.route} | ${item.method} | ${item.actor} | ${item.permissionLabel} |`)
    }
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const startedAt = new Date().toISOString()
  fs.mkdirSync(REPORT_DIR, { recursive: true })

  const { PERMISSION_MATRIX, ROUTE_PERMISSIONS } = loadLocalPermissionModel()
  const routes = walkRouteFiles(path.join(ROOT, 'app', 'api'))
    .map(file => ({
      file,
      route: routePathFromFile(file),
      methods: methodsFromFile(file),
    }))
    .filter(route => route.methods.length > 0)

  const loginResults = []
  const sessions = {}

  for (const account of ACCOUNTS) {
    const result = await signIn(account)
    loginResults.push({ ...account, ...result, password: undefined })
    if (result.ok) {
      sessions[account.key] = result
    }
  }

  const missingLogins = loginResults.filter(item => !item.ok)
  if (missingLogins.length > 0) {
    console.error(`Login failed for: ${missingLogins.map(item => item.key).join(', ')}`)
  }

  const actors = ['anonymous', ...ACCOUNTS.map(account => account.key).filter(key => sessions[key])]
  const cases = []
  const skippedWrites = []
  const pendingCases = []

  for (const routeInfo of routes) {
    for (const method of routeInfo.methods) {
      if (!METHODS.includes(method)) continue
      const permission = getRoutePermission(ROUTE_PERMISSIONS, routeInfo.route, method)
      const permissionLabel = permission
        ? `${permission.resource}:${Array.isArray(permission.action) ? permission.action.join('|') : permission.action}`
        : isPublicPath(routeInfo.route) ? 'public' : 'MISSING_ROUTE_PERMISSION'

      for (const actor of actors) {
        const allowed = actor === 'anonymous'
          ? isPublicPath(routeInfo.route)
          : !permission || isPublicPath(routeInfo.route) || hasPermission(PERMISSION_MATRIX, actor, permission)
        const expected = expectedLabel({
          route: routeInfo.route,
          method,
          actor,
          allowed,
        })

        if (!shouldRunOnline(routeInfo.route, method, actor, allowed)) {
          skippedWrites.push({
            route: routeInfo.route,
            method,
            actor,
            permissionLabel,
          })
          continue
        }

        pendingCases.push({
          route: routeInfo.route,
          method,
          actor,
          permission,
          permissionLabel,
          expected,
          allowed,
        })
      }
    }
  }

  let completed = 0
  await runWithConcurrency(pendingCases, CONCURRENCY, async pendingCase => {
    const result = await requestWithAuthRetry(pendingCase.route, pendingCase.method, pendingCase.actor, sessions)
    const classification = classifyResult({
      route: pendingCase.route,
      method: pendingCase.method,
      actor: pendingCase.actor,
      result,
      permission: pendingCase.permission,
      allowed: pendingCase.allowed,
    })

    cases.push({
      route: pendingCase.route,
      method: pendingCase.method,
      actor: pendingCase.actor,
      permissionLabel: pendingCase.permissionLabel,
      expected: pendingCase.expected,
      allowed: pendingCase.allowed,
      result,
      classification,
    })

    completed += 1
    if (completed % 25 === 0 || completed === pendingCases.length) {
      console.error(`completed ${completed}/${pendingCases.length}`)
    }
  })

  const failures = cases.filter(item => item.classification === 'fail')
  const finishedAt = new Date().toISOString()
  const stamp = finishedAt.slice(0, 10)
  const reportPath = path.join(REPORT_DIR, `online-api-auth-matrix-${stamp}.md`)
  const jsonPath = path.join(REPORT_DIR, `online-api-auth-matrix-${stamp}.json`)

  fs.writeFileSync(
    reportPath,
    makeMarkdownReport({
      startedAt,
      finishedAt,
      routes,
      loginResults,
      cases,
      skippedWrites,
      failures,
    }),
  )
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      baseUrl: BASE_URL,
      startedAt,
      finishedAt,
      summary: {
        routes: routes.length,
        methods: routes.reduce((sum, route) => sum + route.methods.length, 0),
        cases: cases.length,
        skippedWrites: skippedWrites.length,
        passed: cases.length - failures.length,
        failed: failures.length,
      },
      loginResults: loginResults.map(({ key, username, ok, status, error, role, userId }) => ({
        key,
        username,
        ok,
        status,
        error,
        role,
        userId,
      })),
      failures,
      cases,
      skippedWrites,
    }, null, 2),
  )

  console.log(JSON.stringify({
    reportPath,
    jsonPath,
    routes: routes.length,
    cases: cases.length,
    skippedWrites: skippedWrites.length,
    failures: failures.length,
  }, null, 2))

  if (failures.length > 0 || missingLogins.length > 0) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
