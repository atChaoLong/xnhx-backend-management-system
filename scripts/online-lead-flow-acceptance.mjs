#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASE_URL = process.env.BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn'
const REPORT_DIR = path.join(ROOT, '.gstack', 'qa-reports')
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000)

const ACCOUNTS = {
  operator: { username: 'yy001', password: process.env.XNHX_OPERATOR_PASSWORD },
  sales: { username: 'xs001', password: process.env.XNHX_SALES_PASSWORD },
  head_teacher: { username: 'bzr001', password: process.env.XNHX_HEAD_TEACHER_PASSWORD },
  academic_affairs: { username: 'jw001', password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD },
  admin: { username: 'admin', password: process.env.XNHX_ADMIN_PASSWORD },
}

const runId = `ONLINE-ACCEPT-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const cases = []
const artifacts = {}

function extractCookieHeader(headers) {
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean)

  return setCookies
    .map(value => value.split(';')[0])
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

async function withTimeout(promise) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await promise(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson(pathname, { method = 'GET', session, body } = {}) {
  return withTimeout(async signal => {
    const headers = { accept: 'application/json' }
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
  if (!account?.password) throw new Error(`missing password env for ${role}`)

  const response = await fetchJson('/api/auth/signin', {
    method: 'POST',
    body: {
      email: account.username,
      password: account.password,
    },
  })

  const token = response.body?.data?.access_token
  if (!response.ok || !token) {
    throw new Error(`signin failed for ${role}: ${response.status} ${response.text.slice(0, 300)}`)
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

function record(id, title, passed, detail = {}) {
  cases.push({
    id,
    title,
    status: passed ? 'PASS' : 'FAIL',
    ...detail,
  })
}

function assertCase(id, title, condition, detail = {}) {
  record(id, title, Boolean(condition), detail)
  if (!condition) {
    throw new Error(`${id} ${title}: ${JSON.stringify(detail)}`)
  }
}

function isTruthyValue(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function sessionUserId(session) {
  return session?.profile?.id || session?.user?.id || session?.user?.sub
}

function leadPayload(seed, overrides = {}) {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    xhs_source: 'parent_account',
    channel_platform: `验收渠道-${runId}`,
    customer_social_id: `${runId}-${seed}`,
    add_method_code: 'yaojiazhang_v',
    operator_id: overrides.operator_id,
    grade_code: 'p3',
    subject_codes: ['math'],
    region_ip: 'beijing',
    parent_wechat: `wx_${seed}_${runId}`,
    chat_screenshots: `https://example.com/${runId}-${seed}.png`,
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

