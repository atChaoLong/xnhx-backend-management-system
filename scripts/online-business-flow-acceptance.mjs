#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASE_URL = process.env.BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn'
const REPORT_DIR = path.join(ROOT, '.gstack', 'qa-reports')
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000)
const MB = 1024 * 1024

const ACCOUNTS = {
  operator: { username: 'yy001', password: process.env.XNHX_OPERATOR_PASSWORD },
  sales: { username: 'xs001', password: process.env.XNHX_SALES_PASSWORD },
  head_teacher: { username: 'bzr001', password: process.env.XNHX_HEAD_TEACHER_PASSWORD },
  academic_affairs: { username: 'jw001', password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD },
  admin: { username: 'admin', password: process.env.XNHX_ADMIN_PASSWORD },
}

const runId = `BUSINESS-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
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

async function withTimeout(callback) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await callback(controller.signal)
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
  if (!account?.password) {
    throw new Error(`missing password env for ${role}`)
  }

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

function sessionUserId(session) {
  return session?.profile?.id || session?.user?.id || session?.user?.sub
}

function isoMinutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function phoneFromSeed(seed) {
  const digits = String(seed).replace(/\D/g, '').slice(-8).padStart(8, '0')
  return `139${digits}`
}

function leadPayload(seed, overrides = {}) {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    xhs_source: 'parent_account',
    channel_platform: `验收渠道-${runId}`,
    customer_social_id: `${runId}-${seed}`,
    add_method_code: 'yaojiazhang_v',
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
  return fetchJson(`/api/leads?from=0&to=49${query ? `&${query}` : ''}`, { session })
}

function pngBuffer(size) {
  const tinyPng = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000000020001e221bc330000000049454e44ae426082',
    'hex',
  )

  if (size <= tinyPng.length) return tinyPng
  return Buffer.concat([tinyPng, Buffer.alloc(size - tinyPng.length)])
}

async function uploadFile(session, { bucket, filename, size, type = 'image/png' }) {
  const started = Date.now()
  const signResponse = await fetchJson('/api/upload/sign', {
    method: 'POST',
    session,
    body: {
      bucket,
      fileName: filename,
      fileSize: size,
      contentType: type,
    },
  })

  if (!signResponse.ok) {
    return {
      ...signResponse,
      ms: Date.now() - started,
    }
  }

  const signed = signResponse.body
  if (!signed?.signedUrl || !signed?.url || !signed?.path) {
    return {
      ok: false,
      status: 500,
      ms: Date.now() - started,
      body: signed,
      text: JSON.stringify(signed || {}),
    }
  }

  return withTimeout(async signal => {
    const response = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers: {
        'cache-control': 'max-age=3600',
        'content-type': signed.contentType || type,
        'x-upsert': 'false',
      },
      body: pngBuffer(size),
      signal,
    })
    const parsed = await readBody(response)
    const body = response.ok
      ? { url: signed.url, path: signed.path, storage: parsed.json }
      : parsed.json

    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      body,
      text: response.ok ? JSON.stringify(body) : parsed.text,
    }
  })
}

function trialPayload(lead, paymentProofUrl, seed, overrides = {}) {
  return {
    lead_id: lead.id,
    child_name: `验收学生${seed}`,
    region: 'beijing',
    grade: 'p3',
    trial_subject: 'math',
    trial_time: isoMinutesFromNow(24 * 60 + 90),
    trial_duration: 60,
    phone: phoneFromSeed(`${Date.now()}${seed}`),
    channel: lead.channel_platform || `验收渠道-${runId}`,
    trial_amount: 1,
    payment_proof: paymentProofUrl,
    urgency_level: 'medium',
    notes: `线上业务闭环验收 ${runId}`,
    assigned_consultant: lead.grab_wechat || '销售001',
    ...overrides,
  }
}

function writeReports(startedAt, endedAt) {
  const failed = cases.filter(item => item.status !== 'PASS')
  const summary = {
    baseUrl: BASE_URL,
    runId,
    startedAt,
    endedAt,
    total: cases.length,
    passed: cases.length - failed.length,
    failed: failed.length,
    artifacts,
  }

  const jsonPath = path.join(REPORT_DIR, `online-business-flow-acceptance-${new Date().toISOString().slice(0, 10)}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, cases }, null, 2))

  const lines = [
    `# 线上业务闭环验收报告 ${new Date().toISOString().slice(0, 10)}`,
    '',
    `- 基础地址：${BASE_URL}`,
    `- Run ID：${runId}`,
    `- 开始时间：${startedAt}`,
    `- 结束时间：${endedAt}`,
    `- 总用例：${summary.total}`,
    `- 通过：${summary.passed}`,
    `- 失败：${summary.failed}`,
    '',
    '## 关键对象',
    '',
    ...Object.entries(artifacts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 用例明细',
    '',
    '| 结果 | 编号 | 验证点 | HTTP/耗时 | 说明 |',
    '| --- | --- | --- | --- | --- |',
    ...cases.map(item => {
      const http = [item.statusCode, item.ms ? `${item.ms}ms` : ''].filter(Boolean).join(' / ')
      const detail = item.message || item.error || item.note || item.body || item.leadId || item.todoId || item.trialLessonId || ''
      return `| ${item.status === 'PASS' ? '✅' : '❌'} | ${item.id} | ${item.title} | ${http} | ${String(detail).replaceAll('|', '\\|').slice(0, 240)} |`
    }),
  ]

  const mdPath = path.join(REPORT_DIR, `online-business-flow-acceptance-${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`)

  return { summary, jsonPath, mdPath }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const startedAt = new Date().toISOString()
  const sessions = {}

  for (const role of Object.keys(ACCOUNTS)) {
    sessions[role] = await signIn(role)
    record('AUTH', `${role} 登录`, true, {
      statusCode: 200,
      profileRole: sessions[role].profile?.role ?? sessions[role].user?.role,
    })
  }

  const operatorLeadResult = await createLead(sessions.operator, 'operator-scope', {
    operator_id: sessionUserId(sessions.operator),
  })
  assertCase('LN-009', '运营线索创建成功用于权限隔离', operatorLeadResult.response.status === 200 && operatorLeadResult.lead?.id, {
    statusCode: operatorLeadResult.response.status,
    ms: operatorLeadResult.response.ms,
    body: operatorLeadResult.response.text.slice(0, 200),
    leadId: operatorLeadResult.lead?.id,
  })
  artifacts.operatorLeadId = operatorLeadResult.lead.id

  const flowLeadResult = await createLead(sessions.operator, 'operator-public-flow', {
    operator_id: sessionUserId(sessions.operator),
  })
  assertCase('LN-010', '运营创建公海线索用于销售领取闭环', flowLeadResult.response.status === 200 && flowLeadResult.lead?.id, {
    statusCode: flowLeadResult.response.status,
    ms: flowLeadResult.response.ms,
    body: flowLeadResult.response.text.slice(0, 200),
    leadId: flowLeadResult.lead?.id,
  })
  artifacts.flowLeadId = flowLeadResult.lead.id

  const salesLeadResult = await createLead(sessions.sales, 'sales-create-own')
  assertCase('LN-007', '销售创建线索成功并自动归属自己', salesLeadResult.response.status === 200 && salesLeadResult.lead?.grab_user_id === sessionUserId(sessions.sales), {
    statusCode: salesLeadResult.response.status,
    ms: salesLeadResult.response.ms,
    leadId: salesLeadResult.lead?.id,
    grabUserId: salesLeadResult.lead?.grab_user_id,
  })
  artifacts.salesLeadId = salesLeadResult.lead.id

  const publicPool = await fetchJson('/api/public-leads?from=0&to=49', { session: sessions.sales })
  const flowLeadInPool = publicPool.body?.data?.find(item => item.id === flowLeadResult.lead.id)
  assertCase('ST-001', '销售可在公海看到未领取线索且敏感字段隐藏', publicPool.status === 200 && flowLeadInPool && !flowLeadInPool.parent_wechat && !flowLeadInPool.customer_social_id && !flowLeadInPool.chat_screenshots, {
    statusCode: publicPool.status,
    ms: publicPool.ms,
    leadId: flowLeadResult.lead.id,
    parentWechatVisible: Boolean(flowLeadInPool?.parent_wechat),
    customerSocialVisible: Boolean(flowLeadInPool?.customer_social_id),
    chatScreenshotsVisible: Boolean(flowLeadInPool?.chat_screenshots),
  })

  const grabFlowLead = await fetchJson('/api/leads/grab', {
    method: 'POST',
    session: sessions.sales,
    body: { id: flowLeadResult.lead.id },
  })
  const flowLead = grabFlowLead.body?.data
  assertCase('LN-006', '销售可从公海领取运营线索用于后续流转', grabFlowLead.status === 200 && flowLead?.grab_user_id === sessionUserId(sessions.sales) && flowLead?.operator_id === sessionUserId(sessions.operator), {
    statusCode: grabFlowLead.status,
    ms: grabFlowLead.ms,
    body: grabFlowLead.text.slice(0, 300),
    leadId: flowLeadResult.lead.id,
    grabUserId: flowLead?.grab_user_id,
    operatorId: flowLead?.operator_id,
  })

  const salesLeads = await getLeads(sessions.sales)
  const salesCanSeeOwn = salesLeads.body?.data?.some(item => item.id === flowLead.id)
  const salesCanSeeOperatorOnly = salesLeads.body?.data?.some(item => item.id === operatorLeadResult.lead.id)
  assertCase('LN-009', '销售列表可见自己的线索且不可见运营私有线索', salesLeads.status === 200 && salesCanSeeOwn && !salesCanSeeOperatorOnly, {
    statusCode: salesLeads.status,
    ms: salesLeads.ms,
    ownVisible: salesCanSeeOwn,
    operatorOnlyVisible: salesCanSeeOperatorOnly,
  })

  const dueDate = isoMinutesFromNow(120).slice(0, 16)
  const reminder = await fetchJson('/api/todos', {
    method: 'POST',
    session: sessions.sales,
    body: {
      assigned_to: sessionUserId(sessions.operator),
      title: `协助处理线索：${flowLead.report_number || flowLead.id}`,
      description: `销售请求运营协助处理该线索，验收 ${runId}`,
      priority: 'high',
      entity_type: 'lead',
      entity_id: flowLead.id,
      due_date: dueDate,
    },
  })
  assertCase('LN-010', '销售可针对自己线索催促负责运营', reminder.status === 201 && reminder.body?.data?.assigned_to === sessionUserId(sessions.operator), {
    statusCode: reminder.status,
    ms: reminder.ms,
    body: reminder.text.slice(0, 300),
    todoId: reminder.body?.data?.id,
  })
  artifacts.operatorReminderTodoId = reminder.body?.data?.id

  const operatorTodos = await fetchJson('/api/todos?from=0&to=49', { session: sessions.operator })
  const operatorSeesReminder = operatorTodos.body?.data?.some(item => item.id === reminder.body?.data?.id)
  assertCase('LN-010', '运营待办列表可见销售催促待办', operatorTodos.status === 200 && operatorSeesReminder, {
    statusCode: operatorTodos.status,
    ms: operatorTodos.ms,
    todoId: reminder.body?.data?.id,
  })

  const reminderForUnownedLead = await fetchJson('/api/todos', {
    method: 'POST',
    session: sessions.sales,
    body: {
      assigned_to: sessionUserId(sessions.operator),
      title: `越权催促线索：${operatorLeadResult.lead.report_number || operatorLeadResult.lead.id}`,
      description: `销售不应催促非自己负责线索 ${runId}`,
      priority: 'high',
      entity_type: 'lead',
      entity_id: operatorLeadResult.lead.id,
      due_date: dueDate,
    },
  })
  assertCase('LN-010', '销售不能催促非自己负责线索的运营', reminderForUnownedLead.status === 403, {
    statusCode: reminderForUnownedLead.status,
    ms: reminderForUnownedLead.ms,
    body: reminderForUnownedLead.text.slice(0, 300),
  })

  const chatUpload = await uploadFile(sessions.operator, {
    bucket: 'chat-screenshots',
    filename: `聊天截图-${runId}.png`,
    size: 512 * 1024,
  })
  assertCase('LN-002', '聊天截图支持中文文件名 PNG 上传', chatUpload.status === 200 && chatUpload.body?.url, {
    statusCode: chatUpload.status,
    ms: chatUpload.ms,
    body: chatUpload.text.slice(0, 300),
  })
  artifacts.chatScreenshotUrl = chatUpload.body?.url

  const paymentUpload = await uploadFile(sessions.sales, {
    bucket: 'payment-proofs',
    filename: `付款凭证-${runId}-10MB.png`,
    size: 10 * MB,
  })
  assertCase('ST-004', '付款凭证支持 10MB 图片上传', paymentUpload.status === 200 && paymentUpload.body?.url, {
    statusCode: paymentUpload.status,
    ms: paymentUpload.ms,
    body: paymentUpload.text.slice(0, 300),
  })
  artifacts.paymentProofUrl = paymentUpload.body?.url

  const oversizedPayment = await uploadFile(sessions.sales, {
    bucket: 'payment-proofs',
    filename: `付款凭证-${runId}-21MB.png`,
    size: 21 * MB,
  })
  assertCase('LN-031', '付款凭证超过 20MB 时被服务端拒绝并返回明确错误', oversizedPayment.status === 400, {
    statusCode: oversizedPayment.status,
    ms: oversizedPayment.ms,
    body: oversizedPayment.text.slice(0, 300),
  })

  const noSourceTrial = await fetchJson('/api/trial-lessons', {
    method: 'POST',
    session: sessions.sales,
    body: {
      ...trialPayload(flowLead, paymentUpload.body.url, 'no-source'),
      lead_id: undefined,
    },
  })
  assertCase('ST-005', '创建试听必须关联线索或正式生', noSourceTrial.status === 400, {
    statusCode: noSourceTrial.status,
    ms: noSourceTrial.ms,
    body: noSourceTrial.text.slice(0, 300),
  })

  const inaccessibleTrial = await fetchJson('/api/trial-lessons', {
    method: 'POST',
    session: sessions.sales,
    body: trialPayload(operatorLeadResult.lead, paymentUpload.body.url, 'inaccessible', {
      assigned_consultant: sessions.sales.profile?.name || '销售001',
    }),
  })
  assertCase('LN-016', '销售不能用不可访问线索创建试听', inaccessibleTrial.status === 403, {
    statusCode: inaccessibleTrial.status,
    ms: inaccessibleTrial.ms,
    body: inaccessibleTrial.text.slice(0, 300),
  })

  const trialCreate = await fetchJson('/api/trial-lessons', {
    method: 'POST',
    session: sessions.sales,
    body: trialPayload(flowLead, paymentUpload.body.url, 'main', {
      assigned_consultant: sessions.sales.profile?.name || '销售001',
    }),
  })
  const trial = trialCreate.body?.data
  assertCase('LN-011', '销售可从自己线索创建试听', trialCreate.status === 201 && trial?.id && trial.lead_id === flowLead.id, {
    statusCode: trialCreate.status,
    ms: trialCreate.ms,
    body: trialCreate.text.slice(0, 300),
    trialLessonId: trial?.id,
  })
  artifacts.trialLessonId = trial?.id

  assertCase('LN-013', '试听保留来源线索和渠道信息', trial?.lead_id === flowLead.id && trial?.channel === (flowLead.channel_platform || `验收渠道-${runId}`), {
    trialLessonId: trial?.id,
    leadId: trial?.lead_id,
    channel: trial?.channel,
    expectedChannel: flowLead.channel_platform || `验收渠道-${runId}`,
  })

  assertCase('LN-012', '试听创建后记录 ClassIn 学生同步状态', Boolean(
    trial?.classin_student_uid ||
    trial?.classin_student_bound ||
    trial?.classin_student_error === '创建 ClassIn 学生账号失败'
  ), {
    trialLessonId: trial?.id,
    hasClassInStudentUid: Boolean(trial?.classin_student_uid),
    classinStudentBound: Boolean(trial?.classin_student_bound),
    classinStudentError: trial?.classin_student_error || '',
  })

  const duplicateTrial = await fetchJson('/api/trial-lessons', {
    method: 'POST',
    session: sessions.sales,
    body: trialPayload(flowLead, paymentUpload.body.url, 'duplicate', {
      assigned_consultant: sessions.sales.profile?.name || '销售001',
    }),
  })
  assertCase('LN-014', '同一线索不能重复创建试听', duplicateTrial.status === 409, {
    statusCode: duplicateTrial.status,
    ms: duplicateTrial.ms,
    body: duplicateTrial.text.slice(0, 300),
  })

  const salesTrialList = await fetchJson('/api/trial-lessons?from=0&to=49', { session: sessions.sales })
  const salesSeesTrial = salesTrialList.body?.data?.some(item => item.id === trial.id)
  assertCase('LN-017', '销售试听列表可见自己创建的试听', salesTrialList.status === 200 && salesSeesTrial, {
    statusCode: salesTrialList.status,
    ms: salesTrialList.ms,
    trialLessonId: trial.id,
  })

  const changeTrialLead = await fetchJson('/api/trial-lessons', {
    method: 'PUT',
    session: sessions.sales,
    body: {
      id: trial.id,
      lead_id: operatorLeadResult.lead.id,
    },
  })
  assertCase('LN-017', '试听创建后来源线索不可修改', changeTrialLead.status === 400, {
    statusCode: changeTrialLead.status,
    ms: changeTrialLead.ms,
    body: changeTrialLead.text.slice(0, 300),
  })

  const leadsAfterTrial = await getLeads(sessions.sales)
  const convertedLead = leadsAfterTrial.body?.data?.find(item => item.id === flowLead.id)
  assertCase('LN-014', '创建试听后线索状态同步为已添加/试听', leadsAfterTrial.status === 200 && convertedLead?.add_status === 'added' && (convertedLead?.conversion_status === 'trial' || convertedLead?.convert_status === 'trial'), {
    statusCode: leadsAfterTrial.status,
    ms: leadsAfterTrial.ms,
    leadId: flowLead.id,
    addStatus: convertedLead?.add_status,
    conversionStatus: convertedLead?.conversion_status,
    convertStatus: convertedLead?.convert_status,
  })

  const endedAt = new Date().toISOString()
  const { summary, jsonPath, mdPath } = writeReports(startedAt, endedAt)

  console.log(JSON.stringify({ summary, jsonPath, mdPath }, null, 2))
  if (summary.failed > 0) {
    process.exitCode = 1
  }
}

main().catch(error => {
  const endedAt = new Date().toISOString()
  record('SCRIPT', '脚本执行异常', false, {
    error: error?.message || String(error),
  })
  const { summary, jsonPath, mdPath } = writeReports(new Date().toISOString(), endedAt)
  console.error(JSON.stringify({ summary, jsonPath, mdPath, error: error?.stack || String(error) }, null, 2))
  process.exitCode = 1
})
