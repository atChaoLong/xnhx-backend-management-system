#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migrationsRoot = path.join(root, 'supabase', 'migrations')
const reportRoot = path.join(root, '.gstack', 'qa-reports')
const today = new Date().toISOString().slice(0, 10)
const args = process.argv.slice(2)
const envFileArg = args.find(arg => arg.startsWith('--env-file='))

const requiredTables = new Set([
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
])

const sourceRoots = ['app', 'lib', 'components', 'hooks']
const failures = []
const warnings = []

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

    const value = rawValue
      .replace(/^(['"])(.*)\1$/, '$2')
      .replace(/\\n/g, '\n')

    process.env[key] = value
  }
}

function loadEnv() {
  if (envFileArg) {
    loadDotEnvFile(resolveEnvFile(envFileArg.slice('--env-file='.length)), { required: true })
    return
  }

  loadDotEnvFile(path.join(root, '.env.local'))
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, out)
    } else if (entry.isFile() && predicate(fullPath)) {
      out.push(fullPath)
    }
  }

  return out
}

function stripSqlComments(source) {
  return source
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function cleanTableName(value) {
  return value.replace(/^public\./i, '').replace(/^"|"$/g, '').toLowerCase()
}

function createCoverageItem(table) {
  return {
    table,
    createdIn: new Set(),
    rlsEnabledIn: new Set(),
    anonRevokedIn: new Set(),
    publicRevokedIn: new Set(),
    policyFiles: new Set(),
    policyCount: 0,
  }
}

function getCoverageItem(coverage, table) {
  const item = coverage.get(table) ?? createCoverageItem(table)
  coverage.set(table, item)
  return item
}

function extractSqlArrayValues(source, arrayName) {
  const match = source.match(new RegExp(`${arrayName}\\s+TEXT\\[\\]\\s*:=\\s*ARRAY\\s*\\[([\\s\\S]*?)\\]`, 'i'))
  if (!match) return []

  return [...match[1].matchAll(/'([^']+)'/g)]
    .map(valueMatch => cleanTableName(valueMatch[1]))
    .filter(Boolean)
}

function applyDynamicLoopCoverage(cleanSource, relativeFile, coverage) {
  const businessTables = extractSqlArrayValues(cleanSource, 'business_tables')
  if (businessTables.length === 0) return

  const hasDynamicRls = /\bALTER\s+TABLE\s+public\.%I\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(cleanSource)
  const hasDynamicAnonRevoke = /\bREVOKE\b[\s\S]*?\bON\s+TABLE\s+public\.%I[\s\S]*?\bFROM\s+anon\b/i.test(cleanSource)
  const hasDynamicPublicRevoke = /\bREVOKE\b[\s\S]*?\bON\s+TABLE\s+public\.%I[\s\S]*?\bFROM\s+PUBLIC\b/i.test(cleanSource)

  for (const table of businessTables) {
    const item = getCoverageItem(coverage, table)
    if (hasDynamicRls) item.rlsEnabledIn.add(relativeFile)
    if (hasDynamicAnonRevoke) item.anonRevokedIn.add(relativeFile)
    if (hasDynamicPublicRevoke) item.publicRevokedIn.add(relativeFile)
  }
}

function parseMigrationCoverage() {
  const coverage = new Map()
  const sqlFiles = walkFiles(migrationsRoot, file => file.endsWith('.sql')).sort()

  for (const file of sqlFiles) {
    const relativeFile = path.relative(root, file)
    const cleanSource = stripSqlComments(fs.readFileSync(file, 'utf8'))

    applyDynamicLoopCoverage(cleanSource, relativeFile, coverage)

    const statements = cleanSource
      .split(';')
      .map(statement => statement.trim())
      .filter(Boolean)

    for (const statement of statements) {
      const createMatch = statement.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:public\.)?"?[A-Za-z0-9_]+"?)/i)
      const rlsMatch = statement.match(/\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?((?:public\.)?"?[A-Za-z0-9_]+"?)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i)
      const policyMatch = statement.match(/\bCREATE\s+POLICY\b[\s\S]*?\bON\s+(?:TABLE\s+)?((?:public\.)?"?[A-Za-z0-9_]+"?)/i)
      const revokeMatch = statement.match(/\bREVOKE\b[\s\S]*?\bON\s+TABLE\s+((?:public\.)?"?[A-Za-z0-9_]+"?)[\s\S]*?\bFROM\s+(anon|PUBLIC)\b/i)

      for (const [kind, match] of [
        ['createdIn', createMatch],
        ['rlsEnabledIn', rlsMatch],
      ]) {
        if (!match) continue

        const table = cleanTableName(match[1])
        const item = getCoverageItem(coverage, table)

        item[kind].add(relativeFile)
      }

      if (policyMatch) {
        const table = cleanTableName(policyMatch[1])
        const item = getCoverageItem(coverage, table)

        item.policyFiles.add(relativeFile)
        item.policyCount += 1
      }

      if (revokeMatch) {
        const table = cleanTableName(revokeMatch[1])
        const role = revokeMatch[2].toLowerCase()
        const item = getCoverageItem(coverage, table)

        if (role === 'anon') {
          item.anonRevokedIn.add(relativeFile)
        } else if (role === 'public') {
          item.publicRevokedIn.add(relativeFile)
        }
      }
    }
  }

  return coverage
}

