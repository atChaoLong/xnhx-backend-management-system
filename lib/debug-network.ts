/**
 * 网络连接调试工具
 * 用于诊断 Vercel 到 Supabase 的连接问题
 */

import { createLogger } from './logger'

const logger = createLogger('NetworkDebug')

export interface NetworkTestResult {
  test: string
  success: boolean
  duration: number
  error?: string
  details?: any
}

/**
 * 测试 Supabase 连接
 */
export async function testSupabaseConnection(): Promise<{
  supabaseUrl: string
  region: string
  tests: NetworkTestResult[]
  summary: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const results: NetworkTestResult[] = []

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 未配置')
  }

  // 解析 Supabase URL 获取区域信息
  const url = new URL(supabaseUrl)
  const region = extractRegionFromUrl(supabaseUrl)

  logger.info('开始网络连接测试', { supabaseUrl, region })

  // 测试 1: DNS 解析
  results.push(await testDnsResolution(url.hostname))

  // 测试 2: TCP 连接
  results.push(await testTcpConnection(url.hostname, url.protocol === 'https:' ? 443 : 80))

  // 测试 3: HTTP 请求
  results.push(await testHttpRequest(supabaseUrl))

  // 测试 4: Supabase Health Check
  results.push(await testSupabaseHealth(supabaseUrl))

  // 生成总结
  const successCount = results.filter((r) => r.success).length
  const summary = `网络测试完成: ${successCount}/${results.length} 通过`

  logger.info(summary, { results })

  return {
    supabaseUrl,
    region,
    tests: results,
    summary,
  }
}

/**
 * 从 Supabase URL 提取区域信息
 */
function extractRegionFromUrl(url: string): string {
  // Supabase URL 格式: https://[project].supabase.co
  // 或使用区域: https://[project].[region].supabase.co

  const match = url.match(/\/\/[^.]+\.([^.]+)\.supabase\.co/)
  if (match) {
    return match[1] // 可能是区域或 "supabase"
  }

  const hostname = new URL(url).hostname
  if (hostname.includes('.supabase.co')) {
    return '默认区域 (可能是 us-east-1)'
  }

  return '未知'
}

/**
 * 测试 DNS 解析
 */
async function testDnsResolution(hostname: string): Promise<NetworkTestResult> {
  const startTime = Date.now()

  try {
    // 在 Node.js 环境中，我们无法直接做 DNS 查询
    // 但可以通过 fetch 来间接测试
    const response = await fetch(`https://1.1.1.1/dns-query?name=${hostname}&type=A`, {
      headers: {
        Accept: 'application/dns-json',
      },
    })

    const duration = Date.now() - startTime

    if (response.ok) {
      const data = await response.json()
      const answers = (data as any).Answer || []

      return {
        test: 'DNS 解析',
        success: answers.length > 0,
        duration,
        details: { hostname, answers },
      }
    }

    return {
      test: 'DNS 解析',
      success: false,
      duration,
      error: `DNS 查询失败: ${response.status}`,
    }
  } catch (error: any) {
    return {
      test: 'DNS 解析',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    }
  }
}

/**
 * 测试 TCP 连接（通过 fetch 间接测试）
 */
async function testTcpConnection(
  hostname: string,
  port: number
): Promise<NetworkTestResult> {
  const startTime = Date.now()

  try {
    // 尝试连接到 Supabase
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`https://${hostname}:${port}`, {
      method: 'HEAD',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime

    return {
      test: `TCP 连接 (端口 ${port})`,
      success: true,
      duration,
      details: { hostname, port, status: response.status },
    }
  } catch (error: any) {
    return {
      test: `TCP 连接 (端口 ${port})`,
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
      details: {
        hostname,
        port,
        isVercel: process.env.VERCEL === '1',
        vercelEnv: process.env.VERCEL_ENV,
      },
    }
  }
}

/**
 * 测试 HTTP 请求
 */
async function testHttpRequest(supabaseUrl: string): Promise<NetworkTestResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        prefer: 'return=representation',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime

    return {
      test: 'HTTP 请求到 Supabase REST API',
      success: response.ok || response.status === 406, // 406 表示可访问但需要正确的请求
      duration,
      details: { status: response.status, statusText: response.statusText },
    }
  } catch (error: any) {
    return {
      test: 'HTTP 请求到 Supabase REST API',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    }
  }
}

/**
 * 测试 Supabase 健康检查
 */
async function testSupabaseHealth(supabaseUrl: string): Promise<NetworkTestResult> {
  const startTime = Date.now()

  try {
    // Supabase 没有公开的 health check endpoint
    // 但我们可以尝试访问一个已知存在的端点
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${supabaseUrl}`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime

    return {
      test: 'Supabase 项目访问',
      success: response.ok || response.status < 500,
      duration,
      details: { status: response.status, statusText: response.statusText },
    }
  } catch (error: any) {
    return {
      test: 'Supabase 项目访问',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
      details: {
        isVercel: process.env.VERCEL === '1',
        vercelEnv: process.env.VERCEL_ENV,
        vercelRegion: process.env.VERCEL_REGION,
      },
    }
  }
}

/**
 * 获取环境诊断信息
 */
export function getEnvironmentDiagnostics(): {
  isVercel: boolean
  vercelEnv: string | undefined
  vercelRegion: string | undefined
  nodeVersion: string
  supabaseUrl: string | undefined
  supabaseRegion: string
} {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return {
    isVercel: process.env.VERCEL === '1',
    vercelEnv: process.env.VERCEL_ENV,
    vercelRegion: process.env.VERCEL_REGION,
    nodeVersion: process.version,
    supabaseUrl,
    supabaseRegion: supabaseUrl ? extractRegionFromUrl(supabaseUrl) : '未配置',
  }
}
