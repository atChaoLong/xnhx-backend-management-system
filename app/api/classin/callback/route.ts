/**
 * ClassIn 回调接口
 * 接收来自 ClassIn 系统的回调消息
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClassInCallbackData, CallbackResponse } from '@/lib/services/classin/callback-types';
import { verifySafeKey, handleMessage } from '@/lib/services/classin/callback-handler';
import { createLogger } from '@/lib/logger';
import { summarizeError } from '@/lib/safe-error';

const logger = createLogger('API:ClassInCallback');

// 设置运行时为 Node.js，支持 crypto 模块
export const runtime = 'nodejs';
// 强制动态渲染，确保每次请求都能处理
export const dynamic = 'force-dynamic';

function summarizeHeaders(request: NextRequest) {
  return {
    content_type: request.headers.get('content-type') || null,
    user_agent_present: Boolean(request.headers.get('user-agent')),
    forwarded_for_present: Boolean(request.headers.get('x-forwarded-for')),
  };
}

function summarizeCallbackBody(body: ClassInCallbackData) {
  const fields = Object.keys(body || {})
    .filter((field) => field !== 'SafeKey' && field !== 'Msg')
    .sort();

  return {
    sid: body?.SID,
    cmd: body?.Cmd,
    timestamp: body?.TimeStamp,
    has_msg: Boolean(body?.Msg),
    has_safe_key: Boolean(body?.SafeKey),
    fields,
  };
}

/**
 * POST /api/classin/callback
 * ClassIn 回调接口主处理函数
 */
export async function POST(request: NextRequest): Promise<NextResponse<CallbackResponse>> {
  try {
    logger.info('收到 ClassIn 回调请求', { headers: summarizeHeaders(request) });

    // 解析请求体
    const body: ClassInCallbackData = await request.json();
    const { SID, Cmd, SafeKey, TimeStamp } = body;

    logger.debug('ClassIn 回调数据概览', summarizeCallbackBody(body));

    // 验证必要字段
    if (!SID || !Cmd || !SafeKey || !TimeStamp) {
      logger.warn('ClassIn 回调缺少必要字段', summarizeCallbackBody(body));
      // 仍然返回 errno:1 避免 ClassIn 无限重试
      return NextResponse.json<CallbackResponse>({
        error_info: {
          errno: 1,
          error: "程序正常执行"
        }
      }, { status: 200 });
    }

    // 验证时间戳合理性（防止重放攻击）
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - TimeStamp);
    if (timeDiff > 300) { // 5分钟内的请求认为是有效的
      logger.warn('ClassIn 回调时间戳差异过大', {
        sid: SID,
        cmd: Cmd,
        time_diff_seconds: timeDiff,
      });
    }

    // 验证 SafeKey
    if (!verifySafeKey(SafeKey, TimeStamp)) {
      logger.warn('ClassIn 回调 SafeKey 验证失败', {
        sid: SID,
        cmd: Cmd,
        timestamp: TimeStamp,
        current_timestamp: currentTime,
        has_safe_key: true,
      });

      // 返回 errno:1 + HTTP 200，避免 ClassIn 无限重试阻塞后续消息
      return NextResponse.json<CallbackResponse>({
        error_info: {
          errno: 1,
          error: "程序正常执行"
        }
      }, { status: 200 });
    }

    logger.debug('ClassIn 回调 SafeKey 验证通过', { sid: SID, cmd: Cmd });

    // 处理消息
    await handleMessage(Cmd, body);

    // 返回成功响应
    const response: CallbackResponse = {
      error_info: {
        errno: 1,
        error: "程序正常执行"
      }
    };

    logger.info('ClassIn 回调处理完成', { sid: SID, cmd: Cmd });
    return NextResponse.json(response);

  } catch (error: unknown) {
    logger.error('处理 ClassIn 回调时出错', summarizeError(error));

    // 即使出错也要返回 errno:1 + HTTP 200，避免 ClassIn 无限重试阻塞后续消息
    return NextResponse.json<CallbackResponse>({
      error_info: {
        errno: 1,
        error: "程序正常执行"
      }
    }, { status: 200 });
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
