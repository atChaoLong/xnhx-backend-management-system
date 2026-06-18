#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASE_URL = process.env.BASE_URL || 'https://xiaoniuhaoxue.paitongai.cn'
const REPORT_DIR = path.join(ROOT, '.gstack', 'qa-reports')
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000)

const ACCOUNTS = {
  operator: { username: 'yy001', password: process.env.XNHX_OPERATOR_PASSWORD },
  sales: { username: 'xs001', password: process.env.XNHX_SALES_PASSWORD },
  head_teacher: { username: 'bzr001', password: process.env.XNHX_HEAD_TEACHER_PASSWORD },
  academic_affairs: { username: 'jw001', password: process.env.XNHX_ACADEMIC_AFFAIRS_PASSWORD },
  admin: { username: 'admin', password: process.env.XNHX_ADMIN_PASSWORD },
}

const runId = `DEEP-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
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

async function fetchJson(pathname, { method = 'GET', session, body, accept = 'application/json' } = {}) {
  return withTimeout(async signal => {
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

function expectCase(id, title, condition, detail = {}) {
  record(id, title, Boolean(condition), detail)
  return Boolean(condition)
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
    channel_platform: `深度验收渠道-${runId}`,
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

function trialPayload(lead, seed, overrides = {}) {
  return {
    lead_id: lead.id,
    child_name: `深验学生${seed}`,
    region: 'beijing',
    grade: 'p3',
    trial_subject: 'math',
    trial_time: dateOffset(-2),
    trial_duration: 60,
    phone: phoneFromSeed(`${Date.now()}${seed}`),
    channel: lead.channel_platform || `深度验收渠道-${runId}`,
    trial_amount: 1,
    payment_proof: `https://example.com/payment-proof-${runId}-${seed}.png`,
    urgency_level: 'medium',
    notes: `线上深度验收 ${runId}`,
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
      name: `深验老师${runId.slice(-6)}`,
      gender: 'female',
      wechat: `teacher_wx_${runId}`,
      classin_phone: phoneFromSeed(seed),
      location: 'beijing',
      subjects: ['math'],
      grade_levels: ['p3'],
      education: '本科',
      university: '深度验收大学',
      teacher_level: 'A',
      status: 'active',
      notes: `线上深度验收 ${runId}`,
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
    payment_proof: `https://example.com/formal-order-proof-${runId}.png`,
    payment_time: new Date().toISOString(),
    order_notes: `线上深度验收 ${runId}`,
    ...overrides,
  }
}

