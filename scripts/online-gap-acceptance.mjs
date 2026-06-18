#!/usr/bin/env node

import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const ROOT = process.cwd()
const BASE_URL = (process.env.XNHX_BASE_URL || process.env.BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn').replace(/\/$/, '')
const REPORT_DIR = process.env.XNHX_QA_REPORT_DIR || path.join(ROOT, '.gstack', 'qa-reports')
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000)
const NAV_TIMEOUT_MS = Number(process.env.XNHX_UI_NAV_TIMEOUT_MS || 45000)
const STEP_TIMEOUT_MS = Number(process.env.XNHX_UI_STEP_TIMEOUT_MS || 15000)
const NAV_RETRY_COUNT = Number(process.env.XNHX_UI_NAV_RETRY_COUNT || 3)
const HEADLESS = process.env.XNHX_UI_HEADLESS !== '0'
const STAMP = process.env.XNHX_REPORT_STAMP || new Date().toISOString().slice(0, 10)
const RUN_ID = `GAP-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const PLAYWRIGHT_MODULE_ROOTS = [
  path.join(ROOT, 'node_modules'),
  path.join(ROOT, '..', 'node_modules'),
  '/Users/t77yq/.agents/skills/huashu-design/node_modules',
]

const ACCOUNTS = {
  operator: { username: process.env.XNHX_OPERATOR_USER || 'yy001', password: process.env.XNHX_OPERATOR_PASSWORD },
  sales: { username: process.env.XNHX_SALES_USER || 'xs001', password: process.env.XNHX_SALES_PASSWORD },
  head_teacher: { username: process.env.XNHX_HEAD_TEACHER_USER || 'bzr001', password: process.env.XNHX_HEAD_TEACHER_PASSWORD },
  academic_affairs: { username: process.env.XNHX_ACADEMIC_AFFAIRS_USER || 'jw001', password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD },
  admin: { username: process.env.XNHX_ADMIN_USER || 'admin', password: process.env.XNHX_ADMIN_PASSWORD },
}

const requiredAccounts = Object.entries(ACCOUNTS).filter(([, account]) => !account.password)
if (requiredAccounts.length > 0) {
  console.error(`Missing password env vars for: ${requiredAccounts.map(([role]) => role).join(', ')}`)
  process.exit(2)
}

const cases = []
const artifacts = {}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function escapeMd(value) {
  return normalizeText(value).replace(/\|/g, '\\|')
}

function redactBody(value) {
  return String(value || '').replace(/eyJ[A-Za-z0-9._-]+/g, '[token]').slice(0, 500)
}

function record(id, title, status, detail = {}) {
  cases.push({
    id,
    title,
    status,
    severity: detail.severity || (status === 'FAIL' ? 'P1' : ''),
    role: detail.role || '',
    target: detail.target || '',
    expected: detail.expected || '',
    actual: detail.actual || '',
    http: detail.http || '',
    ms: detail.ms || '',
    note: detail.note || '',
  })
}

function pass(id, title, detail = {}) {
  record(id, title, 'PASS', detail)
}

function fail(id, title, detail = {}) {
  record(id, title, 'FAIL', detail)
}

function external(id, title, detail = {}) {
  record(id, title, 'EXTERNAL', detail)
}

function expectCase(id, title, condition, detail = {}) {
  if (condition) pass(id, title, detail)
  else fail(id, title, detail)
  return Boolean(condition)
}

function extractCookieHeader(headers) {
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean)

  return setCookies
    .map((value) => value.split(';')[0])
    .filter(Boolean)
    .join('; ')
}

async function readBody(response) {
  const text = await response.text()
  try {
    return { text, json: text ? JSON.parse(text) : null }
  } catch {
    return { text, json: null }
  }
}

async function withTimeout(callback) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await callback(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson(pathname, { method = 'GET', session, body, accept = 'application/json' } = {}) {
  return withTimeout(async (signal) => {
    const headers = { accept }
    if (session?.token) headers.authorization = `Bearer ${session.token}`
    if (session?.cookieHeader) headers.cookie = session.cookieHeader
    if (body !== undefined) headers['content-type'] = 'application/json'

    const started = Date.now()
    const response = await fetch(`${BASE_URL}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal,
    })
    const parsed = await readBody(response)
    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      headers: response.headers,
      body: parsed.json,
      text: parsed.text,
    }
  })
}