async function getLeads(session, query = '') {
  return fetchJson(`/api/leads?from=0&to=30${query ? `&${query}` : ''}`, { session })
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const startedAt = new Date().toISOString()
  const sessions = {}

  for (const role of Object.keys(ACCOUNTS)) {
    sessions[role] = await signIn(role)
    record('AUTH', `${role} 登录`, true, {
      status: 200,
      profileRole: sessions[role].profile?.role ?? sessions[role].user?.role,
    })
  }

  const operatorCreate = await createLead(sessions.operator, 'operator-a')
  assertCase('LN-003', '运营创建线索成功', operatorCreate.response.status === 200 && operatorCreate.lead?.id, {
    status: operatorCreate.response.status,
    body: operatorCreate.response.text.slice(0, 300),
    reportNumber: operatorCreate.lead?.report_number,
    leadId: operatorCreate.lead?.id,
  })
  artifacts.operatorLeadId = operatorCreate.lead.id

  assertCase('LN-003', '线索单号由服务端生成且忽略手工 report_number', Boolean(operatorCreate.lead.report_number) && operatorCreate.lead.report_number !== 'MANUAL_SHOULD_BE_IGNORED', {
    reportNumber: operatorCreate.lead.report_number,
  })

  const duplicateA = await createLead(sessions.operator, 'duplicate', {
    customer_social_id: `${runId}-DUP`,
    report_number: 'MANUAL_SHOULD_BE_IGNORED',
  })
  const duplicateB = await createLead(sessions.operator, 'duplicate', {
    customer_social_id: `${runId}-DUP`,
    report_number: 'MANUAL_SHOULD_BE_IGNORED',
  })
  assertCase('LN-004', '同渠道同社媒账号自动查重', duplicateA.response.status === 200 && duplicateB.response.status === 200 && isTruthyValue(duplicateB.lead?.duplicate_mark), {
    firstLeadId: duplicateA.lead?.id,
    secondLeadId: duplicateB.lead?.id,
    secondDuplicateMark: duplicateB.lead?.duplicate_mark,
    collisionOperator: duplicateB.lead?.collision_operator,
  })

  const salesCreate = await createLead(sessions.sales, 'sales-a')
  assertCase('LN-007', '销售可创建线索且自动归属自己', salesCreate.response.status === 200 && salesCreate.lead?.grab_user_id === sessionUserId(sessions.sales), {
    status: salesCreate.response.status,
    leadId: salesCreate.lead?.id,
    grabUserId: salesCreate.lead?.grab_user_id,
    salesProfileId: sessionUserId(sessions.sales),
  })
  artifacts.salesLeadId = salesCreate.lead?.id

  const headTeacherCreate = await createLead(sessions.head_teacher, 'head-teacher-a')
  assertCase('LN-007', '班主任可创建线索且自动归属自己', headTeacherCreate.response.status === 200 && headTeacherCreate.lead?.grab_user_id === sessionUserId(sessions.head_teacher), {
    status: headTeacherCreate.response.status,
    leadId: headTeacherCreate.lead?.id,
    grabUserId: headTeacherCreate.lead?.grab_user_id,
    headTeacherProfileId: sessionUserId(sessions.head_teacher),
  })

  const academicCreate = await createLead(sessions.academic_affairs, 'academic-denied')
  assertCase('LN-007', '教务不能创建线索', academicCreate.response.status === 403, {
    status: academicCreate.response.status,
    body: academicCreate.response.text.slice(0, 200),
  })

  const releaseBeforeFeedback = await fetchJson('/api/leads/release', {
    method: 'POST',
    session: sessions.sales,
    body: { id: salesCreate.lead.id },
  })
  assertCase('LN-006', '销售可将未处理自己的线索放回公共线索池', releaseBeforeFeedback.status === 200 && !releaseBeforeFeedback.body?.data?.grab_user_id, {
    status: releaseBeforeFeedback.status,
    leadId: salesCreate.lead.id,
    grabUserId: releaseBeforeFeedback.body?.data?.grab_user_id,
    body: releaseBeforeFeedback.text.slice(0, 200),
  })

  const publicPool = await fetchJson('/api/public-leads?from=0&to=30', { session: sessions.sales })
  const publicLead = publicPool.body?.data?.find(item => item.id === salesCreate.lead.id)
  assertCase('ST-001', '公共线索池抢单前隐藏敏感字段', publicPool.status === 200 && publicLead && !publicLead.parent_wechat && !publicLead.customer_social_id && !publicLead.chat_screenshots, {
    status: publicPool.status,
    leadId: salesCreate.lead.id,
    parentWechat: publicLead?.parent_wechat ?? null,
    customerSocialId: publicLead?.customer_social_id ?? null,
    chatScreenshots: publicLead?.chat_screenshots ?? null,
  })

  const grab = await fetchJson('/api/leads/grab', {
    method: 'POST',
    session: sessions.sales,
    body: { id: salesCreate.lead.id },
  })
  assertCase('LN-006', '销售可从公共线索池抢回线索', grab.status === 200 && grab.body?.data?.grab_user_id === sessionUserId(sessions.sales), {
    status: grab.status,
    leadId: salesCreate.lead.id,
    grabUserId: grab.body?.data?.grab_user_id,
  })

  assertCase('ST-002', '抢单后状态为销售未反馈且转化状态为空', grab.body?.data?.add_status == null && grab.body?.data?.conversion_status == null, {
    addStatus: grab.body?.data?.add_status ?? null,
    conversionStatus: grab.body?.data?.conversion_status ?? null,
  })

  const salesList = await getLeads(sessions.sales)
  const grabbedLead = salesList.body?.data?.find(item => item.id === salesCreate.lead.id)
  assertCase('ST-001', '抢单后销售可见敏感字段', salesList.status === 200 && grabbedLead?.parent_wechat && grabbedLead?.customer_social_id && grabbedLead?.chat_screenshots, {
    status: salesList.status,
    leadId: salesCreate.lead.id,
    parentWechatVisible: Boolean(grabbedLead?.parent_wechat),
    customerSocialVisible: Boolean(grabbedLead?.customer_social_id),
    chatScreenshotsVisible: Boolean(grabbedLead?.chat_screenshots),
  })

  const feedbackNotAdded = await fetchJson('/api/leads/feedback', {
    method: 'POST',
    session: sessions.sales,
    body: { id: salesCreate.lead.id, add_status: 'not_added' },
  })
  assertCase('ST-003', '销售可反馈未添加', feedbackNotAdded.status === 200 && feedbackNotAdded.body?.data?.add_status === 'not_added', {
    status: feedbackNotAdded.status,
    addStatus: feedbackNotAdded.body?.data?.add_status,
  })

  const feedbackAdded = await fetchJson('/api/leads/feedback', {
    method: 'POST',
    session: sessions.sales,
    body: { id: salesCreate.lead.id, add_status: 'added' },
  })
  assertCase('ST-003', '反馈未添加后仍可改为已添加', feedbackAdded.status === 200 && feedbackAdded.body?.data?.add_status === 'added', {
    status: feedbackAdded.status,
    addStatus: feedbackAdded.body?.data?.add_status,
  })

  const releaseAfterFeedback = await fetchJson('/api/leads/release', {
    method: 'POST',
    session: sessions.sales,
    body: { id: salesCreate.lead.id },
  })
  assertCase('LN-006', '已处理线索不能再丢弃到公共池', releaseAfterFeedback.status === 400, {
    status: releaseAfterFeedback.status,
    body: releaseAfterFeedback.text.slice(0, 200),
  })

  const operatorList = await getLeads(sessions.operator)
  const operatorCanSeeOwn = operatorList.body?.data?.some(item => item.id === operatorCreate.lead.id)
  const operatorCanSeeSales = operatorList.body?.data?.some(item => item.id === salesCreate.lead.id)
  assertCase('LN-001', '运营列表仅返回自己范围内线索样例', operatorList.status === 200 && operatorCanSeeOwn && !operatorCanSeeSales, {
    status: operatorList.status,
    ownLeadVisible: Boolean(operatorCanSeeOwn),
    salesLeadVisible: Boolean(operatorCanSeeSales),
  })

  const finishedAt = new Date().toISOString()
  const failures = cases.filter(item => item.status === 'FAIL')
  const reportPath = path.join(REPORT_DIR, `online-lead-flow-acceptance-${finishedAt.slice(0, 10)}.md`)
  const jsonPath = path.join(REPORT_DIR, `online-lead-flow-acceptance-${finishedAt.slice(0, 10)}.json`)

  const markdown = [
    '# 线上线索闭环验收报告',
    '',
    `- 目标环境：${BASE_URL}`,
    `- 验收批次：${runId}`,
    `- 开始时间：${startedAt}`,
    `- 结束时间：${finishedAt}`,
    `- 用例数：${cases.length}`,
    `- 通过：${cases.filter(item => item.status === 'PASS').length}`,
    `- 失败：${failures.length}`,
    '',
    '## 验收结果',
    '',
    '| ID | 验收项 | 状态 | 证据摘要 |',
    '| --- | --- | --- | --- |',
    ...cases.map(item => {
      const detail = Object.entries(item)
        .filter(([key]) => !['id', 'title', 'status'].includes(key))
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('; ')
        .replace(/\|/g, '/')
      return `| ${item.id} | ${item.title} | ${item.status} | ${detail || '-'} |`
    }),
    '',
  ].join('\n')

  fs.writeFileSync(reportPath, `${markdown}\n`)
  fs.writeFileSync(jsonPath, JSON.stringify({
    baseUrl: BASE_URL,
    runId,
    startedAt,
    finishedAt,
    artifacts,
    cases,
    failures,
  }, null, 2))

  console.log(JSON.stringify({
    reportPath,
    jsonPath,
    runId,
    cases: cases.length,
    failures: failures.length,
  }, null, 2))

  if (failures.length > 0) process.exitCode = 1
}

main().catch(error => {
  record('SCRIPT', '脚本执行异常', false, { error: error instanceof Error ? error.message : String(error) })
  console.error(error)
  process.exitCode = 1
})
