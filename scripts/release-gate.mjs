#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const reportRoot = path.join(root, '.gstack', 'qa-reports')
const today = new Date().toISOString().slice(0, 10)
const args = process.argv.slice(2)
const allowSkips = args.includes('--allow-skips')
const explicitEnvFileArg = args.find(arg => arg.startsWith('--env-file='))
const defaultProductionEnvPath = path.join(root, '.env.production.local')
const envFileArg = explicitEnvFileArg || (fs.existsSync(defaultProductionEnvPath) ? '--env-file=.env.production.local' : null)
const releaseMigrationRelativePaths = [
  path.join('supabase', 'migrations', '046_add_class_student_participation.sql'),
  path.join('supabase', 'migrations', '071_create_quality_reports.sql'),
  path.join('supabase', 'migrations', '072_lock_down_anon_business_tables.sql'),
]

const onlinePasswordEnv = [
  'XNHX_OPERATOR_PASSWORD',
  'XNHX_SALES_PASSWORD',
  'XNHX_HEAD_TEACHER_PASSWORD',
  'XNHX_ACADEMIC_AFFAIRS_PASSWORD',
  'XNHX_ADMIN_PASSWORD',
]

function resolveEnvFile(value) {
  return path.isAbsolute(value) ? value : path.join(root, value)
}

function loadDotEnvFile(envPath, { required = false } = {}) {
  if (!fs.existsSync(envPath)) {
    if (required) {
      throw new Error(`Missing env file: ${envPath}`)
    }
    return
  }

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
  }
}

function loadEnv() {
  if (envFileArg) {
    loadDotEnvFile(resolveEnvFile(envFileArg.slice('--env-file='.length)), { required: true })
    return
  }

  loadDotEnvFile(path.join(root, '.env.local'))
}

function tail(value, lines = 18) {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-lines)
    .join('\n')
}

function runStep(name, command, args, options = {}) {
  const startedAt = Date.now()
  const required = options.required !== false

  if (options.skip) {
    return {
      name,
      status: 'skipped',
      required,
      durationMs: 0,
      reason: options.skip,
      command: [command, ...args].join(' '),
    }
  }

  console.log(`Running ${name}...`)
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })

  const durationMs = Date.now() - startedAt
  if (result.error) {
    return {
      name,
      status: 'fail',
      required,
      durationMs,
      command: [command, ...args].join(' '),
      exitCode: null,
      outputTail: result.error.message,
    }
  }

  return {
    name,
    status: result.status === 0 ? 'pass' : 'fail',
    required,
    durationMs,
    command: [command, ...args].join(' '),
    exitCode: result.status,
    outputTail: tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
  }
}