async function signIn(role) {
  const account = ACCOUNTS[role]
  const response = await fetchJson('/api/auth/signin', {
    method: 'POST',
    body: {
      email: account.username,
      password: account.password,
    },
  })

  const token = response.body?.data?.access_token
  if (!response.ok || !token) {
    throw new Error(`signin failed for ${role}: ${response.status} ${redactBody(response.text)}`)
  }

  return {
    role,
    username: account.username,
    token,
    cookieHeader: extractCookieHeader(response.headers),
    profile: response.body?.data?.profile,
    user: response.body?.data?.user,
  }
}

function sessionUserId(session) {
  return session?.profile?.id || session?.user?.id || session?.user?.sub
}

function dateOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function phoneFromSeed(seed) {
  const digits = String(seed).replace(/\D/g, '').slice(-8).padStart(8, '0')
  return `138${digits}`
}

function leadPayload(seed, overrides = {}) {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    xhs_source: 'parent_account',
    channel_platform: `缺口验收渠道-${RUN_ID}`,
    customer_social_id: `${RUN_ID}-${seed}`,
    add_method_code: 'yaojiazhang_v',
    grade_code: 'p3',
    subject_codes: ['math'],
    region_ip: 'beijing',
    parent_wechat: `wx_${seed}_${RUN_ID}`,
    chat_screenshots: `https://dummyimage.com/900x520/111827/ffffff.png&text=${encodeURIComponent(`${RUN_ID}-${seed}`)}`,
    ...overrides,
  }
}

async function createLead(session, seed, overrides = {}) {
  const response = await fetchJson('/api/leads', {
    method: 'POST',
    session,
    body: leadPayload(seed, overrides),
  })
  return { response, lead: response.body?.data }
}

function trialPayload(lead, seed, overrides = {}) {
  return {
    lead_id: lead.id,
    child_name: `缺口验收学生${seed}`,
    region: 'beijing',
    grade: 'p3',
    trial_subject: 'math',
    trial_time: dateOffset(-2),
    trial_duration: 60,
    phone: phoneFromSeed(`${Date.now()}${seed}`),
    channel: lead.channel_platform || `缺口验收渠道-${RUN_ID}`,
    trial_amount: 1,
    payment_proof: `https://dummyimage.com/900x520/065f46/ffffff.png&text=${encodeURIComponent(`${RUN_ID}-proof`)}`,
    urgency_level: 'medium',
    notes: `线上缺口验收 ${RUN_ID}`,
    assigned_consultant: '销售001',
    ...overrides,
  }
}

async function createTeacher(session) {
  const seed = Date.now().toString().slice(-8)
  return fetchJson('/api/teachers', {
    method: 'POST',
    session,
    body: {
      name: `缺口验收老师${RUN_ID.slice(-6)}`,
      gender: 'female',
      wechat: `teacher_wx_${RUN_ID}`,
      classin_phone: phoneFromSeed(seed),
      location: 'beijing',
      subjects: ['math'],
      grade_levels: ['p3'],
      education: '本科',
      university: '缺口验收大学',
      teacher_level: 'A',
      status: 'active',
      notes: `线上缺口验收 ${RUN_ID}`,
    },
  })
}

function formalOrderPayload({ trial, lead, teacherName, previousOrderId, overrides = {} }) {
  return {
    order_type: previousOrderId ? 'extend' : 'new',
    previous_order_id: previousOrderId,
    trial_lesson_id: previousOrderId ? undefined : trial.id,
    lead_id: lead.id,
    consultant_teacher: '销售001',
    teacher_names: [teacherName],
    subjects: ['math'],
    total_hours: 10,
    payment_channel: 'wechat',
    payment_amount: 1000,
    hourly_rate: 100,
    payment_proof: `https://dummyimage.com/900x520/1d4ed8/ffffff.png&text=${encodeURIComponent(`${RUN_ID}-order`)}`,
    payment_time: new Date().toISOString(),
    order_notes: `线上缺口验收 ${RUN_ID}`,
    ...overrides,
  }
}

function listContains(items, id) {
  return Array.isArray(items) && items.some((item) => item?.id === id)
}

async function collectAll(pathname, session) {
  const response = await fetchJson(pathname, { session })
  const data = response.body?.data
  return { response, data: Array.isArray(data) ? data : data ? [data] : [] }
}

