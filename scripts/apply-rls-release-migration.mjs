#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join } from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const envFileArg = args.find(arg => arg.startsWith('--env-file='))
const projectRefArg = args.find(arg => arg.startsWith('--project-ref='))
const poolerHostArg = args.find(arg => arg.startsWith('--pooler-host='))
const writeSqlArtifactArg = args.find(arg => arg === '--write-sql-artifact' || arg.startsWith('--write-sql-artifact='))
const wantsHelp = args.includes('--help') || args.includes('-h')
const KNOWN_PRODUCTION_PROJECT_REF = 'kjnqtplzylqxiklsnfoa'
const DEFAULT_SUPABASE_POOLER_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'
const RELEASE_MIGRATIONS = [
  'supabase/migrations/046_add_class_student_participation.sql',
  'supabase/migrations/071_create_quality_reports.sql',
  'supabase/migrations/072_lock_down_anon_business_tables.sql',
].map(relativePath => ({
  relativePath,
  path: join(root, relativePath),
}))

function loadDotEnvFile(envPath, { required = false } = {}) {
  if (!existsSync(envPath)) {
    if (required) {
      fail(`Missing env file: ${envPath}`)
    }
    return
  }

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
  }
}

function resolveEnvFile(value) {
  return isAbsolute(value) ? value : join(root, value)
}

if (wantsHelp) {
  printUsage()
  process.exit(0)
}

if (envFileArg) {
  loadDotEnvFile(resolveEnvFile(envFileArg.slice('--env-file='.length)), { required: true })
} else {
  loadDotEnvFile(join(root, '.env.local'))
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

const dbUrlFromEnv =
  process.env.XNHX_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL
const dbUrlEnvName = [
  'XNHX_SUPABASE_DB_URL',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
].find(key => Boolean(process.env[key]))
const dbPasswordEnvName = [
  'XNHX_SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_PASSWORD',
].find(key => Boolean(process.env[key]))
const dbPassword = dbPasswordEnvName ? process.env[dbPasswordEnvName] : null
const projectRefFromSupabaseUrl = inferProjectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const usesKnownProductionSupabaseUrl = looksLikeKnownProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const projectRef =
  projectRefArg?.slice('--project-ref='.length) ||
  process.env.XNHX_SUPABASE_PROJECT_REF ||
  process.env.SUPABASE_PROJECT_REF ||
  projectRefFromSupabaseUrl ||
  (usesKnownProductionSupabaseUrl ? KNOWN_PRODUCTION_PROJECT_REF : null)
const projectRefSource =
  projectRefArg ? '--project-ref' :
    process.env.XNHX_SUPABASE_PROJECT_REF ? 'XNHX_SUPABASE_PROJECT_REF' :
      process.env.SUPABASE_PROJECT_REF ? 'SUPABASE_PROJECT_REF' :
        projectRefFromSupabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' :
          usesKnownProductionSupabaseUrl ? 'known production NEXT_PUBLIC_SUPABASE_URL' :
            null
const poolerHost =
  poolerHostArg?.slice('--pooler-host='.length) ||
  process.env.XNHX_SUPABASE_POOLER_HOST ||
  process.env.SUPABASE_POOLER_HOST ||
  DEFAULT_SUPABASE_POOLER_HOST
const dbUrl = dbUrlFromEnv || (
  dbPassword && projectRef
    ? `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${poolerHost}:6543/postgres?sslmode=require`
    : null
)
const dbUrlSource = dbUrlEnvName || (
  dbPasswordEnvName && projectRefSource
    ? `${dbPasswordEnvName} + ${projectRefSource} via Supabase pooler`
    : null
)

const shouldAudit = args.includes('--audit')
const allowNonProductionHost = args.includes('--allow-any-host')
const dryRun = args.includes('--dry-run')
const printSql = args.includes('--print-sql')
const preflight = args.includes('--preflight')
const verifyOnly = args.includes('--verify-only')
const writeSqlArtifact = Boolean(writeSqlArtifactArg)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log([
    'Usage:',
    '  npm run db:apply-rls-release -- [options]',
    '',
    'Options:',
    '  --env-file=<path>     Load environment variables from a specific file.',
    '  --preflight           Validate DB URL, production host, psql, and audit env without applying migrations.',
    '  --audit               Run the Supabase RLS audit after applying the release bundle.',
    '  --dry-run             Print target and migration list without applying migrations.',
    '  --verify-only         Run release DB assertions, reload PostgREST schema cache, and optional audit without applying migrations.',
    '  --print-sql           Print the full SQL bundle for Supabase SQL Editor execution.',
    '  --write-sql-artifact[=<path>]',
    '                        Write the full SQL bundle to .gstack/qa-reports for Supabase SQL Editor execution.',
    '  --project-ref=<ref>    Supabase project ref for DB password based pooler connection.',
    '  --pooler-host=<host>   Supabase pooler host when deriving the DB URL from a password.',
    '  --allow-any-host      Allow applying to a host outside the known production host list.',
    '  --help, -h            Show this help text.',
    '',
    'Required for direct DB apply:',
    '  Set one of XNHX_SUPABASE_DB_URL, SUPABASE_DB_URL, or DATABASE_URL.',
    '  Or set XNHX_SUPABASE_DB_PASSWORD/SUPABASE_DB_PASSWORD.',
    `  For the known production URL, the runner defaults to project ref ${KNOWN_PRODUCTION_PROJECT_REF}.`,
    '  For any other URL, also set XNHX_SUPABASE_PROJECT_REF/SUPABASE_PROJECT_REF.',
    '',
    'Examples:',
    '  npm run db:apply-rls-release -- --print-sql',
    '  npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit',
    '  XNHX_SUPABASE_DB_PASSWORD="..." npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit',
    '  npm run db:apply-rls-release -- --env-file=.env.production.local --audit',
    '  npm run db:apply-rls-release -- --env-file=.env.production.local --verify-only --audit',
  ].join('\n'))
}

