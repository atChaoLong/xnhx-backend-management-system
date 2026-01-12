/**
 * 健康检查接口
 * 用于监控系统运行状态
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * 健康检查接口
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    
    return NextResponse.json({
      status: 'ok',
      timestamp,
      uptime: Math.floor(uptime),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 });
  }
}