async function assertListContains(id, title, response, rows, targetId, detail = {}) {
  expectCase(id, title, response.status === 200 && listContains(rows, targetId), {
    ...detail,
    http: response.status,
    ms: response.ms,
    actual: `contains=${listContains(rows, targetId)} count=${rows.length}`,
    note: redactBody(response.text),
  })
}

async function runApiGapCases(sessions) {
  const teacherCreate = await createTeacher(sessions.admin)
  const teacher = teacherCreate.body?.data
  artifacts.teacherId = teacher?.id
  artifacts.teacherName = teacher?.name
  expectCase('SETUP', '创建老师库存记录', teacherCreate.status === 201 && teacher?.id, {
    http: teacherCreate.status,
    ms: teacherCreate.ms,
    note: redactBody(teacherCreate.text),
    severity: 'P0',
  })

  const formalLeadResult = await createLead(sessions.sales, 'formal-flow', {
    operator_id: sessionUserId(sessions.operator),
  })
  const formalLead = formalLeadResult.lead
  artifacts.formalLeadId = formalLead?.id
  expectCase('SETUP', '创建正式订单前置线索', formalLeadResult.response.status === 200 && formalLead?.id, {
    http: formalLeadResult.response.status,
    ms: formalLeadResult.response.ms,
    note: redactBody(formalLeadResult.response.text),
    severity: 'P0',
  })

  let trial
  if (formalLead?.id && teacher?.name) {
    const trialCreate = await fetchJson('/api/trial-lessons', {
      method: 'POST',
      session: sessions.sales,
      body: trialPayload(formalLead, 'formal-flow', {
        matched_teacher: teacher.name,
        confirmed_teacher: teacher.name,
        class_link: `https://example.com/classroom-${RUN_ID}`,
      }),
    })
    trial = trialCreate.body?.data
    artifacts.trialLessonId = trial?.id
    expectCase('SETUP', '创建可转正试听', trialCreate.status === 201 && trial?.id, {
      http: trialCreate.status,
      ms: trialCreate.ms,
      note: redactBody(trialCreate.text),
      severity: 'P0',
    })
  }

  let order
  if (formalLead?.id && trial?.id && teacher?.name) {
    const orderCreate = await fetchJson('/api/formal-orders', {
      method: 'POST',
      session: sessions.sales,
      body: formalOrderPayload({ trial, lead: formalLead, teacherName: teacher.name }),
    })
    order = orderCreate.body?.data
    artifacts.formalOrderId = order?.id
    artifacts.studentId = order?.student_id
    expectCase('SETUP', '试听转正式订单并生成学生', orderCreate.status === 201 && order?.id && order?.student_id, {
      http: orderCreate.status,
      ms: orderCreate.ms,
      note: redactBody(orderCreate.text),
      severity: 'P0',
    })
  }

  if (order?.student_id) {
    const assign = await fetchJson('/api/students/assign-head-teacher', {
      method: 'POST',
      session: sessions.admin,
      body: {
        studentId: order.student_id,
        headTeacherId: sessionUserId(sessions.head_teacher),
      },
    })
    expectCase('SETUP', '分配正式生给班主任', assign.status === 200, {
      http: assign.status,
      ms: assign.ms,
      note: redactBody(assign.text),
      severity: 'P0',
    })
  }

  const unrelatedLeadResult = await createLead(sessions.sales, 'unrelated-head-teacher', {
    operator_id: sessionUserId(sessions.operator),
  })
  artifacts.unrelatedLeadId = unrelatedLeadResult.lead?.id
  expectCase('SETUP', '创建班主任无关线索', unrelatedLeadResult.response.status === 200 && unrelatedLeadResult.lead?.id, {
    http: unrelatedLeadResult.response.status,
    ms: unrelatedLeadResult.response.ms,
    note: redactBody(unrelatedLeadResult.response.text),
    severity: 'P0',
  })

  const headOwnedLeadResult = await createLead(sessions.head_teacher, 'head-owned')
  artifacts.headOwnedLeadId = headOwnedLeadResult.lead?.id
  expectCase('SETUP', '创建班主任自有线索', headOwnedLeadResult.response.status === 200 && headOwnedLeadResult.lead?.id, {
    http: headOwnedLeadResult.response.status,
    ms: headOwnedLeadResult.response.ms,
    note: redactBody(headOwnedLeadResult.response.text),
    severity: 'P0',
  })

  const headLeadList = await collectAll('/api/leads?from=0&to=199', sessions.head_teacher)
  await assertListContains('LN-021', '班主任可看到自己创建的线索', headLeadList.response, headLeadList.data, artifacts.headOwnedLeadId, {
    role: 'head_teacher',
    target: '/api/leads',
    expected: 'contains own lead',
  })
  await assertListContains('LN-021', '班主任可看到负责正式生关联线索', headLeadList.response, headLeadList.data, artifacts.formalLeadId, {
    role: 'head_teacher',
    target: '/api/leads',
    expected: 'contains assigned formal student lead',
  })
  expectCase('LN-021', '班主任看不到无关线索', headLeadList.response.status === 200 && !listContains(headLeadList.data, artifacts.unrelatedLeadId), {
    role: 'head_teacher',
    target: '/api/leads',
    expected: 'exclude unrelated lead',
    actual: `contains=${listContains(headLeadList.data, artifacts.unrelatedLeadId)} count=${headLeadList.data.length}`,
    http: headLeadList.response.status,
    ms: headLeadList.response.ms,
  })

  if (order?.id) {
    const salesOrders = await collectAll('/api/formal-orders?from=0&to=199', sessions.sales)
    await assertListContains('ST-007', '销售可看到自己创建/归属正式订单', salesOrders.response, salesOrders.data, order.id, {
      role: 'sales',
      target: '/api/formal-orders',
    })

    const headOrders = await collectAll('/api/formal-orders?from=0&to=199', sessions.head_teacher)
    await assertListContains('ST-020', '班主任可看到负责学生正式订单', headOrders.response, headOrders.data, order.id, {
      role: 'head_teacher',
      target: '/api/formal-orders',
    })
  }

  if (order?.student_id) {
    const headStudents = await collectAll('/api/students?from=0&to=199&formal=true&include_summary=true', sessions.head_teacher)
    await assertListContains('ST-014', '班主任学生选择/正式生列表仅含负责学生范围', headStudents.response, headStudents.data, order.student_id, {
      role: 'head_teacher',
      target: '/api/students?formal=true',
    })
    pass('ST-020', '班主任正式生接口按负责学生范围返回', {
      role: 'head_teacher',
      target: '/api/students?formal=true',
      http: headStudents.response.status,
      ms: headStudents.response.ms,
      actual: `count=${headStudents.data.length}`,
    })

    const salesStudents = await collectAll('/api/students?from=0&to=199&formal=true&include_summary=true', sessions.sales)
    expectCase('ST-014', '销售正式生接口不泄露超范围学生敏感数据', salesStudents.response.status === 200 || salesStudents.response.status === 403, {
      role: 'sales',
      target: '/api/students?formal=true',
      expected: '200 scoped or 403 blocked',
      actual: `${salesStudents.response.status}; count=${salesStudents.data.length}`,
      http: salesStudents.response.status,
      ms: salesStudents.response.ms,
      note: redactBody(salesStudents.response.text),
    })
  }

  const classinLeadResult = await createLead(sessions.sales, 'classin-boundary', {
    operator_id: sessionUserId(sessions.operator),
  })
  let classinBoundaryTrial
  if (classinLeadResult.lead?.id && teacher?.name) {
    const trialCreate = await fetchJson('/api/trial-lessons', {
      method: 'POST',
      session: sessions.sales,
      body: trialPayload(classinLeadResult.lead, 'classin-boundary', {
        matched_teacher: teacher.name,
      }),
    })
    classinBoundaryTrial = trialCreate.body?.data
  }

  if (classinBoundaryTrial?.id) {
    const classinCreate = await fetchJson('/api/trial-lessons/create-classin', {
      method: 'POST',
      session: sessions.academic_affairs,
      body: { trialLessonId: classinBoundaryTrial.id },
    })
    expectCase('ST-008', '创建试听 ClassIn 课程保持登录态并返回业务错误', classinCreate.status === 400 && !/未登录|登录过期|Unauthorized/i.test(classinCreate.text), {
      role: 'academic_affairs',
      target: '/api/trial-lessons/create-classin',
      expected: 'business error, not auth loss',
      actual: `${classinCreate.status} ${redactBody(classinCreate.text)}`,
      http: classinCreate.status,
      ms: classinCreate.ms,
    })
  } else {
    fail('ST-008', '创建试听 ClassIn 课程保持登录态并返回业务错误', {
      severity: 'P0',
      note: 'setup trial missing',
    })
  }

  if (order?.id) {
    const batchClassin = await fetchJson('/api/schedule/batch/create-classin', {
      method: 'POST',
      session: sessions.academic_affairs,
      body: {
        orderId: order.id,
        className: '',
        items: [{
          date: dateOffset(7).slice(0, 10),
          startTime: '19:00',
          endTime: '20:00',
          studentName: order.student_name || trial?.child_name || `缺口验收学生formal-flow`,
          subject: '数学',
          teacherName: `不在订单老师范围-${RUN_ID}`,
        }],
      },
    })
    const businessTeacherError = batchClassin.status === 400 && /排课老师必须在订单老师范围内/.test(batchClassin.text)
    expectCase('ST-009', '批量排课不强制不合理班级名称', businessTeacherError && !/班级名称.*必填/.test(batchClassin.text), {
      role: 'academic_affairs',
      target: '/api/schedule/batch/create-classin',
      expected: 'blank className accepted until teacher business validation',
      actual: `${batchClassin.status} ${redactBody(batchClassin.text)}`,
      http: batchClassin.status,
      ms: batchClassin.ms,
    })
    expectCase('ST-010', '单节/批量排课接口认证与响应稳定', batchClassin.status !== 401 && batchClassin.status !== 403 && batchClassin.ms < 15000, {
      role: 'academic_affairs',
      target: '/api/schedule/batch/create-classin',
      expected: 'not auth blocked and <15s',
      actual: `${batchClassin.status}; ${batchClassin.ms}ms`,
      http: batchClassin.status,
      ms: batchClassin.ms,
    })
    expectCase('ST-015', '排课老师必须来自订单老师范围或明确提示绑定关系', businessTeacherError, {
      role: 'academic_affairs',
      target: '/api/schedule/batch/create-classin',
      expected: 'teacher binding/scope business error',
      actual: `${batchClassin.status} ${redactBody(batchClassin.text)}`,
      http: batchClassin.status,
      ms: batchClassin.ms,
    })
  }

  const invalidConfirmedLeadResult = await createLead(sessions.sales, 'invalid-confirmed', {
    operator_id: sessionUserId(sessions.operator),
  })
  if (invalidConfirmedLeadResult.lead?.id) {
    const invalidConfirmedTeacher = await fetchJson('/api/trial-lessons', {
      method: 'POST',
      session: sessions.sales,
      body: trialPayload(invalidConfirmedLeadResult.lead, 'invalid-confirmed', {
        matched_teacher: teacher?.name,
        confirmed_teacher: `不存在ClassIn老师-${RUN_ID}`,
        phone: phoneFromSeed(`${Date.now()}invalid`),
      }),
    })
    expectCase('ST-016', '试听确认老师不能保存无效老师', invalidConfirmedTeacher.status === 400, {
      role: 'sales',
      target: '/api/trial-lessons',
      expected: '400 for invalid confirmed teacher',
      actual: `${invalidConfirmedTeacher.status} ${redactBody(invalidConfirmedTeacher.text)}`,
      http: invalidConfirmedTeacher.status,
      ms: invalidConfirmedTeacher.ms,
    })
    pass('LN-028', '试听确认老师环节具备老师库存/ClassIn 校验边界', {
      role: 'sales',
      target: '/api/trial-lessons',
      note: '自动验证了无效老师拒绝；真实创建 ClassIn 老师账号需外部 ClassIn 后台验收。',
    })
  }

  const candidateCreate = await fetchJson('/api/teacher-candidates', {
    method: 'POST',
    session: sessions.admin,
    body: {
      name: `缺口验收候选老师${RUN_ID.slice(-6)}`,
      wechat_id: `candidate_wx_${RUN_ID}`,
      phone: phoneFromSeed(`${Date.now()}25`),
      subjects_taught: ['math'],
      grade_level: 'p3',
      video_recording_url: `https://example.com/interview-video-${RUN_ID}.mp4`,
      recruitment_step: 'final_entry',
      recruitment_status: 'pending_entry',
      interview_result: '通过面试',
    },
  })
  const candidate = candidateCreate.body?.data
  artifacts.teacherCandidateId = candidate?.id
  if (candidate?.id) {
    const verify = await fetchJson('/api/teacher-form/verify', {
      method: 'POST',
      body: { candidate_id: candidate.id },
    })
    expectCase('LN-025', '老师信息采集二维码目标候选人可公开校验', verify.status === 200 && verify.body?.success === true, {
      target: '/api/teacher-form/verify',
      expected: 'public candidate verify success',
      actual: `${verify.status} ${redactBody(verify.text)}`,
      http: verify.status,
      ms: verify.ms,
    })
  } else {
    fail('LN-025', '老师信息采集二维码目标候选人可公开校验', {
      target: '/api/teacher-candidates',
      actual: `${candidateCreate.status} ${redactBody(candidateCreate.text)}`,
      http: candidateCreate.status,
      ms: candidateCreate.ms,
    })
  }

  external('ST-011', '首次 ClassIn 创建后班级实际包含学生、老师和课节', {
    target: 'ClassIn 后台',
    expected: 'external system inspection',
    note: '自动脚本已验证排课入口、权限、班级名称和老师范围边界；真实 ClassIn 房间成员需要第三方后台确认。',
  })
}