function releaseSqlHeader() {
  const envFileSuffix = envFileArg ? ` ${envFileArg}` : ''
  return [
    `-- Xiaoniuhaoxue production database release bundle`,
    `-- Generated by scripts/apply-rls-release-migration.mjs on ${new Date().toISOString()}`,
    '-- Sources:',
    ...RELEASE_MIGRATIONS.map(migration => `-- - ${migration.relativePath}`),
    '-- Includes production schema catch-up plus RLS/anon/PUBLIC hardening.',
    '-- Direct DB apply option:',
    `-- - Preflight: npm run db:apply-rls-release --${envFileSuffix} --preflight --audit`,
    `-- - Apply and audit: npm run db:apply-rls-release --${envFileSuffix} --audit`,
    `-- - DB connection: set a production Postgres URL, or set XNHX_SUPABASE_DB_PASSWORD/SUPABASE_DB_PASSWORD. The known production URL defaults to project ref ${KNOWN_PRODUCTION_PROJECT_REF}.`,
    '-- SQL Editor option:',
    '-- - Run this full bundle against the production Supabase database.',
    `-- - Then rerun: npm run release:after-db:wait --${envFileSuffix}`,
    '',
  ].join('\n')
}

function buildReleaseSql() {
  return RELEASE_MIGRATIONS
    .map(migration => [
      '-- ============================================',
      `-- Source: ${migration.relativePath}`,
      '-- ============================================',
      readFileSync(migration.path, 'utf8').trimEnd(),
      '',
    ].join('\n'))
    .join('\n')
}

function defaultSqlArtifactPath() {
  const today = new Date().toISOString().slice(0, 10)
  return join(root, '.gstack', 'qa-reports', `release-db-production-bundle-${today}.sql`)
}

function resolveWriteSqlArtifactPath() {
  if (!writeSqlArtifactArg || writeSqlArtifactArg === '--write-sql-artifact') {
    return defaultSqlArtifactPath()
  }

  const value = writeSqlArtifactArg.slice('--write-sql-artifact='.length)
  return isAbsolute(value) ? value : join(root, value)
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

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' })
  return !result.error && result.status === 0
}

function sanitizeOutput(value) {
  let output = String(value || '')

  if (dbUrl) {
    output = output.replaceAll(dbUrl, '[redacted-db-url]')
  }

  for (const key of [
    'XNHX_SUPABASE_DB_PASSWORD',
    'SUPABASE_DB_PASSWORD',
    'XNHX_SUPABASE_DB_URL',
    'SUPABASE_DB_URL',
    'DATABASE_URL',
  ]) {
    if (process.env[key]) {
      output = output.replaceAll(process.env[key], `[redacted-${key}]`)
    }
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-8)
    .join(' ')
}

