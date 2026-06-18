#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apiRoot = path.join(root, 'app/api')
const routePermissionFile = path.join(root, 'lib/route-permissions.ts')

const publicPaths = new Set([
  '/api/health',
  '/api/init-admin',
  '/api/classin/callback',
])

const publicPrefixes = [
  '/api/auth',
  '/api/teacher-form',
]

function walkRouteFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walkRouteFiles(fullPath, out)
      continue
    }

    if (entry.isFile() && entry.name === 'route.ts') {
      out.push(fullPath)
    }
  }

  return out
}

function routeFromFile(filePath) {
  const relativeRoutePath = path.relative(apiRoot, filePath).replace(/\/route\.ts$/, '')
  return `/api/${relativeRoutePath.split(path.sep).join('/')}`
}

function isPublicRoute(routePath) {
  return publicPaths.has(routePath) ||
    publicPrefixes.some(prefix => routePath === prefix || routePath.startsWith(`${prefix}/`))
}

function exportedMethods(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)]
    .map(match => match[1])
}

function readPermissionMap() {
  const source = fs.readFileSync(routePermissionFile, 'utf8')
  const routeStarts = [...source.matchAll(/\n\s*'(?<path>\/api\/[^']+)'\s*:\s*\{/g)]
    .map(match => ({ routePath: match.groups.path, index: match.index }))
  const endIndex = source.indexOf('\n} as const')
  const permissionMap = new Map()

  for (let i = 0; i < routeStarts.length; i += 1) {
    const current = routeStarts[i]
    const nextIndex = routeStarts[i + 1]?.index ?? endIndex
    const block = source.slice(current.index, nextIndex)
    const methods = [...block.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s*:/g)]
      .map(match => match[1])

    permissionMap.set(current.routePath, new Set(methods))
  }

  return permissionMap
}

function main() {
  if (!fs.existsSync(apiRoot)) {
    throw new Error(`Missing API directory: ${path.relative(root, apiRoot)}`)
  }

  if (!fs.existsSync(routePermissionFile)) {
    throw new Error(`Missing route permission file: ${path.relative(root, routePermissionFile)}`)
  }

  const routeFiles = walkRouteFiles(apiRoot).sort()
  const permissionMap = readPermissionMap()
  const missing = []

  for (const filePath of routeFiles) {
    const routePath = routeFromFile(filePath)
    if (isPublicRoute(routePath)) continue

    for (const method of exportedMethods(filePath)) {
      if (!permissionMap.get(routePath)?.has(method)) {
        missing.push(`${method} ${routePath} (${path.relative(root, filePath)})`)
      }
    }
  }

  const protectedRouteCount = routeFiles.filter(filePath => !isPublicRoute(routeFromFile(filePath))).length

  console.log(`API route permission audit: ${protectedRouteCount}/${routeFiles.length} protected route files checked`)
  console.log(`Permission table entries: ${permissionMap.size}`)

  if (missing.length > 0) {
    console.error('\nMissing route permission mappings:')
    for (const item of missing) {
      console.error(`- ${item}`)
    }
    process.exitCode = 1
    return
  }

  console.log('No missing protected API route permission mappings.')
}

main()
