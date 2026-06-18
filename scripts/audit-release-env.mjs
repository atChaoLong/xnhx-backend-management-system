#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const explicitEnvFileArg = args.find(arg => arg.startsWith('--env-file='))
const reportRootArg = args.find(arg => arg.startsWith('--report-dir='))
const sqlEditorOk = args.includes('--sql-editor-ok')
const defaultProductionEnvPath = path.join(root, '.env.production.local')
const envFileArg = explicitEnvFileArg || (fs.existsSync(defaultProductionEnvPath) ? '--env-file=.env.production.local' : null)
const reportRoot = path.resolve(root, reportRootArg?.slice('--report-dir='.length) || '.gstack/qa-reports')
const outputJson = path.join(reportRoot, `release-env-audit-${today}.json`)
const outputMd = path.join(reportRoot, `release-env-audit-${today}.md`)
const knownProductionProjectRef = 'kjnqtplzylqxiklsnfoa'

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

const optionalRuntimeEnv = [
  'SUPABASE_SERVICE_ROLE_KEY',
]

const envSources = new Map()

for (const key of Object.keys(process.env)) {
  envSources.set(key, 'process env')
}

function resolveEnvFile(value) {
  return path.isAbsolute(value) ? value : path.join(root, value)
}

function displayPath(value) {
  return path.relative(root, value) || value
}

function failEarly(message) {
  console.error(message)
  process.exit(1)
}

function loadDotEnvFile(envPath, { required = false } = {}) {
  if (!fs.existsSync(envPath)) {
    if (required) {
      failEarly(`Missing env file: ${displayPath(envPath)}`)
    }
    return null
  }

  const label = displayPath(envPath)
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

  return label
}

function loadEnv() {
  if (envFileArg) {
    return loadDotEnvFile(resolveEnvFile(envFileArg.slice('--env-file='.length)), { required: true })
  }

  return loadDotEnvFile(path.join(root, '.env.local'))
}

const loadedEnvFile = loadEnv()

function hasEnv(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0
}

function sourceFor(key) {
  return hasEnv(key) ? (envSources.get(key) || 'process env') : 'missing'
}

function firstPresent(keys) {
  return keys.find(hasEnv) || null
}

function checkKeys(keys) {
  return keys.map(key => ({
    key,
    present: hasEnv(key),
    source: sourceFor(key),
  }))
}

function inferProjectRefFromSupabaseUrl(value) {
  if (!value) return null

  try {
    const hostname = new URL(value).hostname
    const match = hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)
    return match?.[1] || null
  } catch {
    return null
  }
}

function looksLikeKnownProductionSupabaseUrl(value) {
  if (!value) return false

  try {
    const hostname = new URL(value).hostname
    return hostname.includes('sbp-76uzx8fjpgfoyx2f') ||
      hostname.includes('supabase.opentrust.net')
  } catch {
    return false
  }
}

function resolveProjectRefSource() {
  const explicitProjectRef = firstPresent(projectRefEnv)
  if (explicitProjectRef) {
    return {
      available: true,
      source: explicitProjectRef,
      method: 'explicit env',
    }
  }

  const projectRefFromUrl = inferProjectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (projectRefFromUrl) {
    return {
      available: true,
      source: 'NEXT_PUBLIC_SUPABASE_URL',
      method: 'supabase.co host',
    }
  }

  if (looksLikeKnownProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return {
      available: true,
      source: 'known production NEXT_PUBLIC_SUPABASE_URL',
      method: `default ref ${knownProductionProjectRef}`,
    }
  }

  return {
    available: false,
    source: 'missing',
    method: 'missing',
  }
}

function passFail(value) {
  return value ? 'pass' : 'fail'
}

