#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative } from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const envFileArg = args.find(arg => arg.startsWith('--env-file='))
const reportRootArg = args.find(arg => arg.startsWith('--report-dir='))
const sqlPathArg = args.find(arg => arg.startsWith('--sql-path='))
const skipFullGate = args.includes('--skip-full-gate')
const dbOnly = args.includes('--db-only') || args.includes('--quick')
const rlsRetriesArg = args.find(arg => arg.startsWith('--rls-retries='))
const rlsRetryDelayArg = args.find(arg => arg.startsWith('--rls-retry-delay-ms='))
const defaultEnvFile = existsSync(join(root, '.env.production.local'))
  ? '.env.production.local'
  : existsSync(join(root, '.env.local'))
    ? '.env.local'
    : null
const envFile = envFileArg?.slice('--env-file='.length) || defaultEnvFile
const reportRoot = join(root, reportRootArg?.slice('--report-dir='.length) || '.gstack/qa-reports')
const outputJson = join(reportRoot, `release-after-db-verify-${today}.json`)
const outputMd = join(reportRoot, `release-after-db-verify-${today}.md`)
const sqlPath = sqlPathArg?.slice('--sql-path='.length) || `.gstack/qa-reports/release-db-production-bundle-${today}.sql`
const rlsRetries = parseNonNegativeInteger(rlsRetriesArg, '--rls-retries', 0)
const rlsRetryDelayMs = parseNonNegativeInteger(rlsRetryDelayArg, '--rls-retry-delay-ms', 10000)

const onlinePasswordEnv = [
  'XNHX_OPERATOR_PASSWORD',
  'XNHX_SALES_PASSWORD',
  'XNHX_HEAD_TEACHER_PASSWORD',
  'XNHX_ACADEMIC_AFFAIRS_PASSWORD',
  'XNHX_ADMIN_PASSWORD',
]

function resolvePath(value) {
  return isAbsolute(value) ? value : join(root, value)
}

function displayPath(value) {
  return relative(root, value) || value
}

function parseNonNegativeInteger(arg, name, fallback) {
  if (!arg) return fallback

  const rawValue = arg.slice(`${name}=`.length)
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }

  return value
}

function loadDotEnvFile(value) {
  if (!value) return null

  const envPath = resolvePath(value)
  if (!existsSync(envPath)) {
    throw new Error(`Missing env file: ${value}`)
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

  return displayPath(envPath)
}

function hasEnv(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0
}

function tail(value, lines = 18) {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-lines)
    .join('\n')
}

function npmArgs(script, extraArgs = []) {
  return extraArgs.length > 0
    ? ['run', script, '--', ...extraArgs]
    : ['run', script]
}

function runStep(name, command, commandArgs, { skip = null, required = true } = {}) {
  const startedAt = Date.now()

  if (skip) {
    return {
      name,
      status: 'skipped',
      required,
      attempts: 0,
      durationMs: 0,
      reason: skip,
      command: [command, ...commandArgs].join(' '),
    }
  }

  console.log(`Running ${name}...`)
  const result = spawnSync(command, commandArgs, {
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
      attempts: 1,
      durationMs,
      command: [command, ...commandArgs].join(' '),
      exitCode: null,
      outputTail: result.error.message,
    }
  }

  return {
    name,
    status: result.status === 0 ? 'pass' : 'fail',
    required,
    attempts: 1,
    durationMs,
    command: [command, ...commandArgs].join(' '),
    exitCode: result.status,
    outputTail: tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
  }
}