function buildNextActions(steps, artifacts = {}) {
  const actions = []
  const stepByName = new Map(steps.map(step => [step.name, step]))
  const hasFailure = steps.some(step => step.status === 'fail')
  const envFileSuffix = envFileArg ? ` ${envFileArg}` : ''
  const envFileApplySuffix = envFileArg ? ` ${envFileArg}` : ''
  const quickAfterDbCommand = `npm run release:after-db:quick --${envFileSuffix}`
  const waitAfterDbCommand = `npm run release:after-db:wait --${envFileSuffix}`
  const fullAfterDbCommand = `npm run release:after-db --${envFileSuffix}`

  if (stepByName.get('release environment audit')?.status === 'fail') {
    actions.push(`Inject missing release environment variables, then rerun \`npm run audit:release-env --${envFileSuffix} --sql-editor-ok\`. The final gate allows the SQL Editor DB apply path, but still requires online regression credentials and Supabase anon audit env.`)
  }

  if (stepByName.get('supabase rls audit')?.status === 'fail') {
    actions.push(`Preflight and apply the production database release bundle, then audit it: \`npm run db:apply-rls-release --${envFileApplySuffix} --preflight --audit\`, then \`npm run db:apply-rls-release --${envFileApplySuffix} --audit\`. The bundle includes schema catch-up migrations 046/071, RLS hardening 072, post-run DB assertions, and a PostgREST schema cache reload.`)
    actions.push('For direct DB apply, provide either `XNHX_SUPABASE_DB_URL` / `SUPABASE_DB_URL` / `DATABASE_URL`, or set `XNHX_SUPABASE_DB_PASSWORD` / `SUPABASE_DB_PASSWORD`; for the known production Supabase URL, the runner derives the Supabase pooler connection automatically.')
    const sqlArtifactAction = artifacts.releaseSql
      ? ` or use the generated SQL artifact \`${artifacts.releaseSql}\``
      : ''
    const runbookAction = artifacts.dbRunbook
      ? ` Follow \`${artifacts.dbRunbook}\` for the exact operator steps.`
      : ''
    const bundleAuditAction = artifacts.releaseSql
      ? `, run \`npm run audit:release-db-bundle -- --path=${artifacts.releaseSql}\``
      : ', run `npm run audit:release-db-bundle`'
    actions.push(`If using the Supabase SQL Editor, refresh the full bundle with \`npm run db:write-rls-release-sql --${envFileSuffix}\`${sqlArtifactAction}${bundleAuditAction}, run it in production, confirm the assertion block completes and the schema cache reload notification runs, then rerun \`${waitAfterDbCommand}\`. When waiting verification reports READY-FOR-GATE, run \`${fullAfterDbCommand}\` for final sign-off.${runbookAction}`)
  }

  if (stepByName.get('online release regression')?.status === 'skipped') {
    actions.push(`Inject the online password env vars and rerun the gate: ${onlinePasswordEnv.join(', ')}.`)
  }

  if (hasFailure && actions.length === 0) {
    actions.push('Fix the failing step shown above, then rerun `npm run release:gate`.')
  }

  if (!hasFailure && actions.length === 0) {
    actions.push('All required release gates passed. Proceed to final release sign-off.')
  }

  return actions
}

function releaseAssertionSql() {
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
  ].map(table => `('${table}')`).join(',\n      ')

  return `
-- ============================================
-- Source: release database assertions
-- ============================================
DO $$
DECLARE
  missing_tables text[];
  rls_disabled_tables text[];
  exposed_tables text[];
BEGIN
  WITH required_tables(table_name) AS (
    VALUES
      ${requiredTables}
  )
  SELECT array_agg(required_tables.table_name ORDER BY required_tables.table_name)
    INTO missing_tables
  FROM required_tables
  LEFT JOIN information_schema.tables
    ON information_schema.tables.table_schema = 'public'
   AND information_schema.tables.table_name = required_tables.table_name
  WHERE information_schema.tables.table_name IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Release DB assertion failed: missing required public tables: %', missing_tables;
  END IF;

  WITH required_tables(table_name) AS (
    VALUES
      ${requiredTables}
  )
  SELECT array_agg(required_tables.table_name ORDER BY required_tables.table_name)
    INTO rls_disabled_tables
  FROM required_tables
  JOIN pg_class ON pg_class.relname = required_tables.table_name
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_namespace.nspname = 'public'
    AND pg_class.relkind = 'r'
    AND NOT pg_class.relrowsecurity;

  IF rls_disabled_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Release DB assertion failed: RLS disabled on required tables: %', rls_disabled_tables;
  END IF;

  WITH required_tables(table_name) AS (
    VALUES
      ${requiredTables}
  )
  SELECT array_agg(DISTINCT required_tables.table_name ORDER BY required_tables.table_name)
    INTO exposed_tables
  FROM required_tables
  JOIN information_schema.table_privileges
    ON information_schema.table_privileges.table_schema = 'public'
   AND information_schema.table_privileges.table_name = required_tables.table_name
   AND information_schema.table_privileges.grantee IN ('anon', 'PUBLIC')
   AND information_schema.table_privileges.privilege_type = 'SELECT';

  IF exposed_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Release DB assertion failed: anon/PUBLIC SELECT grants remain on required tables: %', exposed_tables;
  END IF;
END $$;
`.trim()
}