async function writeReports(startedAt, endedAt) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
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

  const today = new Date().toISOString().slice(0, 10)
  const jsonPath = path.join(REPORT_DIR, `online-deep-acceptance-${today}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, cases }, null, 2))

  const lines = [
    `# 线上深度验收报告 ${today}`,
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
      const detail = item.message || item.error || item.note || item.body || item.artifact || ''
      return `| ${item.status === 'PASS' ? 'PASS' : 'FAIL'} | ${item.id} | ${item.title} | ${http} | ${String(detail).replaceAll('|', '\\|').slice(0, 260)} |`
    }),
  ]

  const mdPath = path.join(REPORT_DIR, `online-deep-acceptance-${today}.md`)
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`)

  return { summary, jsonPath, mdPath }
}

async function main() {
  const startedAt = new Date().toISOString()
  const sessions = {}

  try {
    for (const role of Object.keys(ACCOUNTS)) {
      sessions[role] = await signIn(role)
      record('AUTH', `${role} 登录`, true, {
        statusCode: 200,
        profileRole: sessions[role].profile?.role ?? sessions[role].user?.role,
      })
    }

    const teacherCreate = await createTeacher(sessions.admin)
    const teacher = teacherCreate.body?.data
    artifacts.teacherId = teacher?.id
    artifacts.teacherName = teacher?.name
    expectCase('ST-018', '管理员可创建老师库存记录', teacherCreate.status === 201 && teacher?.id, {
      statusCode: teacherCreate.status,
      ms: teacherCreate.ms,
      body: teacherCreate.text.slice(0, 300),
    })

    if (teacher?.id) {
      const teacherForSales = await fetchJson(`/api/teachers?id=${teacher.id}`, { session: sessions.sales })
      expectCase('ST-018', '销售查看老师时敏感联系方式被脱敏', teacherForSales.status === 200 && !teacherForSales.body?.data?.wechat && !teacherForSales.body?.data?.classin_phone, {
        statusCode: teacherForSales.status,
        ms: teacherForSales.ms,
        body: teacherForSales.text.slice(0, 300),
      })

      const teacherUpdate = await fetchJson('/api/teachers', {
        method: 'PUT',
        session: sessions.academic_affairs,
        body: {
          id: teacher.id,
          teacher_level: 'S',
          status: 'active',
          notes: `教务更新库存状态 ${runId}`,
        },
      })
      expectCase('LN-027', '教务可调整老师库存等级和状态', teacherUpdate.status === 200 && teacherUpdate.body?.data?.teacher_level === 'S', {
        statusCode: teacherUpdate.status,
        ms: teacherUpdate.ms,
        body: teacherUpdate.text.slice(0, 300),
      })
    }

    const invalidTeacherLeadResult = await createLead(sessions.sales, 'invalid-teacher', {
      operator_id: sessionUserId(sessions.operator),
    })
    const invalidTeacherTrial = invalidTeacherLeadResult.lead
      ? await fetchJson('/api/trial-lessons', {
        method: 'POST',
        session: sessions.sales,
        body: trialPayload(invalidTeacherLeadResult.lead, 'invalid-teacher', {
          matched_teacher: `不存在老师-${runId}`,
        }),
      })
      : null
    expectCase('LN-015', '试听匹配老师不能提交不存在老师', invalidTeacherTrial?.status === 400, {
      statusCode: invalidTeacherTrial?.status,
      ms: invalidTeacherTrial?.ms,
      body: invalidTeacherTrial?.text?.slice(0, 300) || invalidTeacherLeadResult.response.text.slice(0, 300),
    })

    const leadResult = await createLead(sessions.sales, 'formal-flow', {
      operator_id: sessionUserId(sessions.operator),
    })
    const lead = leadResult.lead
    artifacts.formalLeadId = lead?.id
    expectCase('LN-018', '销售创建正式订单前置线索成功', leadResult.response.status === 200 && lead?.id, {
      statusCode: leadResult.response.status,
      ms: leadResult.response.ms,
      body: leadResult.response.text.slice(0, 300),
    })

    let trial
    if (lead?.id) {
      const trialCreate = await fetchJson('/api/trial-lessons', {
        method: 'POST',
        session: sessions.sales,
        body: trialPayload(lead, 'formal-flow', {
          matched_teacher: teacher?.name,
          confirmed_teacher: teacher?.name,
          class_link: `https://example.com/classroom-${runId}`,
        }),
      })
      trial = trialCreate.body?.data
      artifacts.trialLessonId = trial?.id
      expectCase('LN-018', '销售可创建已过试听用于转正式订单', trialCreate.status === 201 && trial?.id, {
        statusCode: trialCreate.status,
        ms: trialCreate.ms,
        body: trialCreate.text.slice(0, 300),
      })
    }

    let order
    if (lead?.id && trial?.id && teacher?.name) {
      const orderCreate = await fetchJson('/api/formal-orders', {
        method: 'POST',
        session: sessions.sales,
        body: formalOrderPayload({ trial, lead, teacherName: teacher.name }),
      })
      order = orderCreate.body?.data
      artifacts.formalOrderId = order?.id
      artifacts.studentId = order?.student_id
      expectCase('LN-018', '试听转正式订单自动关联/生成学生档案', orderCreate.status === 201 && order?.id && order?.student_id && order?.trial_lesson_id === trial.id, {
        statusCode: orderCreate.status,
        ms: orderCreate.ms,
        body: orderCreate.text.slice(0, 300),
      })

      const duplicateOrder = await fetchJson('/api/formal-orders', {
        method: 'POST',
        session: sessions.sales,
        body: formalOrderPayload({ trial, lead, teacherName: teacher.name }),
      })
      expectCase('LN-018', '同一试听不能重复转正式订单', duplicateOrder.status === 400, {
        statusCode: duplicateOrder.status,
        ms: duplicateOrder.ms,
        body: duplicateOrder.text.slice(0, 300),
      })
    }

    if (order?.id && teacher?.name) {
      const salesOrderDetail = await fetchJson(`/api/formal-orders?id=${order.id}`, { session: sessions.sales })
      expectCase('LN-019', '销售查看正式订单时付款凭证被脱敏', salesOrderDetail.status === 200 && salesOrderDetail.body?.data?.payment_proof === null, {
        statusCode: salesOrderDetail.status,
        ms: salesOrderDetail.ms,
        body: salesOrderDetail.text.slice(0, 300),
      })

      const academicOrderDetail = await fetchJson(`/api/formal-orders?id=${order.id}`, { session: sessions.academic_affairs })
      expectCase('LN-019', '教务查看正式订单保留付款凭证', academicOrderDetail.status === 200 && Boolean(academicOrderDetail.body?.data?.payment_proof), {
        statusCode: academicOrderDetail.status,
        ms: academicOrderDetail.ms,
        body: academicOrderDetail.text.slice(0, 300),
      })

      const salesFinancialEdit = await fetchJson('/api/formal-orders', {
        method: 'PUT',
        session: sessions.sales,
        body: {
          id: order.id,
          payment_amount: 9999,
        },
      })
      expectCase('LN-019', '销售不能修改正式订单财务核心字段', salesFinancialEdit.status === 403, {
        statusCode: salesFinancialEdit.status,
        ms: salesFinancialEdit.ms,
        body: salesFinancialEdit.text.slice(0, 300),
      })

      const immutableEdit = await fetchJson('/api/formal-orders', {
        method: 'PUT',
        session: sessions.admin,
        body: {
          id: order.id,
          trial_lesson_id: '00000000-0000-0000-0000-000000000000',
        },
      })
      expectCase('LN-019', '正式订单来源试听字段不可被后续修改', immutableEdit.status === 400, {
        statusCode: immutableEdit.status,
        ms: immutableEdit.ms,
        body: immutableEdit.text.slice(0, 300),
      })

      const extendOrder = await fetchJson('/api/formal-orders', {
        method: 'POST',
        session: sessions.sales,
        body: formalOrderPayload({
          trial,
          lead,
          teacherName: teacher.name,
          previousOrderId: order.id,
          overrides: {
            total_hours: 5,
            payment_amount: 500,
            order_notes: `扩科/续费验收 ${runId}`,
          },
        }),
      })
      expectCase('ST-006', '销售可基于原正式订单创建扩科/续费订单', extendOrder.status === 201 && extendOrder.body?.data?.previous_order_id === order.id, {
        statusCode: extendOrder.status,
        ms: extendOrder.ms,
        body: extendOrder.text.slice(0, 300),
      })

      const excessiveRefund = await fetchJson('/api/transactions', {
        method: 'POST',
        session: sessions.academic_affairs,
        body: {
          creation_date: new Date().toISOString().slice(0, 10),
          student_id: order.student_id,
          order_id: order.id,
          student_name: order.student_name,
          course_name: '数学',
          teacher_name: teacher.name,
          transaction_type: '退费',
          remaining_duration: 999,
          refund_amount: 999999,
          unit_price: 100,
          refund_reason: `超额退费验收 ${runId}`,
        },
      })
      expectCase('LN-020', '超额退费金额/课时被服务端拒绝', excessiveRefund.status === 400, {
        statusCode: excessiveRefund.status,
        ms: excessiveRefund.ms,
        body: excessiveRefund.text.slice(0, 300),
      })
    }

    const candidateCreate = await fetchJson('/api/teacher-candidates', {
      method: 'POST',
      session: sessions.admin,
      body: {
        name: `深验候选老师${runId.slice(-6)}`,
        wechat_id: `candidate_wx_${runId}`,
        phone: phoneFromSeed(Date.now()),
        subjects_taught: ['math'],
        grade_level: 'p3',
        video_recording_url: `https://example.com/interview-video-${runId}.mp4`,
        recruitment_step: 'teaching_review',
        recruitment_status: 'pending_teaching_review',
      },
    })
    const candidate = candidateCreate.body?.data
    artifacts.teacherCandidateId = candidate?.id
    expectCase('LN-023', '管理员可创建招师候选人记录', candidateCreate.status === 201 && candidate?.id, {
      statusCode: candidateCreate.status,
      ms: candidateCreate.ms,
      body: candidateCreate.text.slice(0, 300),
    })

    const salesCandidateList = await fetchJson('/api/teacher-candidates?from=0&to=0', { session: sessions.sales })
    expectCase('LN-023', '销售不能访问招师候选人列表', salesCandidateList.status === 403, {
      statusCode: salesCandidateList.status,
      ms: salesCandidateList.ms,
      body: salesCandidateList.text.slice(0, 300),
    })

    if (candidate?.id) {
      const academicReview = await fetchJson('/api/teacher-candidates', {
        method: 'PUT',
        session: sessions.academic_affairs,
        body: {
          id: candidate.id,
          review_status: '已复核',
          review_result: '通过',
          review_notes: `教务复核通过 ${runId}`,
          teacher_level: 'A',
          approved_hourly_rate: 120,
        },
      })
      expectCase('LN-024', '教务可复核招师面试记录', academicReview.status === 200 && academicReview.body?.data?.review_result === '通过', {
        statusCode: academicReview.status,
        ms: academicReview.ms,
        body: academicReview.text.slice(0, 300),
      })

      const toSalary = await fetchJson('/api/teacher-candidates/recruitment-flow', {
        method: 'PUT',
        session: sessions.academic_affairs,
        body: {
          id: candidate.id,
          recruitment_step: 'salary_negotiation',
        },
      })
      expectCase('LN-024', '教务可将已复核候选人推进到谈薪', toSalary.status === 200 && toSalary.body?.data?.recruitment_step === 'salary_negotiation', {
        statusCode: toSalary.status,
        ms: toSalary.ms,
        body: toSalary.text.slice(0, 300),
      })

      const toEntry = await fetchJson('/api/teacher-candidates/recruitment-flow', {
        method: 'PUT',
        session: sessions.academic_affairs,
        body: {
          id: candidate.id,
          recruitment_step: 'final_entry',
        },
      })
      expectCase('LN-026', '教务可完成候选老师入库流转', toEntry.status === 200 && toEntry.body?.data?.is_hired === true, {
        statusCode: toEntry.status,
        ms: toEntry.ms,
        body: toEntry.text.slice(0, 300),
      })
    }

    const exportCsv = await fetchJson('/api/class-sessions/export?start_date=2026-06-01&end_date=2026-06-30', {
      session: sessions.academic_affairs,
      accept: 'text/csv,application/json',
    })
    expectCase('ST-019', '教务可导出课表 CSV', exportCsv.status === 200 && exportCsv.text.includes('学生'), {
      statusCode: exportCsv.status,
      ms: exportCsv.ms,
      body: exportCsv.text.slice(0, 300),
    })

    const salesExportCsv = await fetchJson('/api/class-sessions/export?start_date=2026-06-01&end_date=2026-06-30', {
      session: sessions.sales,
      accept: 'text/csv,application/json',
    })
    expectCase('ST-019', '销售不能导出课表 CSV', salesExportCsv.status === 403, {
      statusCode: salesExportCsv.status,
      ms: salesExportCsv.ms,
      body: salesExportCsv.text.slice(0, 300),
    })

    const endedAt = new Date().toISOString()
    const { summary, jsonPath, mdPath } = await writeReports(startedAt, endedAt)
    console.log(JSON.stringify({ summary, jsonPath, mdPath }, null, 2))
    if (summary.failed > 0) process.exitCode = 1
  } catch (error) {
    record('SCRIPT', '脚本执行异常', false, {
      error: error?.message || String(error),
    })
    const endedAt = new Date().toISOString()
    const { summary, jsonPath, mdPath } = await writeReports(startedAt, endedAt)
    console.error(JSON.stringify({ summary, jsonPath, mdPath, error: error?.stack || String(error) }, null, 2))
    process.exitCode = 1
  }
}

main()