function parseAppTableReferences() {
  const references = new Map()
  const files = sourceRoots.flatMap(dir => walkFiles(path.join(root, dir), file => /\.(ts|tsx|js|jsx|mjs)$/.test(file))).sort()

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\.from\(\s*['"`]([A-Za-z0-9_]+)['"`]\s*\)/g)) {
      const table = match[1].toLowerCase()
      const item = references.get(table) ?? new Set()
      item.add(path.relative(root, file))
      references.set(table, item)
    }
  }

  return references
}

function summarizeStaticCoverage(coverage, references) {
  const tables = new Set([...requiredTables, ...references.keys()])
  const rows = [...tables].sort().map(table => {
    const item = coverage.get(table)
    const referencedIn = [...(references.get(table) ?? [])].sort()

    return {
      table,
      required: requiredTables.has(table),
      referenced: referencedIn.length > 0,
      referencedIn,
      createdIn: [...(item?.createdIn ?? [])].sort(),
      rlsEnabledIn: [...(item?.rlsEnabledIn ?? [])].sort(),
      anonRevokedIn: [...(item?.anonRevokedIn ?? [])].sort(),
      publicRevokedIn: [...(item?.publicRevokedIn ?? [])].sort(),
      policyCount: item?.policyCount ?? 0,
      policyFiles: [...(item?.policyFiles ?? [])].sort(),
    }
  })

  for (const row of rows) {
    if (!row.required && !row.referenced) continue

    if (row.rlsEnabledIn.length === 0) {
      failures.push(`${row.table}: missing ENABLE ROW LEVEL SECURITY migration coverage`)
    }

    if (row.required && row.anonRevokedIn.length === 0) {
      failures.push(`${row.table}: missing anon privilege revoke migration coverage`)
    }

    if (row.required && row.publicRevokedIn.length === 0) {
      failures.push(`${row.table}: missing PUBLIC privilege revoke migration coverage`)
    }

    if (row.policyCount === 0) {
      warnings.push(`${row.table}: no CREATE POLICY statement found in migrations`)
    }

    if (row.referenced && row.createdIn.length === 0) {
      warnings.push(`${row.table}: referenced by app code but no CREATE TABLE migration was found`)
    }
  }

  return rows
}

function isPermissionDenied(error) {
  if (!error) return false

  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return text.includes('permission denied') ||
    text.includes('row-level security') ||
    text.includes('rls') ||
    text.includes('jwt') ||
    text.includes('not authorized') ||
    text.includes('42501')
}

function buildRemediation(anonymousChecks) {
  if (failures.length === 0) return []

  const exposedTables = anonymousChecks
    .filter(check => check.status === 'exposed')
    .map(check => check.table)
    .sort()
  const schemaCacheTables = anonymousChecks
    .filter(check => check.errorCode === 'PGRST205')
    .map(check => check.table)
    .sort()
  const actions = []

  if (exposedTables.length > 0) {
    actions.push(`Anon-key direct SELECT still returned rows for ${exposedTables.length} required table(s): ${exposedTables.join(', ')}. Apply the production DB release bundle to revoke anon/PUBLIC SELECT and enforce RLS.`)
  }

  if (schemaCacheTables.length > 0) {
    actions.push(`Required table(s) are missing from the PostgREST schema cache or production schema: ${schemaCacheTables.join(', ')}. Apply the schema catch-up migrations and run the PostgREST schema cache reload included in the release bundle.`)
  }

  actions.push('Direct DB apply path: set a production Postgres URL, or set `XNHX_SUPABASE_DB_PASSWORD` / `SUPABASE_DB_PASSWORD` so the runner can derive the known production Supabase pooler URL; then run `npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit` followed by `npm run db:apply-rls-release -- --env-file=.env.production.local --audit`.')
  actions.push(`Supabase SQL Editor path: run \`.gstack/qa-reports/release-db-production-bundle-${today}.sql\` in production, confirm the assertion block and \`NOTIFY pgrst, 'reload schema'\` complete, then rerun \`npm run release:after-db:wait -- --env-file=.env.production.local\`.`)
  actions.push('After quick DB-side verification reports READY-FOR-GATE, rerun `npm run release:after-db -- --env-file=.env.production.local` with online password environment variables injected for final release sign-off.')

  return actions
}

