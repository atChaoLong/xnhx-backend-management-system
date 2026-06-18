#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const reportDirArg = args.find(arg => arg.startsWith('--report-dir='))
const envFileArg = args.find(arg => arg.startsWith('--env-file='))
const reportRoot = path.resolve(root, reportDirArg?.slice('--report-dir='.length) || '.gstack/qa-reports')
const envFile = envFileArg?.slice('--env-file='.length) || '.env.production.local'
const outputMd = path.join(reportRoot, `release-db-handoff-${today}.md`)
const outputJson = path.join(reportRoot, `release-db-handoff-${today}.json`)

const dbCredentialEnv = [
  'XNHX_SUPABASE_DB_URL',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'XNHX_SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_PASSWORD',
]

const onlinePasswordEnv = [
  'XNHX_OPERATOR_PASSWORD',
  'XNHX_SALES_PASSWORD',
  'XNHX_HEAD_TEACHER_PASSWORD',
  'XNHX_ACADEMIC_AFFAIRS_PASSWORD',
  'XNHX_ADMIN_PASSWORD',
]

function readTextIfExists(relativePath) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) return null
  return fs.readFileSync(fullPath, 'utf8').trim()
}

function readJson(relativePath, fallback = null) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) return fallback
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
}

function readEnvKeys(relativePath) {
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) return new Set()

  const keys = new Set()
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
    if (match) keys.add(match[1])
  }
  return keys
}

function fileInfo(relativePath) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) {
    return {
      path: relativePath,
      exists: false,
      lines: 0,
      bytes: 0,
    }
  }

  const text = fs.readFileSync(fullPath, 'utf8')
  return {
    path: relativePath,
    exists: true,
    lines: text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0),
    bytes: Buffer.byteLength(text),
  }
}

function listOrNone(values) {
  return values.length > 0 ? values.join(', ') : 'none'
}

function npmCommand(script, extraArgs = []) {
  const args = envFile ? [`--env-file=${envFile}`, ...extraArgs] : extraArgs
  return args.length > 0
    ? `npm run ${script} -- ${args.join(' ')}`
    : `npm run ${script}`
}

function inspectSupabaseCliLink() {
  const projectRef = readTextIfExists('supabase/.temp/project-ref')
  const poolerUrl = readTextIfExists('supabase/.temp/pooler-url')
  const result = {
    linked: Boolean(projectRef),
    projectRef: projectRef || null,
    poolerUrlPresent: Boolean(poolerUrl),
    poolerHost: null,
    poolerPort: null,
    poolerHasUsername: false,
    poolerHasPassword: false,
  }

  if (!poolerUrl) return result

  try {
    const parsed = new URL(poolerUrl)
    result.poolerHost = parsed.hostname
    result.poolerPort = parsed.port || null
    result.poolerHasUsername = Boolean(parsed.username)
    result.poolerHasPassword = Boolean(parsed.password)
  } catch {
    result.poolerHost = 'invalid-url'
  }

  return result
}