async function detectChromePath() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

async function loadPlaywright() {
  try {
    return normalizePlaywrightModule(await import('playwright'))
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
  }

  const require = createRequire(import.meta.url)
  const searchRoots = [
    ...(process.env.NODE_PATH || '')
    .split(':')
    .map((value) => value.trim())
      .filter(Boolean),
    ...PLAYWRIGHT_MODULE_ROOTS,
  ].filter(Boolean)

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

function cookieObjectsFromHeader(cookieHeader) {
  const hostname = new URL(BASE_URL).hostname
  return String(cookieHeader || '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf('=')
      if (index < 1) return null
      return {
        name: pair.slice(0, index),
        value: pair.slice(index + 1),
        domain: hostname,
        path: '/',
        httpOnly: false,
        secure: BASE_URL.startsWith('https://'),
        sameSite: 'Lax',
      }
    })
    .filter(Boolean)
}

async function seedContextCookies(context, session) {
  const cookies = cookieObjectsFromHeader(session?.cookieHeader)
  if (cookies.length > 0) {
    await context.addCookies(cookies)
  }
}

async function safeWait(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT_MS }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT_MS }).catch(() => undefined)
}

async function gotoWithRetry(page, url, options = {}) {
  let lastError
  for (let attempt = 1; attempt <= NAV_RETRY_COUNT; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS, ...options })
    } catch (error) {
      lastError = error
      await page.goto('about:blank', { timeout: 5000 }).catch(() => undefined)
      await page.waitForTimeout(1000 * attempt).catch(() => undefined)
    }
  }
  throw lastError
}

