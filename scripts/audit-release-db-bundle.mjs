#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const reportDirArg = args.find(arg => arg.startsWith('--report-dir='))
const bundlePathArg = args.find(arg => arg.startsWith('--path='))
const reportRoot = path.resolve(root, reportDirArg?.slice('--report-dir='.length) || '.gstack/qa-reports')
const bundlePath = path.resolve(
  root,
  bundlePathArg?.slice('--path='.length) || `.gstack/qa-reports/release-db-production-bundle-${today}.sql`,
)
const outputJson = path.join(reportRoot, `release-db-bundle-audit-${today}.json`)
const outputMd = path.join(reportRoot, `release-db-bundle-audit-${today}.md`)

const requiredMigrationSources = [
  'supabase/migrations/046_add_class_student_participation.sql',
  'supabase/migrations/071_create_quality_reports.sql',
  'supabase/migrations/072_lock_down_anon_business_tables.sql',
]

const requiredTables = [
  'admin_operation_logs',
  'class_classin',
  'class_session_statistics',
  'class_sessions',
  'class_student_participation',
  'classin_callback_events',
  'classroom_classin',
  'courses',
  'daily_leads',
  'formal_orders',
  'leads',
  'quality_reports',
  'student_status_history',
  'students',
  'students_classin',
  'sys_dictionaries',
  'teacher_candidates',
  'teacher_classin',
  'teacher_details',
  'teacher_exception_events',
  'teacher_exceptions',
  'teacher_profiles',
  'teachers',
  'todos',
  'transaction_records',
  'transaction_workflow_events',
  'trial_lessons',
  'user_profiles',
  'visit_records',
  'wechat_accounts',
]