async function runAnonymousExposureChecks(tables) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    warnings.push('Skipping anonymous exposure checks: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return []
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const results = []

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1)

    if (error) {
      const blocked = isPermissionDenied(error)
      if (!blocked) {
        failures.push(`${table}: anonymous SELECT returned unexpected error ${error.code ?? 'unknown'}; cannot verify table exists and blocks anon access`)
      }

      results.push({
        table,
        status: blocked ? 'blocked' : 'error',
        errorCode: error.code ?? null,
        message: error.message ?? null,
      })
      continue
    }

    const rowCount = Array.isArray(data) ? data.length : 0
    if (rowCount > 0) {
      const message = `${table}: anonymous anon-key SELECT returned ${rowCount} row(s)`
      failures.push(message)
      results.push({ table, status: 'exposed', rowCount })
      continue
    }

    warnings.push(`${table}: anonymous SELECT returned 0 rows; static RLS coverage is still the stronger signal`)
    results.push({ table, status: 'empty', rowCount })
  }

  return results
}

function writeReports(staticRows, anonymousChecks) {
  fs.mkdirSync(reportRoot, { recursive: true })
  const remediation = buildRemediation(anonymousChecks)

  const jsonPath = path.join(reportRoot, `supabase-rls-audit-${today}.json`)
  const mdPath = path.join(reportRoot, `supabase-rls-audit-${today}.md`)
  const payload = {
    generatedAt: new Date().toISOString(),
    status: failures.length === 0 ? 'pass' : 'fail',
    summary: {
      tablesChecked: staticRows.length,
      requiredTables: requiredTables.size,
      failures: failures.length,
      warnings: warnings.length,
      anonymousChecks: anonymousChecks.length,
    },
    failures,
    warnings,
    remediation,
    staticRows,
    anonymousChecks,
  }

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`)

  const lines = [
    `# Supabase RLS Audit - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Tables checked: ${payload.summary.tablesChecked}`,
    `- Required tables: ${payload.summary.requiredTables}`,
    `- Failures: ${payload.summary.failures}`,
    `- Warnings: ${payload.summary.warnings}`,
    `- Anonymous checks: ${payload.summary.anonymousChecks}`,
    '',
    '## Failures',
    '',
    failures.length > 0 ? failures.map(item => `- ${item}`).join('\n') : '- None',
    '',
    '## Warnings',
    '',
    warnings.length > 0 ? warnings.map(item => `- ${item}`).join('\n') : '- None',
    '',
    '## Remediation',
    '',
    remediation.length > 0 ? remediation.map(item => `- ${item}`).join('\n') : '- None',
    '',
    '## Static Coverage',
    '',
    '| Table | Required | Referenced | RLS enabled | Anon revoked | PUBLIC revoked | Policy count |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...staticRows.map(row => `| ${row.table} | ${row.required ? 'yes' : 'no'} | ${row.referenced ? 'yes' : 'no'} | ${row.rlsEnabledIn.length > 0 ? 'yes' : 'no'} | ${row.anonRevokedIn.length > 0 ? 'yes' : 'no'} | ${row.publicRevokedIn.length > 0 ? 'yes' : 'no'} | ${row.policyCount} |`),
    '',
    '## Anonymous Direct SELECT',
    '',
    '| Table | Status | Details |',
    '|---|---|---|',
    ...anonymousChecks.map(check => {
      const details = check.errorCode ? `${check.errorCode}: ${check.message ?? ''}` : `rows=${check.rowCount ?? ''}`
      return `| ${check.table} | ${check.status} | ${details.replace(/\|/g, '/') || '-'} |`
    }),
    '',
  ]

  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`)

  return { jsonPath, mdPath }
}

async function main() {
  loadEnv()

  if (!fs.existsSync(migrationsRoot)) {
    throw new Error(`Missing migrations directory: ${path.relative(root, migrationsRoot)}`)
  }

  const coverage = parseMigrationCoverage()
  const references = parseAppTableReferences()
  const staticRows = summarizeStaticCoverage(coverage, references)
  const anonymousTables = staticRows
    .filter(row => row.required)
    .map(row => row.table)
    .sort()
  const anonymousChecks = await runAnonymousExposureChecks(anonymousTables)
  const { jsonPath, mdPath } = writeReports(staticRows, anonymousChecks)

  console.log(`Supabase RLS audit ${failures.length === 0 ? 'passed' : 'failed'}.`)
  console.log(`Tables checked: ${staticRows.length}`)
  console.log(`Failures: ${failures.length}`)
  console.log(`Warnings: ${warnings.length}`)
  console.log(`Report: ${path.relative(root, mdPath)}`)
  console.log(`JSON: ${path.relative(root, jsonPath)}`)

  if (failures.length > 0) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
