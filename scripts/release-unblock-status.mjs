#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const envFileArg = args.find(arg => arg.startsWith('--env-file='))
const reportRootArg = args.find(arg => arg.startsWith('--report-dir='))
const defaultEnvFile = existsSync(join(root, '.env.production.local')) ? '.env.production.local' : null
const envFile = envFileArg?.slice('--env-file='.length) || defaultEnvFile
const reportRoot = join(root, reportRootArg?.slice('--report-dir='.length) || '.gstack/qa-reports')
const outputJson = join(reportRoot, `release-unblock-status-${today}.json`)
const outputMd = join(reportRoot, `release-unblock-status-${today}.md`)
const knownProductionProjectRef = 'kjnqtplzylqxiklsnfoa'
const quickAfterDbCommand = 'npm run release:after-db:wait -- --env-file=.env.production.local'
const fullAfterDbCommand = 'npm run release:after-db -- --env-file=.env.production.local'

const onlinePasswordEnv = [
  'XNHX_OPERATOR_PASSWORD',
  'XNHX_SALES_PASSWORD',
  'XNHX_HEAD_TEACHER_PASSWORD',
  'XNHX_ACADEMIC_AFFAIRS_PASSWORD',
  'XNHX_ADMIN_PASSWORD',
]

const supabaseAuditEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

const dbUrlEnv = [
  'XNHX_SUPABASE_DB_URL',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
]

const dbPasswordEnv = [
  'XNHX_SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_PASSWORD',
]

const projectRefEnv = [
  'XNHX_SUPABASE_PROJECT_REF',
  'SUPABASE_PROJECT_REF',
]

const envSources = new Map()
for (const key of Object.keys(process.env)) {
  envSources.set(key, 'process env')
}

function resolvePath(value) {
  return isAbsolute(value) ? value : join(root, value)
}

function displayPath(value) {
  return relative(root, value) || value
}