function releaseSchemaCacheReloadSql() {
  return [
    '-- ============================================',
    '-- Source: PostgREST schema cache reload',
    '-- ============================================',
    "NOTIFY pgrst, 'reload schema';",
  ].join('\n')
}

function writeReleaseSqlArtifact(steps) {
  const rlsFailed = steps.some(step => step.name === 'supabase rls audit' && step.status === 'fail')
  if (!rlsFailed) return null

  const migrations = releaseMigrationRelativePaths.map(relativePath => ({
    relativePath,
    path: path.join(root, relativePath),
  }))
  if (migrations.some(migration => !fs.existsSync(migration.path))) return null

  const artifactPath = path.join(reportRoot, `release-db-production-bundle-${today}.sql`)
  const quickAfterDbCommand = envFileArg
    ? `npm run release:after-db:quick -- ${envFileArg}`
    : 'npm run release:after-db:quick'
  const waitAfterDbCommand = envFileArg
    ? `npm run release:after-db:wait -- ${envFileArg}`
    : 'npm run release:after-db:wait'
  const verifyOnlyCommand = envFileArg
    ? `npm run db:apply-rls-release -- ${envFileArg} --verify-only --audit`
    : 'npm run db:apply-rls-release -- --verify-only --audit'
  const preflightCommand = envFileArg
    ? `npm run db:apply-rls-release -- ${envFileArg} --preflight --audit`
    : 'npm run db:apply-rls-release -- --preflight --audit'
  const applyCommand = envFileArg
    ? `npm run db:apply-rls-release -- ${envFileArg} --audit`
    : 'npm run db:apply-rls-release -- --audit'
  const header = [
    `-- Generated by scripts/release-gate.mjs on ${new Date().toISOString()}`,
    '-- Production database release bundle.',
    '-- Sources:',
    ...migrations.map(migration => `-- - ${migration.relativePath}`),
    '-- Includes production schema catch-up plus RLS/anon/PUBLIC hardening.',
    '-- Direct DB apply option:',
    `-- - Preflight: ${preflightCommand}`,
    `-- - Apply and audit: ${applyCommand}`,
    '-- - DB connection: set a production Postgres URL, or set XNHX_SUPABASE_DB_PASSWORD/SUPABASE_DB_PASSWORD. The known production URL defaults to project ref kjnqtplzylqxiklsnfoa.',
    '-- SQL Editor option:',
    '-- - Run this full bundle against the production Supabase database.',
    `-- - Then rerun: ${waitAfterDbCommand}`,
    '',
  ].join('\n')
  const body = migrations
    .map(migration => [
      '-- ============================================',
      `-- Source: ${migration.relativePath}`,
      '-- ============================================',
      fs.readFileSync(migration.path, 'utf8').trimEnd(),
      '',
    ].join('\n'))
    .join('\n')

  fs.writeFileSync(artifactPath, `${header}${body}\n${releaseAssertionSql()}\n\n${releaseSchemaCacheReloadSql()}\n`)
  return path.relative(root, artifactPath)
}

