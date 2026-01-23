/**
 * 网络连接调试 API
 * 用于诊断 Vercel 到 Supabase 的连接问题
 *
 * 使用方法：
 * GET /api/debug/network-test
 *
 * 这个 API 会测试：
 * 1. 环境变量配置
 * 2. DNS 解析
 * 3. TCP 连接
 * 4. HTTP 请求
 * 5. Supabase 健康状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import {
  testSupabaseConnection,
  getEnvironmentDiagnostics,
} from '@/lib/debug-network'

const logger = createLogger('Debug:NetworkTest')

export async function GET(request: NextRequest) {
  try {
    logger.info('开始网络诊断测试')

    // 获取环境信息
    const env = getEnvironmentDiagnostics()

    // 执行连接测试
    const testResults = await testSupabaseConnection()

    // 生成诊断报告
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: env,
      tests: testResults,
      recommendations: generateRecommendations(env, testResults),
    }

    logger.info('网络诊断完成', {
      summary: testResults.summary,
      success: testResults.tests.filter((t) => t.success).length,
      total: testResults.tests.length,
    })

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    logger.error('网络诊断失败', { error: error.message, stack: error.stack })

    return NextResponse.json(
      {
        error: '诊断失败',
        message: error.message,
        environment: getEnvironmentDiagnostics(),
      },
      { status: 500 }
    )
  }
}

/**
 * 根据测试结果生成建议
 */
function generateRecommendations(
  env: ReturnType<typeof getEnvironmentDiagnostics>,
  testResults: Awaited<ReturnType<typeof testSupabaseConnection>>
): string[] {
  const recommendations: string[] = []

  // 1. 检查是否在 Vercel 环境
  if (!env.isVercel) {
    recommendations.push('⚠️ 当前不在 Vercel 环境，这是本地测试结果')
  }

  // 2. 检查 Supabase URL 配置
  if (!env.supabaseUrl) {
    recommendations.push('❌ NEXT_PUBLIC_SUPABASE_URL 未配置')
    return recommendations
  }

  // 3. 检查区域匹配
  if (env.vercelRegion && env.supabaseRegion) {
    recommendations.push(
      `ℹ️ Vercel 区域: ${env.vercelRegion}, Supabase 区域: ${env.supabaseRegion}`
    )

    // 如果区域距离较远，建议调整
    if (env.vercelRegion === 'hkg1' && env.supabaseRegion.includes('us')) {
      recommendations.push(
        '⚠️ Vercel 在香港，Supabase 在美国，延迟可能较高。建议将 Supabase 迁移到 ap-southeast-1 (新加坡) 区域'
      )
    }
  }

  // 4. 分析测试结果
  const failedTests = testResults.tests.filter((t) => !t.success)

  if (failedTests.length === 0) {
    recommendations.push('✅ 所有测试通过，网络连接正常')
    return recommendations
  }

  // DNS 问题
  if (failedTests.some((t) => t.test === 'DNS 解析')) {
    recommendations.push('❌ DNS 解析失败，可能的原因：')
    recommendations.push('  - Supabase URL 配置错误')
    recommendations.push('  - Vercel 网络无法解析 Supabase 域名')
    recommendations.push('  - 建议检查 Supabase URL 格式：https://[project].supabase.co')
  }

  // TCP 连接问题
  if (failedTests.some((t) => t.test.includes('TCP 连接'))) {
    recommendations.push('❌ TCP 连接失败，可能的原因：')
    recommendations.push('  - Vercel 免费版可能有网络限制')
    recommendations.push('  - Supabase 项目可能被暂停或限制')
    recommendations.push('  - 防火墙阻止了连接')
    recommendations.push('  - 建议检查：https://supabase.com/dashboard 中的项目状态')
    recommendations.push('  - 建议升级 Vercel 到 Pro 计划')
  }

  // HTTP 请求问题
  if (failedTests.some((t) => t.test.includes('HTTP'))) {
    recommendations.push('❌ HTTP 请求失败，可能的原因：')
    recommendations.push('  - Supabase API key 无效或过期')
    recommendations.push('  - Supabase 服务异常')
    recommendations.push('  - 建议检查 Supabase Dashboard 中的 API 设置')
  }

  // Vercel 特定建议
  if (env.isVercel) {
    recommendations.push('')
    recommendations.push('🔧 Vercel 环境特定建议：')

    if (env.vercelEnv === 'production') {
      recommendations.push('  - 确保生产环境的环境变量已正确配置')
      recommendations.push('  - 检查 Vercel Dashboard → Settings → Environment Variables')
    }

    if (env.vercelEnv === 'preview') {
      recommendations.push('  - Preview 环境可能需要单独配置环境变量')
    }

    recommendations.push('  - 查看 Vercel 函数日志获取详细错误信息')
    recommendations.push('  - 考虑启用 Edge Functions: export const runtime = "edge"')
  }

  // Supabase 状态检查建议
  recommendations.push('')
  recommendations.push('🔍 其他诊断步骤：')
  recommendations.push('  1. 访问 https://status.supabase.com 检查 Supabase 服务状态')
  recommendations.push('  2. 访问 Supabase Dashboard 检查项目是否被暂停')
  recommendations.push('  3. 检查 Supabase 项目的使用配额是否已用尽')
  recommendations.push('  4. 尝试从其他网络（如本地）连接 Supabase')

  return recommendations
}