const secretPatterns = [
  {
    id: 'jwt',
    label: 'Compact JWT-like token',
    pattern: /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
  },
  {
    id: 'authorization-bearer',
    label: 'Authorization bearer token',
    pattern: /\bauthorization\s*:\s*bearer\s+(?!\[redacted\])[A-Za-z0-9._-]{20,}/i,
  },
  {
    id: 'url-password',
    label: 'Postgres URL with inline password',
    pattern: /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/i,
  },
  {
    id: 'password-value',
    label: 'Inline password-like value',
    pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s,;`]{6,}/i,
  },
]

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length
}

function lineOf(text, needle) {
  const index = text.indexOf(needle)
  if (index < 0) return null
  return text.slice(0, index).split(/\r?\n/).length
}

function addFinding(findings, rule, message, line = null) {
  findings.push({
    rule,
    message,
    line,
  })
}

function auditBundle(sql) {
  const findings = []

  for (const source of requiredMigrationSources) {
    const sourceMarker = `-- Source: ${source}`
    if (!sql.includes(sourceMarker)) {
      addFinding(findings, 'missing-migration-source', `Missing migration source marker: ${source}`)
    }
  }

  const sourcePositions = requiredMigrationSources.map(source => sql.indexOf(`-- Source: ${source}`))
  if (sourcePositions.every(position => position >= 0)) {
    const sorted = [...sourcePositions].sort((a, b) => a - b)
    if (sourcePositions.some((position, index) => position !== sorted[index])) {
      addFinding(findings, 'migration-order', 'Release migrations are not ordered as 046, 071, 072.')
    }
  }

  const assertionMarker = '-- Source: release database assertions'
  const reloadMarker = '-- Source: PostgREST schema cache reload'
  const assertionStart = sql.indexOf(assertionMarker)
  const reloadStart = sql.indexOf(reloadMarker)

  if (assertionStart < 0) {
    addFinding(findings, 'missing-assertions', 'Missing release database assertion block.')
  }

  if (reloadStart < 0) {
    addFinding(findings, 'missing-schema-cache-reload', 'Missing PostgREST schema cache reload section.')
  }

  if (assertionStart >= 0 && reloadStart >= 0 && assertionStart > reloadStart) {
    addFinding(findings, 'assertion-order', 'Release assertions must run before the PostgREST schema cache reload.')
  }

  if (!sql.includes("NOTIFY pgrst, 'reload schema';")) {
    addFinding(findings, 'missing-notify', "Missing exact schema cache reload statement: NOTIFY pgrst, 'reload schema';")
  }

  if (assertionStart >= 0 && reloadStart > assertionStart) {
    const assertionSql = sql.slice(assertionStart, reloadStart)
    const assertionDoCount = countMatches(assertionSql, /\bDO\s+\$\$/g)
    const assertionEndCount = countMatches(assertionSql, /\bEND\s+\$\$;/g)

    if (assertionDoCount !== 1) {
      addFinding(findings, 'assertion-do-count', `Expected exactly one DO $$ in release assertions, found ${assertionDoCount}.`, lineOf(sql, assertionMarker))
    }

    if (assertionEndCount !== 1) {
      addFinding(findings, 'assertion-end-count', `Expected exactly one END $$; in release assertions, found ${assertionEndCount}.`, lineOf(sql, assertionMarker))
    }

    for (const table of requiredTables) {
      if (!assertionSql.includes(`('${table}')`)) {
        addFinding(findings, 'missing-required-table-assertion', `Missing required table assertion entry: ${table}`, lineOf(sql, assertionMarker))
      }
    }

    for (const phrase of [
      'missing required public tables',
      'RLS disabled on required tables',
      'anon/PUBLIC SELECT grants remain on required tables',
    ]) {
      if (!assertionSql.includes(phrase)) {
        addFinding(findings, 'missing-assertion-condition', `Missing assertion condition: ${phrase}`, lineOf(sql, assertionMarker))
      }
    }
  }

  const lines = sql.split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    for (const pattern of secretPatterns) {
      if (!pattern.pattern.test(line)) continue
      addFinding(findings, pattern.id, pattern.label, index + 1)
    }
  }

  return findings
}

function writeReport(payload) {
  fs.mkdirSync(reportRoot, { recursive: true })
  fs.writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`)

  const findingLines = payload.findings.length === 0
    ? ['- None']
    : payload.findings.map(finding => (
      `- ${finding.line ? `line ${finding.line}: ` : ''}[${finding.rule}] ${finding.message}`
    ))

  fs.writeFileSync(outputMd, [
    `# Release DB Bundle Audit - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Bundle: ${path.relative(root, bundlePath)}`,
    `- Findings: ${payload.summary.findings}`,
    `- Required migration sources: ${payload.summary.requiredMigrationSources}`,
    `- Required table assertions: ${payload.summary.requiredTables}`,
    '',
    '## Findings',
    '',
    ...findingLines,
    '',
  ].join('\n'))
}

function main() {
  const findings = []

  if (!fs.existsSync(bundlePath)) {
    addFinding(findings, 'missing-bundle', `Release DB bundle does not exist: ${path.relative(root, bundlePath)}`)
  } else {
    findings.push(...auditBundle(fs.readFileSync(bundlePath, 'utf8')))
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    status: findings.length === 0 ? 'pass' : 'fail',
    bundle: path.relative(root, bundlePath),
    summary: {
      findings: findings.length,
      requiredMigrationSources: requiredMigrationSources.length,
      requiredTables: requiredTables.length,
    },
    findings,
  }

  writeReport(payload)

  if (payload.status === 'pass') {
    console.log(`Release DB bundle audit passed: ${path.relative(root, bundlePath)}`)
    console.log(`Report: ${path.relative(root, outputMd)}`)
    console.log(`JSON: ${path.relative(root, outputJson)}`)
    return
  }

  console.error(`Release DB bundle audit failed. Findings: ${findings.length}`)
  console.error(`Report: ${path.relative(root, outputMd)}`)
  console.error(`JSON: ${path.relative(root, outputJson)}`)
  process.exit(1)
}

main()