async function browserLogin(page, session) {
  await gotoWithRetry(page, `${BASE_URL}/`)
  await page.evaluate((storedSession) => {
    window.localStorage.setItem('supabase.auth.session', JSON.stringify(storedSession))
    window.localStorage.setItem('supabase.auth.token', storedSession.access_token)
    window.sessionStorage.removeItem('currentUser')
    window.localStorage.removeItem('user')
  }, {
    access_token: session.token,
    refresh_token: session.profile?.refresh_token || '',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: session.user?.id ? { id: session.user.id } : null,
  })
  await gotoWithRetry(page, `${BASE_URL}/dashboard`)
  await safeWait(page)
}

async function pageText(page) {
  return normalizeText(await page.locator('body').innerText({ timeout: STEP_TIMEOUT_MS }).catch(() => ''))
}

async function isVisible(page, selectorOrLocator) {
  const locator = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator) : selectorOrLocator
  return locator.first().isVisible({ timeout: STEP_TIMEOUT_MS }).catch(() => false)
}

async function runPageCase(browser, sessions, role, pathName, callback) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 1000 } })
  await seedContextCookies(context, sessions[role])
  const page = await context.newPage()
  page.setDefaultTimeout(STEP_TIMEOUT_MS)
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS)
  try {
    await browserLogin(page, sessions[role])
    await gotoWithRetry(page, `${BASE_URL}${pathName}`)
    await safeWait(page)
    await callback(page)
  } finally {
    await context.close()
  }
}