function buildGroups() {
  const onlineChecks = checkKeys(onlinePasswordEnv)
  const supabaseChecks = checkKeys(supabaseAuditEnv)
  const dbUrlKey = firstPresent(dbUrlEnv)
  const dbPasswordKey = firstPresent(dbPasswordEnv)
  const projectRef = resolveProjectRefSource()
  const onlineReady = onlineChecks.every(check => check.present)
  const supabaseReady = supabaseChecks.every(check => check.present)
  const directDbReady = Boolean(dbUrlKey || (dbPasswordKey && projectRef.available))
  const dbApplyRequired = !sqlEditorOk

  return [
    {
      name: 'online release regression credentials',
      status: passFail(onlineReady),
      required: true,
      evidence: onlineReady
        ? 'All five online role password env vars are present.'
        : 'One or more online role password env vars are missing.',
      nextAction: onlineReady
        ? 'No action needed for online regression credentials.'
        : 'Inject the five online role password env vars before running the final full release gate.',
      checks: onlineChecks,
    },
    {
      name: 'supabase anon audit environment',
      status: passFail(supabaseReady),
      required: true,
      evidence: supabaseReady
        ? 'Supabase URL and anon key env vars are present.'
        : 'Supabase URL or anon key env var is missing.',
      nextAction: supabaseReady
        ? 'No action needed for Supabase anon audit env.'
        : 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before running the RLS audit.',
      checks: supabaseChecks,
    },
    {
      name: 'production database apply readiness',
      status: directDbReady ? 'pass' : sqlEditorOk ? 'info' : 'fail',
      required: dbApplyRequired,
      evidence: dbUrlKey
        ? `Direct database URL is available from ${dbUrlKey}.`
        : dbPasswordKey && projectRef.available
          ? `DB password env is present and project ref can be resolved from ${projectRef.source}.`
          : sqlEditorOk
            ? 'No direct database URL was found, but SQL Editor fallback is explicitly allowed for this audit.'
            : 'No direct database URL was found, or DB password/project ref resolution is incomplete.',
      nextAction: directDbReady
        ? 'No action needed for direct DB apply readiness.'
        : sqlEditorOk
          ? 'Use the generated SQL Editor bundle if direct DB apply is not available, then rerun the RLS audit.'
          : 'Set a production DB URL, or set XNHX_SUPABASE_DB_PASSWORD/SUPABASE_DB_PASSWORD; alternatively use the SQL Editor bundle.',
      checks: [
        ...checkKeys(dbUrlEnv),
        ...checkKeys(dbPasswordEnv),
        ...checkKeys(projectRefEnv),
        {
          key: 'PROJECT_REF_RESOLUTION',
          present: projectRef.available,
          source: projectRef.source,
          detail: projectRef.method,
        },
      ],
    },
    {
      name: 'optional runtime service role',
      status: 'info',
      required: false,
      evidence: firstPresent(optionalRuntimeEnv)
        ? 'Optional service role env var is present.'
        : 'Optional service role env var was not found in this shell.',
      nextAction: 'Keep service role env managed in Vercel/runtime secrets; it is not required for this local release env audit.',
      checks: checkKeys(optionalRuntimeEnv),
    },
  ]
}

function writeReport(payload) {
  fs.mkdirSync(reportRoot, { recursive: true })
  fs.writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`)

  const groupRows = payload.groups.map(group => [
    group.name,
    group.required ? 'yes' : 'no',
    group.status.toUpperCase(),
    group.evidence.replace(/\|/g, '/'),
    group.nextAction.replace(/\|/g, '/'),
  ])

  const checkRows = payload.groups.flatMap(group => group.checks.map(check => [
    group.name,
    check.key,
    check.present ? 'yes' : 'no',
    check.source,
    check.detail || '',
  ]))

  fs.writeFileSync(outputMd, [
    `# Release Environment Audit - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Required groups passed: ${payload.summary.requiredPassed}/${payload.summary.requiredTotal}`,
    `- Env file loaded: ${payload.envFile || 'none'}`,
    `- SQL Editor fallback allowed: ${payload.sqlEditorOk ? 'yes' : 'no'}`,
    `- Report dir: ${payload.reportDir}`,
    '',
    '## Groups',
    '',
    '| Group | Required | Status | Evidence | Next action |',
    '|---|---:|---:|---|---|',
    ...groupRows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Checks',
    '',
    '| Group | Key | Present | Source | Detail |',
    '|---|---|---:|---|---|',
    ...checkRows.map(row => `| ${row.map(value => String(value).replace(/\|/g, '/')).join(' | ')} |`),
    '',
    '## Final Commands',
    '',
    '- `npm run audit:release-env -- --env-file=.env.production.local`',
    '- `npm run audit:release-env -- --env-file=.env.production.local --sql-editor-ok`',
    '- `npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit`',
    '- `npm run db:apply-rls-release -- --env-file=.env.production.local --audit`',
    '- `npm run release:after-db:wait -- --env-file=.env.production.local`',
    '- `npm run release:after-db -- --env-file=.env.production.local`',
    '',
  ].join('\n'))
}

function main() {
  const groups = buildGroups()
  const requiredGroups = groups.filter(group => group.required)
  const requiredPassed = requiredGroups.filter(group => group.status === 'pass').length
  const status = requiredPassed === requiredGroups.length ? 'pass' : 'fail'
  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    envFile: loadedEnvFile,
    sqlEditorOk,
    reportDir: path.relative(root, reportRoot),
    summary: {
      requiredTotal: requiredGroups.length,
      requiredPassed,
      requiredFailed: requiredGroups.length - requiredPassed,
      informationalGroups: groups.length - requiredGroups.length,
    },
    groups,
  }

  writeReport(payload)

  if (status === 'pass') {
    console.log(`Release environment audit passed. Required groups: ${requiredPassed}/${requiredGroups.length}`)
    console.log(`Report: ${path.relative(root, outputMd)}`)
    console.log(`JSON: ${path.relative(root, outputJson)}`)
    return
  }

  console.error(`Release environment audit failed. Required groups: ${requiredPassed}/${requiredGroups.length}`)
  console.error(`Report: ${path.relative(root, outputMd)}`)
  console.error(`JSON: ${path.relative(root, outputJson)}`)
  process.exit(1)
}

main()
