/**
 * ClassIn 回调接口
 * 接收来自 ClassIn 系统的回调消息
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClassInCallbackData, CallbackResponse } from '@/lib/services/classin/callback-types';
import { verifySafeKey, handleMessage } from '@/lib/services/classin/callback-handler';

// 设置运行时为 Node.js，支持 crypto 模块
export const runtime = 'nodejs';
// 强制动态渲染，确保每次请求都能处理
export const dynamic = 'force-dynamic';

/**
 * POST /api/classin/callback
 * ClassIn 回调接口主处理函数
 */
export async function POST(request: NextRequest): Promise<NextResponse<CallbackResponse>> {
  try {
    // 记录请求信息
    console.log('🔔 收到 ClassIn 回调请求');
    console.log('请求头:', Object.fromEntries(request.headers.entries()));
    
    // 解析请求体
    const body: ClassInCallbackData = await request.json();
    const { SID, Cmd, Msg, SafeKey, TimeStamp } = body;

    console.log('回调数据概览:', {
      SID,
      Cmd,
      hasMsg: !!Msg,
      SafeKey: SafeKey ? `${SafeKey.substring(0, 8)}...` : null,
      TimeStamp
    });

    // 验证必要字段
    if (!SID || !Cmd || !SafeKey || !TimeStamp) {
      console.error('❌ 缺少必要字段:', { SID, Cmd, hasSafeKey: !!SafeKey, TimeStamp });
      return NextResponse.json<CallbackResponse>({
        error_info: {
          errno: 0,
          error: "缺少必要字段"
        }
      }, { status: 400 });
    }

    // 验证时间戳合理性（防止重放攻击）
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - TimeStamp);
    if (timeDiff > 300) { // 5分钟内的请求认为是有效的
      console.warn(`⚠️ 时间戳差异过大: ${timeDiff}秒`);
    }

    // 验证 SafeKey
    if (!verifySafeKey(SafeKey, TimeStamp)) {
      console.error('❌ SafeKey 验证失败');
      console.log('接收到的 SafeKey:', SafeKey);
      console.log('时间戳:', TimeStamp);
      console.log('当前时间戳:', currentTime);
      
      return NextResponse.json<CallbackResponse>({
        error_info: {
          errno: 0,
          error: "认证失败"
        }
      }, { status: 401 });
    }

    console.log('✅ SafeKey 验证通过');

    // 处理消息
    await handleMessage(Cmd, body);

    // 返回成功响应
    const response: CallbackResponse = {
      error_info: {
        errno: 1,
        error: "程序正常执行"
      }
    };

    console.log('✅ 回调处理完成，返回成功响应');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ 处理 ClassIn 回调时出错:', error);
    
    // 即使出错也要返回格式化的响应，避免 ClassIn 重试
    return NextResponse.json<CallbackResponse>({
      error_info: {
        errno: 0,
        error: "服务器内部错误"
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/classin/callback
 * 不允许 GET 请求，返回方法不允许
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    error: 'Method not allowed. Please use POST.',
    message: 'ClassIn 回调接口仅支持 POST 请求'
  }, { 
    status: 405,
    headers: {
      'Allow': 'POST'
    }
  });
}

/**
 * PUT /api/classin/callback
 * 不允许 PUT 请求
 */
export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({
    error: 'Method not allowed. Please use POST.'
  }, { 
    status: 405,
    headers: {
      'Allow': 'POST'
    }
  });
}

/**
 * DELETE /api/classin/callback
 * 不允许 DELETE 请求
 */
export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({
    error: 'Method not allowed. Please use POST.'
  }, { 
    status: 405,
    headers: {
      'Allow': 'POST'
    }
  });
}