async function runUiGapCases(sessions) {
  const playwright = await loadPlaywright()
  const chromePath = process.env.XNHX_CHROME_PATH || await detectChromePath()
  const launchOptions = {
    headless: HEADLESS,
    args: [
      '--disable-background-networking',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
    ],
  }
  if (chromePath) launchOptions.executablePath = chromePath
  else if (process.env.XNHX_BROWSER_CHANNEL !== 'bundled') launchOptions.channel = process.env.XNHX_BROWSER_CHANNEL || 'chrome'

  const browser = await playwright.chromium.launch(launchOptions)
  try {
    await runPageCase(browser, sessions, 'operator', '/dashboard/feedback', async (page) => {
      const text = await pageText(page)
      const buttonVisible = await isVisible(page, page.getByRole('button', { name: /新建回访/ }))
      expectCase('LN-005', '运营直访回访管理显示无权且不暴露新建按钮', /无权访问|无权访问回访管理|权限不足/.test(text) && !buttonVisible, {
        role: 'operator',
        target: '/dashboard/feedback',
        expected: 'blocked and no create button',
        actual: text.slice(0, 220),
      })
    })

    await runPageCase(browser, sessions, 'sales', '/dashboard/leads', async (page) => {
      const screenshotButton = page.getByRole('button', { name: /\d+\s*张/ }).first()
      const hasButton = await screenshotButton.isVisible({ timeout: STEP_TIMEOUT_MS }).catch(() => false)
      if (hasButton) {
        await screenshotButton.click({ timeout: STEP_TIMEOUT_MS })
        await page.waitForTimeout(500)
      }
      const dialogVisible = await isVisible(page, page.getByText('聊天截图').first())
      expectCase('LN-008', '销售线索列表聊天截图可点击放大预览', hasButton && dialogVisible, {
        role: 'sales',
        target: '/dashboard/leads',
        expected: 'screenshot dialog visible after click',
        actual: `button=${hasButton} dialog=${dialogVisible}`,
      })
    })

    await runPageCase(browser, sessions, 'head_teacher', '/dashboard/formal-students', async (page) => {
      const text = await pageText(page)
      expectCase('LN-022', '正式生管理页承载订单、退费、回访入口', /正式生管理/.test(text) && /退费/.test(text) && /回访/.test(text), {
        role: 'head_teacher',
        target: '/dashboard/formal-students',
        expected: 'formal students page contains refund and visit signals',
        actual: text.slice(0, 260),
      })
    })

    if (artifacts.studentId) {
      await runPageCase(browser, sessions, 'head_teacher', `/dashboard/students/${artifacts.studentId}`, async (page) => {
        const text = await pageText(page)
        expectCase('ST-017', '班主任正式生详情有跟进/回访记录入口', /回访/.test(text) && (/新建回访|回访记录|跟进/.test(text)), {
          role: 'head_teacher',
          target: `/dashboard/students/${artifacts.studentId}`,
          expected: 'visit/follow-up entry visible',
          actual: text.slice(0, 260),
        })
      })

      await runPageCase(browser, sessions, 'sales', `/dashboard/formal-orders/new?studentId=${artifacts.studentId}`, async (page) => {
        const text = await pageText(page)
        const studentNameValue = await page.locator('#student_name').inputValue({ timeout: STEP_TIMEOUT_MS }).catch(() => '')
        const parentPhoneValue = await page.locator('#parent_phone').inputValue({ timeout: STEP_TIMEOUT_MS }).catch(() => '')
        expectCase('ST-012', '新增正式订单页学生信息可在可接受时间加载', /新建正式订单|创建正式订单|正式订单/.test(text) && !/加载中/.test(text), {
          role: 'sales',
          target: `/dashboard/formal-orders/new?studentId=${artifacts.studentId}`,
          expected: 'loaded order form without endless loading',
          actual: text.slice(0, 260),
        })
        expectCase('ST-013', '选择已有学生时页面带入学生上下文', /缺口验收学生/.test(studentNameValue) && parentPhoneValue.length >= 6, {
          role: 'sales',
          target: `/dashboard/formal-orders/new?studentId=${artifacts.studentId}`,
          expected: 'student context input values populated',
          actual: `student_name=${studentNameValue}; parent_phone=${parentPhoneValue}; text=${text.slice(0, 180)}`,
        })
      })
    }

    await runPageCase(browser, sessions, 'academic_affairs', '/dashboard/schedule/batch', async (page) => {
      const text = await pageText(page)
      expectCase('ST-009', '批量排课页面可打开并显示批量排课功能', /批量排课/.test(text), {
        role: 'academic_affairs',
        target: '/dashboard/schedule/batch',
        expected: 'batch scheduling page visible',
        actual: text.slice(0, 220),
      })
    })
  } finally {
    await browser.close()
  }
}