function probeDatabaseConnection() {
  const result = spawnSync('psql', [
    dbUrl,
    '--set',
    'ON_ERROR_STOP=1',
    '--quiet',
    '--tuples-only',
    '--no-align',
    '--command',
    'select 1',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '10',
    },
    maxBuffer: 1024 * 1024,
  })

  if (result.error) {
    return result.error.message
  }

  if (result.status !== 0) {
    return sanitizeOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  }

  return null
}

function runPsqlCommand(label, psqlArgs) {
  const psql = spawnSync('psql', psqlArgs, {
    stdio: 'inherit',
  })

  if (psql.error) {
    fail(`Failed to start ${label}: ${psql.error.message}`)
  }

  if (psql.status !== 0) {
    fail(`${label} failed with exit code ${psql.status}`)
  }
}

function runReleaseAssertions() {
  console.log('Running release database assertions...')

  runPsqlCommand('release database assertions', [
    dbUrl,
    '--set',
    'ON_ERROR_STOP=1',
    '--quiet',
    '--command',
    releaseAssertionSql(),
  ])

  console.log('Release database assertions passed.')
}

function reloadPostgrestSchemaCache() {
  console.log('Reloading PostgREST schema cache...')

  runPsqlCommand('PostgREST schema cache reload', [
    dbUrl,
    '--set',
    'ON_ERROR_STOP=1',
    '--quiet',
    '--command',
    releaseSchemaCacheReloadSql(),
  ])

  console.log('PostgREST schema cache reload requested.')
}

function runRlsAuditIfRequested() {
  if (!shouldAudit) return

  console.log('Running RLS audit...')
  const auditArgs = ['scripts/audit-supabase-rls.mjs']
  if (envFileArg) {
    auditArgs.push(envFileArg)
  }

  const audit = spawnSync('node', auditArgs, { stdio: 'inherit', env: process.env })
  if (audit.error) {
    fail(`Failed to start audit: ${audit.error.message}`)
  }
  if (audit.status !== 0) {
    fail(`RLS audit failed with exit code ${audit.status}`)
  }
}

function runPreflight({ host, looksLikeExpectedProduction }) {
  const failures = []

  if (!dbUrl) {
    failures.push('Missing production database URL.')
    if (dbPassword && !projectRef) {
      failures.push('Missing Supabase project ref for DB password based connection. For non-production URLs, set XNHX_SUPABASE_PROJECT_REF or SUPABASE_PROJECT_REF.')
    }
  }

  if (dbUrl && !looksLikeExpectedProduction && !allowNonProductionHost) {
    failures.push(`Unexpected database host: ${host}`)
  }

  const hasPsql = commandExists('psql')
  if (!hasPsql) {
    failures.push('psql is not available in PATH.')
  }

  if (dbUrl && hasPsql) {
    const connectionError = probeDatabaseConnection()
    if (connectionError) {
      failures.push(`Unable to connect to production database with the configured URL: ${connectionError}`)
    }
  }

  if (shouldAudit) {
    const requiredAuditEnv = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
    const missingAuditEnv = requiredAuditEnv.filter(key => !process.env[key])
    if (missingAuditEnv.length > 0) {
      failures.push(`Missing audit env vars: ${missingAuditEnv.join(', ')}`)
    }
  }

  if (failures.length > 0) {
    fail([
      'Release database preflight failed:',
      ...failures.map(item => `- ${item}`),
      '',
      'Set one of: XNHX_SUPABASE_DB_URL, SUPABASE_DB_URL, DATABASE_URL.',
      `Or set XNHX_SUPABASE_DB_PASSWORD/SUPABASE_DB_PASSWORD. The known production URL defaults to project ref ${KNOWN_PRODUCTION_PROJECT_REF}; other URLs also need XNHX_SUPABASE_PROJECT_REF/SUPABASE_PROJECT_REF.`,
      'Use --env-file=.env.production.local if the production values live outside .env.local.',
    ].join('\n'))
  }

  console.log('Release database preflight passed.')
  console.log(`Database connection source: ${dbUrlSource}`)
  console.log(`Host: ${host}`)
  console.log(`Audit after apply: ${shouldAudit ? 'yes' : 'no'}`)
}