function writeDbOperatorRunbook(steps, artifacts = {}) {
  const rlsFailed = steps.some(step => step.name === 'supabase rls audit' && step.status === 'fail')
  if (!rlsFailed) return null

  const passed = steps.filter(step => step.status === 'pass').length
  const failed = steps.filter(step => step.status === 'fail').length
  const skipped = steps.filter(step => step.status === 'skipped').length
  const expectedPassCount = steps.length
  const blockingSteps = steps
    .filter(step => step.required && (step.status === 'fail' || step.status === 'skipped'))
    .map(step => step.name)
  const artifactPath = path.join(reportRoot, `release-db-operator-runbook-${today}.md`)
  const releaseSql = artifacts.releaseSql || `.gstack/qa-reports/release-db-production-bundle-${today}.sql`
  const preflightCommand = envFileArg
    ? `npm run db:apply-rls-release -- ${envFileArg} --preflight --audit`
    : 'npm run db:apply-rls-release -- --preflight --audit'
  const applyCommand = envFileArg
    ? `npm run db:apply-rls-release -- ${envFileArg} --audit`
    : 'npm run db:apply-rls-release -- --audit'
  const verifyOnlyCommand = envFileArg
    ? `npm run db:apply-rls-release -- ${envFileArg} --verify-only --audit`
    : 'npm run db:apply-rls-release -- --verify-only --audit'
  const quickAfterDbCommand = envFileArg
    ? `npm run release:after-db:quick -- ${envFileArg}`
    : 'npm run release:after-db:quick'
  const waitAfterDbCommand = envFileArg
    ? `npm run release:after-db:wait -- ${envFileArg}`
    : 'npm run release:after-db:wait'
  const fullAfterDbCommand = envFileArg
    ? `npm run release:after-db -- ${envFileArg}`
    : 'npm run release:after-db'

  const content = [
    `# Production DB Release Runbook - ${today}`,
    '',
    '## Current Gate',
    '',
    `- Formal release gate: \`${passed} PASS / ${failed} FAIL / ${skipped} SKIP\``,
    `- Blocking gate(s): ${blockingSteps.map(step => `\`${step}\``).join(', ')}`,
    '- DB blocking gate: `supabase rls audit`',
    `- Release SQL bundle: \`${releaseSql}\``,
    '- Production Supabase project ref: `kjnqtplzylqxiklsnfoa`',
    '',
    '## What Must Be Applied',
    '',
    'Run the full release database bundle against the production Supabase database. The bundle contains:',
    '',
    '1. `supabase/migrations/046_add_class_student_participation.sql`',
    '2. `supabase/migrations/071_create_quality_reports.sql`',
    '3. `supabase/migrations/072_lock_down_anon_business_tables.sql`',
    '4. Release assertions for required tables, RLS, and anon/PUBLIC SELECT grants',
    "5. `NOTIFY pgrst, 'reload schema';`",
    '',
    '## Environment Preflight',
    '',
    'Before choosing the apply path, verify the local release environment without printing any secret values:',
    '',
    '```bash',
    envFileArg
      ? `npm run audit:release-env -- ${envFileArg} --sql-editor-ok`
      : 'npm run audit:release-env -- --sql-editor-ok',
    '```',
    '',
    'The final release gate allows the SQL Editor DB apply path, but still requires online regression credentials and Supabase URL/anon key for the RLS audit.',
    '',
    '## Direct Apply Path',
    '',
    'Use this path when a production Postgres URL or DB password is available in the shell.',
    '',
    '```bash',
    preflightCommand,
    applyCommand,
    '```',
    '',
    'The runner needs one of:',
    '',
    '- `XNHX_SUPABASE_DB_URL`',
    '- `SUPABASE_DB_URL`',
    '- `DATABASE_URL`',
    '- `XNHX_SUPABASE_DB_PASSWORD`',
    '- `SUPABASE_DB_PASSWORD`',
    '',
    'For the known production Supabase URL, the runner defaults to project ref `kjnqtplzylqxiklsnfoa`. For any other URL, also set `XNHX_SUPABASE_PROJECT_REF` or `SUPABASE_PROJECT_REF`.',
    '',
    '## SQL Editor Path',
    '',
    'Use this path when applying manually in Supabase.',
    '',
    '1. Open the Supabase SQL Editor for project `kjnqtplzylqxiklsnfoa`.',
    envFileArg
      ? `2. Refresh the bundle if needed: \`npm run db:write-rls-release-sql -- ${envFileArg}\`.`
      : '2. Refresh the bundle if needed: `npm run db:write-rls-release-sql`.',
    `3. Sanity-check the bundle locally: \`npm run audit:release-db-bundle -- --path=${releaseSql}\`.`,
    `4. Paste and run the full contents of \`${releaseSql}\`.`,
    '5. Confirm the query completes without a `Release DB assertion failed` exception.',
    "6. Confirm the final schema cache reload statement runs: `NOTIFY pgrst, 'reload schema';`.",
    '7. Return here and run the DB-side waiting verification:',
    '',
    '```bash',
    waitAfterDbCommand,
    '```',
    '',
    '8. If the waiting verification reports `READY-FOR-GATE`, inject the five online regression password env vars and run the final full verification:',
    '',
    '```bash',
    fullAfterDbCommand,
    '```',
    '',
    '9. If direct DB credentials become available after SQL Editor execution, run verify-only mode instead of reapplying migrations:',
    '',
    '```bash',
    verifyOnlyCommand,
    '```',
    '',
    'If the assertion block fails, stop and keep the exact assertion message. Do not retry partial SQL manually without reviewing the failed condition first.',
    '',
    '## Verification',
    '',
    'After the production DB bundle is applied:',
    '',
    '```bash',
    waitAfterDbCommand,
    quickAfterDbCommand,
    fullAfterDbCommand,
    '```',
    '',
    'Expected release gate result:',
    '',
    '- `supabase rls audit`: `PASS`',
    '- `release artifacts audit`: `PASS`',
    `- final release gate: \`${expectedPassCount} PASS / 0 FAIL / 0 SKIP\``,
    '',
    '## Current Failure Being Fixed',
    '',
    'The latest RLS audit fails because:',
    '',
    '- 16 required business tables still allow anonymous direct `SELECT` rows in production.',
    '- 2 required tables are missing from production schema or PostgREST schema cache: `class_student_participation`, `quality_reports`.',
    '',
    'Once the bundle is applied and verification passes, the remaining formal release gap should drop from about `3%-4%` to normal final sign-off only.',
    '',
  ].join('\n')

  fs.writeFileSync(artifactPath, content)
  return path.relative(root, artifactPath)
}

