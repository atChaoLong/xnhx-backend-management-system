import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { hasSupabaseServiceRoleKey, supabaseAdmin } from '@/lib/supabase'

const logger = createLogger('Auth:SessionCleanup')

type RevokeServerAuthSessionContext = {
  userId: string
  reason: string
}

export async function revokeServerAuthSession(
  accessToken: string | undefined,
  context: RevokeServerAuthSessionContext
) {
  if (!accessToken) {
    logger.warn('跳过 session 撤销：缺少 access token', context)
    return
  }

  if (!hasSupabaseServiceRoleKey) {
    logger.warn('跳过 session 撤销：缺少 Supabase service role 配置', {
      ...context,
      code: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
    })
    return
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'local')

    if (error) {
      logger.warn('撤销异常登录 session 失败', {
        ...context,
        ...summarizeError(error),
      })
      return
    }

    logger.info('已撤销异常登录 session', context)
  } catch (error: unknown) {
    logger.warn('撤销异常登录 session 异常', {
      ...context,
      ...summarizeError(error),
    })
  }
}
