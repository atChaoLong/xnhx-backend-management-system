#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const reportRootArg = args.find(arg => arg.startsWith('--report-dir='))
const reportRoot = path.resolve(root, reportRootArg?.slice('--report-dir='.length) || '.gstack/qa-reports')
const outputJson = path.join(reportRoot, `release-artifacts-audit-${today}.json`)
const outputMd = path.join(reportRoot, `release-artifacts-audit-${today}.md`)

const scannedExtensions = new Set(['.json', '.md', '.txt'])
const ignoredBasenames = new Set([
  path.basename(outputJson),
  path.basename(outputMd),
])

const secretPatterns = [
  {
    id: 'auth-cookie-token',
    label: 'Unredacted xnhx auth cookie token',
    pattern: /\bxnhx_(?:access|refresh)_token=(?!\[redacted\])[^;,\s`]+/i,
  },
  {
    id: 'json-session-token',
    label: 'Unredacted JSON access/refresh token',
    pattern: /"(?:access_token|refresh_token)"\s*:\s*"(?!\[redacted\])[^"]{12,}"/i,
  },
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
    id: 'cookie-header',
    label: 'Raw cookie/set-cookie header',
    pattern: /\b(?:set-cookie|cookie)\s*:/i,
  },
  {
    id: 'password-value',
    label: 'Inline password-like value',
    pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s,;`]{6,}/i,
  },
]

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, out)
      continue
    }

    if (!entry.isFile()) continue
    if (ignoredBasenames.has(entry.name)) continue
    if (!scannedExtensions.has(path.extname(entry.name))) continue
    out.push(fullPath)
  }

  return out
}

function lineExcerpt(line) {
  return line
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[jwt-redacted]')
    .replace(/\bxnhx_(access|refresh)_token=[^;,\s`]+/gi, 'xnhx_$1_token=[redacted]')
    .replace(/"(access_token|refresh_token)"\s*:\s*"[^"]+"/gi, '"$1":"[redacted]"')
    .replace(/\b(authorization\s*:\s*bearer)\s+[A-Za-z0-9._-]{8,}/gi, '$1 [redacted]')
    .replace(/\b(password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s,;`]+/gi, '$1=[redacted]')
    .slice(0, 220)
}

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const findings = []
  const lines = text.split(/\r?\n/)

  for (const [index, line] of lines.entries()) {
    for (const pattern of secretPatterns) {
      if (!pattern.pattern.test(line)) continue

      findings.push({
        file: path.relative(root, file),
        line: index + 1,
        rule: pattern.id,
        label: pattern.label,
        excerpt: lineExcerpt(line),
      })
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
      `- ${finding.file}:${finding.line} [${finding.rule}] ${finding.label}: \`${finding.excerpt.replace(/\|/g, '/')}\``
    ))

  fs.writeFileSync(outputMd, [
    `# Release Artifacts Audit - ${today}`,
    '',
    `- Status: ${payload.status.toUpperCase()}`,
    `- Files scanned: ${payload.summary.filesScanned}`,
    `- Findings: ${payload.summary.findings}`,
    `- Report dir: ${path.relative(root, reportRoot)}`,
    '',
    '## Findings',
    '',
    ...findingLines,
    '',
  ].join('\n'))
}

function main() {
  const files = walkFiles(reportRoot).sort()
  const findings = files.flatMap(scanFile)
  const payload = {
    generatedAt: new Date().toISOString(),
    status: findings.length === 0 ? 'pass' : 'fail',
    reportDir: path.relative(root, reportRoot),
    summary: {
      filesScanned: files.length,
      findings: findings.length,
    },
    findings,
  }

  writeReport(payload)

  if (payload.status === 'pass') {
    console.log(`Release artifacts audit passed. Files scanned: ${files.length}`)
    console.log(`Report: ${path.relative(root, outputMd)}`)
    console.log(`JSON: ${path.relative(root, outputJson)}`)
    return
  }

  console.error(`Release artifacts audit failed. Findings: ${findings.length}`)
  console.error(`Report: ${path.relative(root, outputMd)}`)
  console.error(`JSON: ${path.relative(root, outputJson)}`)
  process.exit(1)
}

main()