function writeReports(steps) {
  fs.mkdirSync(reportRoot, { recursive: true })

  const requiredFailures = steps.filter(step => step.required && step.status === 'fail')
  const requiredSkips = steps.filter(step => step.required && step.status === 'skipped')
  const status = requiredFailures.length === 0 && (allowSkips || requiredSkips.length === 0)
    ? 'pass'
    : 'fail'
  const artifacts = {
    releaseSql: writeReleaseSqlArtifact(steps),
  }
  artifacts.dbRunbook = writeDbOperatorRunbook(steps, artifacts)
  const nextActions = buildNextActions(steps, artifacts)
  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    allowSkips,
    envFile: envFileArg?.slice('--env-file='.length) ?? null,
    summary: {
      total: steps.length,
      passed: steps.filter(step => step.status === 'pass').length,
      failed: steps.filter(step => step.status === 'fail').length,
      skipped: steps.filter(step => step.status === 'skipped').length,
      requiredFailures: requiredFailures.length,
      requiredSkips: requiredSkips.length,
    },
    steps,
    nextActions,
    artifacts,
  }

  const jsonPath = path.join(reportRoot, `release-gate-${today}.json`)
  const mdPath = path.join(reportRoot, `release-gate-${today}.md`)
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`)

  const lines = [
    `# Release Gate - ${today}`,
    '',
    `- Status: ${status.toUpperCase()}`,
    `- Total: ${payload.summary.total}`,
    `- Passed: ${payload.summary.passed}`,
    `- Failed: ${payload.summary.failed}`,
    `- Skipped: ${payload.summary.skipped}`,
    `- Required failures: ${payload.summary.requiredFailures}`,
    `- Required skips: ${payload.summary.requiredSkips}`,
    '',
    '## Next Actions',
    '',
    ...nextActions.map((action, index) => `${index + 1}. ${action}`),
    '',
    '## Artifacts',
    '',
    ...Object.entries(artifacts)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `- ${key}: \`${value}\``),
    '',
    '## Steps',
    '',
    '| Step | Required | Status | ms | Command / Reason |',
    '|---|---:|---|---:|---|',
    ...steps.map(step => {
      const detail = step.reason ?? step.command
      return `| ${step.name} | ${step.required ? 'yes' : 'no'} | ${step.status.toUpperCase()} | ${step.durationMs} | ${detail.replace(/\|/g, '/')} |`
    }),
    '',
    '## Failure Output',
    '',
    ...steps
      .filter(step => step.status === 'fail')
      .flatMap(step => [
        `### ${step.name}`,
        '',
        '```text',
        step.outputTail || '(no output)',
        '```',
        '',
      ]),
  ]

  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`)
  return { payload, mdPath, jsonPath }
}

function main() {
  loadEnv()

  const hasOnlinePasswords = onlinePasswordEnv.every(key => Boolean(process.env[key]))
  const tscBin = fs.existsSync(path.join(root, 'node_modules', '.bin', 'tsc'))
    ? path.join(root, 'node_modules', '.bin', 'tsc')
    : 'tsc'
  const rlsAuditArgs = envFileArg
    ? ['run', 'audit:rls', '--', envFileArg]
    : ['run', 'audit:rls']
  const releaseEnvAuditArgs = envFileArg
    ? ['run', 'audit:release-env', '--', envFileArg, '--sql-editor-ok']
    : ['run', 'audit:release-env', '--', '--sql-editor-ok']

  const steps = [
    runStep('script syntax', 'node', ['--check', 'scripts/release-gate.mjs']),
    runStep('release db bundle runner syntax', 'node', ['--check', 'scripts/apply-rls-release-migration.mjs']),
    runStep('release environment audit syntax', 'node', ['--check', 'scripts/audit-release-env.mjs']),
    runStep('release artifacts audit syntax', 'node', ['--check', 'scripts/audit-release-artifacts.mjs']),
    runStep('release unblock status syntax', 'node', ['--check', 'scripts/release-unblock-status.mjs']),
    runStep('release after-db verify syntax', 'node', ['--check', 'scripts/release-after-db-verify.mjs']),
    runStep('typescript', tscBin, ['--noEmit', '--pretty', 'false', '--incremental', 'false']),
    runStep('route permission audit', 'npm', ['run', 'audit:routes']),
    runStep('rate limit audit', 'npm', ['run', 'audit:rate-limit']),
    runStep('release environment audit', 'npm', releaseEnvAuditArgs),
    runStep(
      'online release regression',
      'npm',
      ['run', 'test:online-release'],
      {
        skip: hasOnlinePasswords
          ? null
          : `missing required online password env vars: ${onlinePasswordEnv.join(', ')}`,
      },
    ),
    runStep('release artifacts audit', 'npm', ['run', 'audit:release-artifacts']),
    runStep('supabase rls audit', 'npm', rlsAuditArgs),
  ]

  const { payload, mdPath, jsonPath } = writeReports(steps)

  console.log(`Release gate ${payload.status}.`)
  console.log(`Passed: ${payload.summary.passed}`)
  console.log(`Failed: ${payload.summary.failed}`)
  console.log(`Skipped: ${payload.summary.skipped}`)
  console.log(`Report: ${path.relative(root, mdPath)}`)
  console.log(`JSON: ${path.relative(root, jsonPath)}`)
  if (payload.nextActions.length > 0) {
    console.log(`Next: ${payload.nextActions[0]}`)
  }

  if (payload.status !== 'pass') {
    process.exit(1)
  }
}

main()