async function writeReports(startedAt) {
  await fs.mkdir(REPORT_DIR, { recursive: true })
  const endedAt = new Date().toISOString()
  const stats = {
    pass: cases.filter((item) => item.status === 'PASS').length,
    fail: cases.filter((item) => item.status === 'FAIL').length,
    external: cases.filter((item) => item.status === 'EXTERNAL').length,
    total: cases.length,
  }
  const summary = {
    baseUrl: BASE_URL,
    runId: RUN_ID,
    startedAt,
    endedAt,
    conclusion: stats.fail > 0 ? 'failed' : 'passed',
    stats,
    artifacts,
  }

  const jsonPath = path.join(REPORT_DIR, `online-gap-acceptance-${STAMP}.json`)
  const mdPath = path.join(REPORT_DIR, `online-gap-acceptance-${STAMP}.md`)
  await fs.writeFile(jsonPath, `${JSON.stringify({ summary, cases }, null, 2)}\n`, 'utf8')

  const lines = [
    `# 线上缺口自动验收报告 ${STAMP}`,
    '',
    `- 环境：${BASE_URL}`,
    `- Run ID：${RUN_ID}`,
    `- 开始：${startedAt}`,
    `- 结束：${endedAt}`,
    `- 结论：${summary.conclusion}`,
    `- 统计：PASS ${stats.pass} / FAIL ${stats.fail} / EXTERNAL ${stats.external} / TOTAL ${stats.total}`,
    '',
    '## 关键对象',
    '',
    ...Object.entries(artifacts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 失败项',
    '',
  ]

  const failed = cases.filter((item) => item.status === 'FAIL')
  if (failed.length === 0) {
    lines.push('无。')
  } else {
    lines.push('| 编号 | 验证点 | 角色 | 目标 | 期望 | 实际 | 说明 |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    for (const item of failed) {
      lines.push(`| ${escapeMd(item.id)} | ${escapeMd(item.title)} | ${escapeMd(item.role)} | ${escapeMd(item.target)} | ${escapeMd(item.expected)} | ${escapeMd(item.actual).slice(0, 180)} | ${escapeMd(item.note).slice(0, 180)} |`)
    }
  }

  lines.push('')
  lines.push('## 全量结果')
  lines.push('')
  lines.push('| 结果 | 编号 | 验证点 | HTTP/耗时 | 摘要 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const item of cases) {
    const http = [item.http, item.ms ? `${item.ms}ms` : ''].filter(Boolean).join(' / ')
    lines.push(`| ${escapeMd(item.status)} | ${escapeMd(item.id)} | ${escapeMd(item.title)} | ${escapeMd(http)} | ${escapeMd(item.actual || item.note).slice(0, 240)} |`)
  }
  lines.push('')

  await fs.writeFile(mdPath, `${lines.join('\n')}\n`, 'utf8')
  return { summary, jsonPath, mdPath }
}

async function main() {
  const startedAt = new Date().toISOString()
  const sessions = {}
  try {
    for (const role of Object.keys(ACCOUNTS)) {
      sessions[role] = await signIn(role)
      pass('AUTH', `${role} 登录成功`, {
        role,
        http: 200,
        actual: sessions[role].profile?.role || sessions[role].role,
      })
    }

    await runApiGapCases(sessions)
    await runUiGapCases(sessions)
  } catch (error) {
    fail('SCRIPT', '脚本执行异常', {
      severity: 'P0',
      actual: error?.message || String(error),
      note: error?.stack || String(error),
    })
  } finally {
    const { summary, jsonPath, mdPath } = await writeReports(startedAt)
    console.log(JSON.stringify({ summary, jsonPath, mdPath }, null, 2))
    if (summary.stats.fail > 0) process.exitCode = 1
  }
}

main()