const missingMigrations = RELEASE_MIGRATIONS.filter(migration => !existsSync(migration.path))
if (missingMigrations.length > 0) {
  fail(`Missing migration file(s): ${missingMigrations.map(migration => migration.path).join(', ')}`)
}

if (printSql) {
  console.log(`${releaseSqlHeader()}${buildReleaseSql()}\n${releaseAssertionSql()}\n\n${releaseSchemaCacheReloadSql()}\n`)
  process.exit(0)
}

if (writeSqlArtifact) {
  const artifactPath = resolveWriteSqlArtifactPath()
  mkdirSync(dirname(artifactPath), { recursive: true })
  writeFileSync(artifactPath, `${releaseSqlHeader()}${buildReleaseSql()}\n${releaseAssertionSql()}\n\n${releaseSchemaCacheReloadSql()}\n`)
  console.log(`Release SQL artifact written: ${artifactPath}`)
  process.exit(0)
}

let parsedUrl = null
let host = null
let looksLikeExpectedProduction = false

if (dbUrl) {
  try {
    parsedUrl = new URL(dbUrl)
  } catch {
    fail('Database URL is not a valid URL.')
  }

  host = parsedUrl.hostname
  looksLikeExpectedProduction =
    host.includes('sbp-76uzx8fjpgfoyx2f') ||
    host.includes('supabase.opentrust.net') ||
    host === `db.${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co` ||
    (
      host.endsWith('.pooler.supabase.com') &&
      parsedUrl.username.includes(KNOWN_PRODUCTION_PROJECT_REF)
    )
}

if (preflight) {
  runPreflight({ host, looksLikeExpectedProduction })
  process.exit(0)
}

if (!dbUrl) {
  fail([
    'Missing production database URL.',
    'Set one of: XNHX_SUPABASE_DB_URL, SUPABASE_DB_URL, DATABASE_URL.',
    `Or set XNHX_SUPABASE_DB_PASSWORD/SUPABASE_DB_PASSWORD to derive the Supabase pooler URL for the known production project ${KNOWN_PRODUCTION_PROJECT_REF}.`,
    'For any other Supabase URL, also set XNHX_SUPABASE_PROJECT_REF/SUPABASE_PROJECT_REF.',
    'By default this script loads .env.local; pass --env-file=.env.production.local to load another file.',
    'Example: XNHX_SUPABASE_DB_URL="postgresql://..." npm run db:apply-rls-release -- --audit',
    'Example: XNHX_SUPABASE_DB_PASSWORD="..." npm run db:apply-rls-release -- --env-file=.env.production.local --audit',
    'For Supabase SQL Editor, run: npm run db:apply-rls-release -- --print-sql',
  ].join('\n'))
}

if (!looksLikeExpectedProduction && !allowNonProductionHost) {
  fail([
    `Refusing to apply release database bundle to unexpected host: ${host}`,
    'Pass --allow-any-host only after manually confirming this is the production database.',
  ].join('\n'))
}

console.log(`Applying release database bundle to host: ${host}`)
for (const migration of RELEASE_MIGRATIONS) {
  console.log(`Migration: ${migration.relativePath}`)
}

if (verifyOnly) {
  console.log('Verify-only mode. Migrations will not be applied.')
  runReleaseAssertions()
  reloadPostgrestSchemaCache()
  runRlsAuditIfRequested()
  process.exit(0)
}

if (dryRun) {
  console.log('Dry run only. Migrations were not applied.')
  process.exit(0)
}

for (const migration of RELEASE_MIGRATIONS) {
  console.log(`Applying ${migration.relativePath}...`)
  runPsqlCommand(migration.relativePath, [
    dbUrl,
    '--set',
    'ON_ERROR_STOP=1',
    '--quiet',
    '--file',
    migration.path,
  ])
}

console.log('Release database bundle applied.')
runReleaseAssertions()
reloadPostgrestSchemaCache()
runRlsAuditIfRequested()