function sleep(ms) {
  if (ms <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function runStepWithRetries(
  name,
  command,
  commandArgs,
  options = {},
  { retries = 0, delayMs = 0 } = {},
) {
  const failures = []

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const step = runStep(name, command, commandArgs, options)
    step.attempts = attempt + 1
    step.retryDelayMs = delayMs

    if (step.status !== 'fail' || attempt === retries) {
      if (failures.length > 0) {
        step.previousFailures = failures
      }
      return step
    }

    failures.push({
      attempt: attempt + 1,
      exitCode: step.exitCode,
      outputTail: step.outputTail,
    })
    console.log(`${name} failed on attempt ${attempt + 1}; retrying in ${delayMs}ms...`)
    sleep(delayMs)
  }

  throw new Error(`Unexpected retry loop exit for ${name}`)
}

function summarizeStatus(steps, { dbOnly = false, skipFullGate = false } = {}) {
  const requiredFailures = steps.filter(step => step.required && step.status === 'fail')
  const requiredSkips = steps.filter(step => step.required && step.status === 'skipped')
  const rlsStep = steps.find(step => step.name === 'supabase rls audit')
  const gateStep = steps.find(step => step.name === 'release gate')

  if (
    requiredFailures.length === 0 &&
    requiredSkips.length === 0 &&
    gateStep?.status === 'skipped' &&
    (dbOnly || skipFullGate)
  ) {
    return 'ready-for-gate'
  }

  if (requiredFailures.length === 0 && requiredSkips.length === 0) {
    return 'pass'
  }

  if (rlsStep?.status === 'fail') {
    return 'blocked'
  }

  if (gateStep?.status === 'skipped') {
    return 'ready-for-gate'
  }

  return 'fail'
}

function buildNextActions(status, steps, { dbOnly = false } = {}) {
  const actions = []
  const stepByName = new Map(steps.map(step => [step.name, step]))
  const envSuffix = envFile ? ` --env-file=${envFile}` : ''
  const retryCommand = dbOnly ? 'npm run release:after-db:quick' : 'npm run release:after-db'
  const waitCommand = dbOnly
    ? `npm run release:after-db:wait --${envSuffix}`
    : `${retryCommand} --${envSuffix} --rls-retries=6 --rls-retry-delay-ms=10000`

  if (stepByName.get('release db bundle audit')?.status === 'fail') {
    actions.push(`Refresh the SQL bundle with \`npm run db:write-rls-release-sql --${envSuffix}\`, then rerun \`${retryCommand} --${envSuffix}\`.`)
  }

  if (stepByName.get('supabase rls audit')?.status === 'fail') {
    actions.push(`Run the full SQL bundle in the production Supabase SQL Editor, then rerun the waiting verifier: \`${waitCommand}\`.`)
    actions.push(`For an immediate one-shot failure report after checking the SQL Editor assertion output, rerun \`${retryCommand} --${envSuffix}\`.`)
  }

  const releaseGateStep = stepByName.get('release gate')
  if (releaseGateStep?.status === 'skipped') {
    const explicitGateSkip = releaseGateStep.reason?.includes('--db-only') ||
      releaseGateStep.reason?.includes('--quick') ||
      releaseGateStep.reason?.includes('--skip-full-gate')

    if (explicitGateSkip && status === 'ready-for-gate') {
      actions.push(`DB-side verification passed. Inject the five online regression password env vars (${onlinePasswordEnv.join(', ')}), then run \`npm run release:after-db --${envSuffix}\` for final release sign-off.`)
    } else if (!explicitGateSkip) {
      actions.push(`Inject the five online regression password env vars (${onlinePasswordEnv.join(', ')}), then rerun \`npm run release:after-db --${envSuffix}\`.`)
    }
  }

  if (status === 'pass') {
    actions.push('Post-DB verification and the full release gate passed. Proceed to final release sign-off.')
  }

  if (actions.length === 0) {
    actions.push('Fix the failing step above, then rerun `npm run release:after-db`.')
  }

  return actions
}

function writeReports(payload) {
  mkdirSync(dirname(outputJson), { recursive: true })
  writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`)

  const lines = [
    `# Release After-DB Verify - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Mode: ${payload.mode}`,
    `- Env file loaded: ${payload.envFile || 'none'}`,
    `- SQL bundle: ${payload.sqlPath}`,
    `- Passed: ${payload.summary.passed}`,
    `- Failed: ${payload.summary.failed}`,
    `- Skipped: ${payload.summary.skipped}`,
    '',
    '## Next Actions',
    '',
    ...payload.nextActions.map((action, index) => `${index + 1}. ${action}`),
    '',
    '## Steps',
    '',
    '| Step | Required | Status | ms | Command / Reason |',
    '|---|---:|---|---:|---|',
    ...payload.steps.map(step => {
      const attempts = step.attempts && step.attempts > 1 ? ` (${step.attempts} attempts)` : ''
      const commandOrReason = step.status === 'skipped'
        ? step.reason
        : step.command
      return `| ${step.name} | ${step.required ? 'yes' : 'no'} | ${step.status.toUpperCase()}${attempts} | ${step.durationMs} | ${commandOrReason || ''} |`
    }),
  ]

  const failureSteps = payload.steps.filter(step => step.status === 'fail')
  if (failureSteps.length > 0) {
    lines.push(
      '',
      '## Failure Output',
      '',
      ...failureSteps.flatMap(step => [
        `### ${step.name}`,
        '',
        '```text',
        step.outputTail || '(no output)',
        '```',
        '',
      ]),
    )
  }

  writeFileSync(outputMd, `${lines.join('\n')}\n`)
}