function loadDotEnvFile(value) {
  if (!value) return null

  const envPath = resolvePath(value)
  if (!existsSync(envPath)) {
    return { path: value, loaded: false }
  }

  const label = displayPath(envPath)
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key]) continue

    process.env[key] = rawValue
      .replace(/^(['"])(.*)\1$/, '$2')
      .replace(/\\n/g, '\n')
    envSources.set(key, label)
  }

  return { path: label, loaded: true }
}

const loadedEnv = loadDotEnvFile(envFile)

function hasEnv(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0
}

function firstPresent(keys) {
  return keys.find(hasEnv) || null
}

function sourceFor(key) {
  return hasEnv(key) ? (envSources.get(key) || 'process env') : 'missing'
}

function inferProjectRefFromSupabaseUrl(value) {
  if (!value) return null

  try {
    const hostname = new URL(value).hostname
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

function looksLikeKnownProductionSupabaseUrl(value) {
  if (!value) return false

  try {
    const hostname = new URL(value).hostname
    return hostname.includes(knownProductionProjectRef) ||
      hostname.includes('sbp-76uzx8fjpgfoyx2f') ||
      hostname.includes('supabase.opentrust.net')
  } catch {
    return false
  }
}

function readJsonIfExists(relativePath) {
  const fullPath = join(root, relativePath)
  if (!existsSync(fullPath)) return null

  try {
    return JSON.parse(readFileSync(fullPath, 'utf8'))
  } catch (error) {
    return {
      status: 'unreadable',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function fileInfo(relativePath) {
  const fullPath = join(root, relativePath)
  return {
    path: relativePath,
    exists: existsSync(fullPath),
  }
}

function inferEnvReadiness() {
  const missingOnlinePasswords = onlinePasswordEnv.filter(key => !hasEnv(key))
  const missingSupabaseAudit = supabaseAuditEnv.filter(key => !hasEnv(key))
  const directDbKey = firstPresent(dbUrlEnv)
  const dbPasswordKey = firstPresent(dbPasswordEnv)
  const explicitProjectRefKey = firstPresent(projectRefEnv)
  const projectRefFromSupabaseUrl = inferProjectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasKnownProductionSupabaseUrl = looksLikeKnownProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const projectRefCanBeResolved = Boolean(explicitProjectRefKey || projectRefFromSupabaseUrl || hasKnownProductionSupabaseUrl)
  const directDbReady = Boolean(directDbKey || (dbPasswordKey && projectRefCanBeResolved))
  const projectRefSource = explicitProjectRefKey ||
    (projectRefFromSupabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL project ref' : null) ||
    (hasKnownProductionSupabaseUrl ? `known production project ref ${knownProductionProjectRef}` : null)

  return {
    onlineRegressionReady: missingOnlinePasswords.length === 0,
    missingOnlinePasswordEnv: missingOnlinePasswords,
    supabaseAnonAuditReady: missingSupabaseAudit.length === 0,
    missingSupabaseAuditEnv: missingSupabaseAudit,
    directDbReady,
    directDbSource: directDbKey || (
      dbPasswordKey && projectRefCanBeResolved
        ? `${dbPasswordKey} + ${projectRefSource}`
        : null
    ),
    projectRefResolution: {
      explicitEnv: explicitProjectRefKey,
      fromSupabaseUrl: projectRefFromSupabaseUrl,
      knownProductionUrl: hasKnownProductionSupabaseUrl ? knownProductionProjectRef : null,
    },
    sqlEditorFallbackReady: true,
    dbCredentialPresence: [
      ...dbUrlEnv,
      ...dbPasswordEnv,
      ...projectRefEnv,
    ].map(key => ({
      key,
      present: hasEnv(key),
      source: sourceFor(key),
    })),
  }
}

function classifyRlsFailures(failures = []) {
  const anonReadable = []
  const schemaMissing = []
  const other = []

  for (const failure of failures) {
    const table = String(failure).split(':')[0]
    if (String(failure).includes('anon-key SELECT returned')) {
      anonReadable.push(table)
    } else if (String(failure).includes('PGRST205')) {
      schemaMissing.push(table)
    } else {
      other.push(failure)
    }
  }

  return { anonReadable, schemaMissing, other }
}

function findGateStepStatus(releaseGate, name) {
  const step = (releaseGate?.steps || []).find(item => item.name === name)
  return step?.status || 'missing'
}

function buildGateEvidence(releaseGate) {
  return {
    releaseEnvironmentAudit: findGateStepStatus(releaseGate, 'release environment audit'),
    onlineReleaseRegression: findGateStepStatus(releaseGate, 'online release regression'),
    releaseArtifactsAudit: findGateStepStatus(releaseGate, 'release artifacts audit'),
  }
}

function buildFastestPath({ envReadiness, artifacts, rls, gateEvidence }) {
  const steps = []
  const onlineRegressionVerifiedByGate = gateEvidence?.onlineReleaseRegression === 'pass'

  if (!envReadiness.onlineRegressionReady && !onlineRegressionVerifiedByGate) {
    steps.push('Inject the five online regression password env vars in the shell used for the final gate.')
  }

  if (!envReadiness.supabaseAnonAuditReady) {
    steps.push('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before rerunning the RLS audit.')
  }

  if (rls.status !== 'pass') {
    if (envReadiness.directDbReady) {
      steps.push(`Run direct DB preflight/apply: \`npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit\`, then \`npm run db:apply-rls-release -- --env-file=.env.production.local --audit\`, then \`${quickAfterDbCommand}\` for DB-side verification.`)
    } else {
      steps.push(`Use the SQL Editor path: refresh and audit the SQL bundle, run it in production Supabase SQL Editor, then rerun \`${quickAfterDbCommand}\` for DB-side verification.`)
    }
  }

  if (!artifacts.sqlBundle.exists) {
    steps.push('Generate the SQL Editor bundle with `npm run db:write-rls-release-sql -- --env-file=.env.production.local`.')
  }

  if (!artifacts.dbRunbook.exists) {
    steps.push('Regenerate the DB operator runbook by running `npm run release:gate -- --env-file=.env.production.local`.')
  }

  if (!envReadiness.onlineRegressionReady && onlineRegressionVerifiedByGate) {
    steps.push(`When waiting verification reports READY-FOR-GATE, keep injecting the five online regression password env vars for the final gate and run \`${fullAfterDbCommand}\`; the latest release gate already passed online regression with process env, and those passwords were not written to .env.production.local.`)
  } else {
    steps.push(`When waiting verification reports READY-FOR-GATE, inject the five online regression password env vars and run \`${fullAfterDbCommand}\` for final sign-off.`)
  }

  return steps
}

function classifyBlockingSteps(blockingSteps) {
  const productReleaseBlockers = []
  const environmentBlockers = []

  for (const stepName of blockingSteps) {
    if (stepName === 'supabase rls audit') {
      productReleaseBlockers.push(stepName)
    } else {
      environmentBlockers.push(stepName)
    }
  }

  return { productReleaseBlockers, environmentBlockers }
}

function inferReleaseGap({ releaseGate, rls, envReadiness }) {
  if (releaseGate?.status === 'pass') return '0%'
  if (rls.status === 'pass' && envReadiness.onlineRegressionReady && envReadiness.supabaseAnonAuditReady) return 'about 1%-2%'
  if (rls.status === 'pass') return 'about 2%'
  return 'about 3%-4%'
}

function inferNextFastestVerification({ releaseGate, rls }) {
  if (releaseGate?.status === 'pass') return 'none'
  return rls.status === 'pass' ? fullAfterDbCommand : quickAfterDbCommand
}

function buildPayload() {
  const releaseGate = readJsonIfExists(`.gstack/qa-reports/release-gate-${today}.json`)
  const envAudit = readJsonIfExists(`.gstack/qa-reports/release-env-audit-${today}.json`)
  const rlsAudit = readJsonIfExists(`.gstack/qa-reports/supabase-rls-audit-${today}.json`)
  const dbBundleAudit = readJsonIfExists(`.gstack/qa-reports/release-db-bundle-audit-${today}.json`)
  const artifacts = {
    sqlBundle: fileInfo(`.gstack/qa-reports/release-db-production-bundle-${today}.sql`),
    dbRunbook: fileInfo(`.gstack/qa-reports/release-db-operator-runbook-${today}.md`),
    onlineRegressionReport: fileInfo(`.gstack/qa-reports/online-release-regression-${today}.md`),
  }
  const gateEvidence = buildGateEvidence(releaseGate)
  const envReadiness = inferEnvReadiness()
  const rlsFailures = classifyRlsFailures(rlsAudit?.failures || [])
  const rls = {
    status: rlsAudit?.status || 'missing',
    failures: rlsAudit?.summary?.failures ?? null,
    warnings: rlsAudit?.summary?.warnings ?? null,
    anonReadableTables: rlsFailures.anonReadable,
    schemaMissingTables: rlsFailures.schemaMissing,
    otherFailures: rlsFailures.other,
  }
  const status = releaseGate?.status === 'pass'
    ? 'ready'
    : rls.status === 'pass' && envReadiness.onlineRegressionReady && envReadiness.supabaseAnonAuditReady
      ? 'rerun-release-gate'
      : 'blocked'
  const blockingSteps = (releaseGate?.steps || [])
    .filter(step => step.required && ['fail', 'skipped'].includes(step.status))
    .map(step => step.name)
  const blockingStepSplit = classifyBlockingSteps(blockingSteps)
  const releaseReadiness = {
    formalReleaseGap: inferReleaseGap({ releaseGate, rls, envReadiness }),
    nextFastestVerification: inferNextFastestVerification({ releaseGate, rls }),
    productReleaseBlockers: blockingStepSplit.productReleaseBlockers,
    environmentBlockers: blockingStepSplit.environmentBlockers,
  }

  return {
    generatedAt: new Date().toISOString(),
    status,
    envFile: loadedEnv,
    releaseGate: releaseGate
      ? {
        status: releaseGate.status,
        summary: releaseGate.summary,
        blockingSteps,
        ...blockingStepSplit,
      }
      : null,
    envAudit: envAudit
      ? {
        status: envAudit.status,
        summary: envAudit.summary,
      }
      : null,
    rls,
    dbBundleAudit: dbBundleAudit
      ? {
        status: dbBundleAudit.status,
        summary: dbBundleAudit.summary,
      }
      : null,
    artifacts,
    gateEvidence,
    envReadiness,
    releaseReadiness,
    fastestPath: buildFastestPath({ envReadiness, artifacts, rls, gateEvidence }),
  }
}

function pipeSafe(value) {
  return String(value).replace(/\|/g, '/')
}

function writeReport(payload) {
  mkdirSync(reportRoot, { recursive: true })
  writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`)

  const releaseSummary = payload.releaseGate?.summary
    ? `${payload.releaseGate.summary.passed} PASS / ${payload.releaseGate.summary.failed} FAIL / ${payload.releaseGate.summary.skipped} SKIP`
    : 'missing'
  const rlsFailureSummary = payload.rls.failures === null
    ? 'missing'
    : `${payload.rls.failures} failures, ${payload.rls.warnings} warnings`
  const onlinePasswordDetail = payload.envReadiness.onlineRegressionReady
    ? 'none'
    : payload.gateEvidence.onlineReleaseRegression === 'pass'
      ? `${payload.envReadiness.missingOnlinePasswordEnv.join(', ')} not persisted in current env file; latest release gate passed with injected process env`
      : payload.envReadiness.missingOnlinePasswordEnv.join(', ')
  const blockingStepsLabel = payload.releaseGate
    ? payload.releaseGate.blockingSteps.join(', ') || 'none'
    : 'missing'
  const productBlockersLabel = payload.releaseGate
    ? payload.releaseGate.productReleaseBlockers.join(', ') || 'none'
    : 'missing'
  const environmentBlockersLabel = payload.releaseGate
    ? payload.releaseGate.environmentBlockers.join(', ') || 'none'
    : 'missing'

  const envRows = [
    ['Online regression passwords', payload.envReadiness.onlineRegressionReady ? 'READY' : 'MISSING', onlinePasswordDetail],
    ['Supabase anon audit env', payload.envReadiness.supabaseAnonAuditReady ? 'READY' : 'MISSING', payload.envReadiness.missingSupabaseAuditEnv.join(', ') || 'none'],
    ['Direct DB apply', payload.envReadiness.directDbReady ? 'READY' : 'NOT READY', payload.envReadiness.directDbSource || 'no DB URL/password in current shell'],
    ['SQL Editor fallback', payload.envReadiness.sqlEditorFallbackReady ? 'READY' : 'NOT READY', payload.artifacts.sqlBundle.exists ? payload.artifacts.sqlBundle.path : 'bundle missing'],
  ]
  const gateEvidenceRows = [
    ['Release environment audit', payload.gateEvidence.releaseEnvironmentAudit.toUpperCase(), 'latest release gate step'],
    ['Online release regression', payload.gateEvidence.onlineReleaseRegression.toUpperCase(), payload.artifacts.onlineRegressionReport.exists ? payload.artifacts.onlineRegressionReport.path : 'report missing'],
    ['Release artifacts audit', payload.gateEvidence.releaseArtifactsAudit.toUpperCase(), 'latest release gate step'],
  ]

  writeFileSync(outputMd, [
    `# Release Unblock Status - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Formal release gap: ${payload.releaseReadiness.formalReleaseGap}`,
    `- Next fastest verification: ${payload.releaseReadiness.nextFastestVerification === 'none' ? 'none' : `\`${payload.releaseReadiness.nextFastestVerification}\``}`,
    `- Env file loaded: ${payload.envFile?.loaded ? payload.envFile.path : 'none'}`,
    `- Release gate: ${releaseSummary}`,
    `- Blocking gate(s): ${blockingStepsLabel}`,
    `- Product release blocker(s): ${productBlockersLabel}`,
    `- Environment/test harness blocker(s): ${environmentBlockersLabel}`,
    `- RLS audit: ${payload.rls.status.toUpperCase()} (${rlsFailureSummary})`,
    `- SQL bundle: ${payload.artifacts.sqlBundle.exists ? payload.artifacts.sqlBundle.path : 'missing'}`,
    `- DB runbook: ${payload.artifacts.dbRunbook.exists ? payload.artifacts.dbRunbook.path : 'missing'}`,
    '',
    '## Readiness',
    '',
    '| Area | Status | Detail |',
    '|---|---:|---|',
    ...envRows.map(row => `| ${row.map(pipeSafe).join(' | ')} |`),
    '',
    '## Latest Gate Evidence',
    '',
    '| Check | Status | Detail |',
    '|---|---:|---|',
    ...gateEvidenceRows.map(row => `| ${row.map(pipeSafe).join(' | ')} |`),
    '',
    '## RLS Failure Split',
    '',
    `- Anon-readable business tables: ${payload.rls.anonReadableTables.length}${payload.rls.anonReadableTables.length ? ` (${payload.rls.anonReadableTables.join(', ')})` : ''}`,
    `- Missing/schema-cache tables: ${payload.rls.schemaMissingTables.length}${payload.rls.schemaMissingTables.length ? ` (${payload.rls.schemaMissingTables.join(', ')})` : ''}`,
    `- Other RLS failures: ${payload.rls.otherFailures.length}`,
    '',
    '## Fastest Path',
    '',
    ...payload.fastestPath.map((step, index) => `${index + 1}. ${step}`),
    '',
  ].join('\n'))
}

const payload = buildPayload()
writeReport(payload)

console.log(`Release unblock status: ${payload.status.toUpperCase()}`)
console.log(`Release gate: ${payload.releaseGate?.summary ? `${payload.releaseGate.summary.passed} PASS / ${payload.releaseGate.summary.failed} FAIL / ${payload.releaseGate.summary.skipped} SKIP` : 'missing'}`)
console.log(`RLS: ${payload.rls.status.toUpperCase()}${payload.rls.failures === null ? '' : ` (${payload.rls.failures} failures)`}`)
console.log(`Report: ${displayPath(outputMd)}`)
console.log(`JSON: ${displayPath(outputJson)}`)