function main() {
  const unblock = readJson(`.gstack/qa-reports/release-unblock-status-${today}.json`, {})
  const gate = readJson(`.gstack/qa-reports/release-gate-${today}.json`, {})
  const envKeys = readEnvKeys(envFile)
  const supabaseCliLink = inspectSupabaseCliLink()

  const sqlBundle = unblock.artifacts?.sqlBundle?.path || `.gstack/qa-reports/release-db-production-bundle-${today}.sql`
  const dbRunbook = unblock.artifacts?.dbRunbook?.path || `.gstack/qa-reports/release-db-operator-runbook-${today}.md`
  const onlineReport = unblock.artifacts?.onlineRegressionReport?.path || `.gstack/qa-reports/online-release-regression-${today}.md`
  const bundleAudit = `.gstack/qa-reports/release-db-bundle-audit-${today}.md`
  const releaseGateSummary = gate.summary || unblock.releaseGate?.summary || {}
  const rls = unblock.rls || {}
  const envReadiness = unblock.envReadiness || {}
  const gateEvidence = unblock.gateEvidence || {}

  const dbCredentialPresence = dbCredentialEnv.map(key => ({
    key,
    presentInProcess: Boolean(process.env[key]),
    presentInEnvFile: envKeys.has(key),
  }))
  const onlinePasswordPresence = onlinePasswordEnv.map(key => ({
    key,
    presentInProcess: Boolean(process.env[key]),
    presentInEnvFile: envKeys.has(key),
  }))

  const payload = {
    generatedAt: new Date().toISOString(),
    status: unblock.status || gate.status || 'unknown',
    formalReleaseGap: unblock.releaseReadiness?.formalReleaseGap || 'about 3%-4%',
    releaseGate: {
      passed: releaseGateSummary.passed ?? null,
      failed: releaseGateSummary.failed ?? null,
      skipped: releaseGateSummary.skipped ?? null,
      blockingSteps: unblock.releaseGate?.blockingSteps || [],
    },
    gateEvidence,
    rls: {
      status: rls.status || 'unknown',
      failures: rls.failures ?? null,
      warnings: rls.warnings ?? null,
      anonReadableTables: rls.anonReadableTables || [],
      schemaMissingTables: rls.schemaMissingTables || [],
    },
    artifacts: {
      sqlBundle: fileInfo(sqlBundle),
      dbRunbook: fileInfo(dbRunbook),
      bundleAudit: fileInfo(bundleAudit),
      onlineReport: fileInfo(onlineReport),
    },
    readiness: {
      directDbReady: Boolean(envReadiness.directDbReady),
      sqlEditorFallbackReady: Boolean(envReadiness.sqlEditorFallbackReady),
      dbCredentialPresence,
      onlinePasswordPresence,
      supabaseCliLink,
    },
    commands: {
      refreshBundle: npmCommand('db:write-rls-release-sql'),
      auditBundle: `npm run audit:release-db-bundle -- --path=${sqlBundle}`,
      quickVerify: npmCommand('release:after-db:quick'),
      waitVerify: npmCommand('release:after-db:wait'),
      finalVerify: npmCommand('release:after-db'),
      directPreflight: npmCommand('db:apply-rls-release', ['--preflight', '--audit']),
      directApply: npmCommand('db:apply-rls-release', ['--audit']),
    },
  }

  fs.mkdirSync(reportRoot, { recursive: true })
  fs.writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`)

  const directDbState = payload.readiness.directDbReady
    ? 'READY'
    : 'NOT READY - no production Postgres URL or DB password is present locally'
  const cliLinkDetail = payload.readiness.supabaseCliLink.linked
    ? `linked to ${payload.readiness.supabaseCliLink.projectRef}; pooler URL ${payload.readiness.supabaseCliLink.poolerUrlPresent ? 'present' : 'missing'}; pooler password ${payload.readiness.supabaseCliLink.poolerHasPassword ? 'present' : 'missing'}`
    : 'not linked'
  const sqlEditorState = payload.readiness.sqlEditorFallbackReady ? 'READY' : 'NOT READY'
  const gateLine = [
    payload.releaseGate.passed ?? '?',
    'PASS /',
    payload.releaseGate.failed ?? '?',
    'FAIL /',
    payload.releaseGate.skipped ?? '?',
    'SKIP',
  ].join(' ')

  const lines = [
    `# Release DB Handoff - ${today}`,
    '',
    '## Decision',
    '',
    `- Formal release gap: ${payload.formalReleaseGap}`,
    `- Current release gate: ${gateLine}`,
    `- Blocking step: ${listOrNone(payload.releaseGate.blockingSteps)}`,
    `- Direct DB apply: ${directDbState}`,
    `- Supabase CLI link: ${cliLinkDetail}`,
    `- SQL Editor fallback: ${sqlEditorState}`,
    '',
    '## Evidence Already Green',
    '',
    `- Release environment audit: ${gateEvidence.releaseEnvironmentAudit || 'unknown'}`,
    `- Online release regression: ${gateEvidence.onlineReleaseRegression || 'unknown'} (${payload.artifacts.onlineReport.path})`,
    `- Release artifacts audit: ${gateEvidence.releaseArtifactsAudit || 'unknown'}`,
    '',
    '## Production DB Change To Run',
    '',
    `- SQL bundle: \`${payload.artifacts.sqlBundle.path}\` (${payload.artifacts.sqlBundle.lines} lines)`,
    `- Bundle audit: \`${payload.artifacts.bundleAudit.path}\``,
    `- Full runbook: \`${payload.artifacts.dbRunbook.path}\``,
    '',
    'Run this before opening Supabase:',
    '',
    '```bash',
    payload.commands.refreshBundle,
    payload.commands.auditBundle,
    '```',
    '',
    'Then open Supabase SQL Editor for project `kjnqtplzylqxiklsnfoa`, paste the full SQL bundle, and run it once.',
    '',
    'Stop immediately if SQL Editor shows a `Release DB assertion failed` exception. Keep the exact assertion text.',
    '',
    '## What This Fixes',
    '',
    `- RLS audit failures: ${payload.rls.failures ?? 'unknown'}`,
    `- Anon-readable business tables: ${payload.rls.anonReadableTables.length} (${listOrNone(payload.rls.anonReadableTables)})`,
    `- Missing/schema-cache tables: ${payload.rls.schemaMissingTables.length} (${listOrNone(payload.rls.schemaMissingTables)})`,
    '',
    '## After SQL Editor Succeeds',
    '',
    '```bash',
    payload.commands.waitVerify,
    '```',
    '',
    'Expected waiting verification result: `READY-FOR-GATE` with `supabase rls audit` passing.',
    '',
    'If the waiting verifier still fails, check the SQL Editor assertion output, then run the quick verifier once for a fresh failure report:',
    '',
    '```bash',
    payload.commands.quickVerify,
    '```',
    '',
    '',
    'Final release sign-off still needs the five online regression passwords injected as one-off process env vars; do not persist them in `.env.production.local`.',
    '',
    '```bash',
    payload.commands.finalVerify,
    '```',
    '',
    'Expected final result: `13 PASS / 0 FAIL / 0 SKIP`.',
    '',
    '## Credential Check',
    '',
    `- DB credential env present locally: ${listOrNone(payload.readiness.dbCredentialPresence.filter(item => item.presentInProcess || item.presentInEnvFile).map(item => item.key))}`,
    `- Online password env persisted locally: ${listOrNone(payload.readiness.onlinePasswordPresence.filter(item => item.presentInEnvFile).map(item => item.key))}`,
    '',
  ]

  fs.writeFileSync(outputMd, `${lines.join('\n')}\n`)

  console.log(`Release DB handoff written: ${path.relative(root, outputMd)}`)
  console.log(`JSON: ${path.relative(root, outputJson)}`)
}

main()