function main() {
  const loadedEnvFile = loadDotEnvFile(envFile)
  const envArg = envFile ? [`--env-file=${envFile}`] : []
  const hasOnlinePasswords = onlinePasswordEnv.every(hasEnv)
  const resolvedSqlPath = resolvePath(sqlPath)

  const steps = []
  steps.push(runStep('release db bundle audit', 'npm', npmArgs('audit:release-db-bundle', [`--path=${sqlPath}`])))
  steps.push(runStepWithRetries(
    'supabase rls audit',
    'npm',
    npmArgs('audit:rls', envArg),
    {},
    { retries: rlsRetries, delayMs: rlsRetryDelayMs },
  ))
  steps.push(runStep('release unblock status', 'npm', npmArgs('release:unblock', envArg), { required: false }))

  const rlsPassed = steps.find(step => step.name === 'supabase rls audit')?.status === 'pass'
  steps.push(runStep(
    'release gate',
    'npm',
    npmArgs('release:gate', envArg),
    {
      skip: dbOnly
        ? 'full release gate skipped by --db-only/--quick'
        : skipFullGate
          ? 'full release gate skipped by --skip-full-gate'
          : !rlsPassed
            ? 'supabase rls audit must pass before rerunning the full release gate'
            : hasOnlinePasswords
              ? null
              : `missing required online password env vars: ${onlinePasswordEnv.join(', ')}`,
      required: !(dbOnly || skipFullGate),
    },
  ))

  const summary = {
    total: steps.length,
    passed: steps.filter(step => step.status === 'pass').length,
    failed: steps.filter(step => step.status === 'fail').length,
    skipped: steps.filter(step => step.status === 'skipped').length,
    requiredFailures: steps.filter(step => step.required && step.status === 'fail').length,
    requiredSkips: steps.filter(step => step.required && step.status === 'skipped').length,
  }
  const status = summarizeStatus(steps, { dbOnly, skipFullGate })
  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    mode: dbOnly ? 'db-only' : skipFullGate ? 'skip-full-gate' : 'full',
    envFile: loadedEnvFile,
    sqlPath: displayPath(resolvedSqlPath),
    retryPolicy: {
      rlsRetries,
      rlsRetryDelayMs,
    },
    summary,
    nextActions: buildNextActions(status, steps, { dbOnly }),
    steps,
  }

  writeReports(payload)

  console.log(`Release after-DB verify ${status}.`)
  console.log(`Passed: ${summary.passed}`)
  console.log(`Failed: ${summary.failed}`)
  console.log(`Skipped: ${summary.skipped}`)
  console.log(`Report: ${displayPath(outputMd)}`)
  console.log(`JSON: ${displayPath(outputJson)}`)
  if (payload.nextActions.length > 0) {
    console.log(`Next: ${payload.nextActions[0]}`)
  }

  const successStatuses = new Set(['pass'])
  if (dbOnly || skipFullGate) {
    successStatuses.add('ready-for-gate')
  }

  if (!successStatuses.has(status)) {
    process.exit(1)
  }
}

main()
