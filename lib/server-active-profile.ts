import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { createUserScopedServerClient, hasSupabaseServiceRoleKey, supabaseAdmin } from '@/lib/supabase'
import { getCachedProfile, setCachedProfile } from '@/lib/profile-cache'

const logger = createLogger('Auth:ActiveProfile')

export const ACTIVE_USER_PROFILE_FIELDS = 'id, email, name, role, created_at, is_active'

export type ActiveUserProfile = {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  role: string | null
  created_at: string | null
  is_active: boolean | null
}

type ActiveProfileFailureCode = 'PROFILE_LOOKUP_FAILED' | 'PROFILE_NOT_FOUND' | 'ACCOUNT_DISABLED'

export type ActiveProfileResult =
  | { ok: true; profile: ActiveUserProfile }
  | { ok: false; status: 403 | 500; error: string; code: ActiveProfileFailureCode }

type ActiveProfileLookupOptions = {
  accessToken?: string
}

function mapActiveProfile(profile: Record<string, any>): ActiveUserProfile {
  return {
    id: profile.id,
    email: profile.email ?? null,
    name: profile.name ?? null,
    avatar_url: null,
    role: profile.role ?? null,
    created_at: profile.created_at ?? null,
    is_active: profile.is_active ?? null,
  }
}

async function queryProfileWithUserToken(
  userId: string,
  accessToken: string
): Promise<ActiveUserProfile | null> {
  const userScopedClient = createUserScopedServerClient(accessToken)
  const { data: profile, error } = await userScopedClient
    .from('user_profiles')
    .select(ACTIVE_USER_PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.warn('用户 token 兜底查询档案失败', {
      ...summarizeError(error),
      userId,
    })
    return null
  }

  return profile ? mapActiveProfile(profile) : null
}

export async function getActiveUserProfile(
  userId: string,
  options: ActiveProfileLookupOptions = {}
): Promise<ActiveProfileResult> {
  const accessToken = typeof options.accessToken === 'string' ? options.accessToken.trim() : ''

  const cached = getCachedProfile(userId)
  if (cached) {
    if (cached.is_active === false) {
      return { ok: false, status: 403, error: '账号已停用，请联系管理员', code: 'ACCOUNT_DISABLED' }
    }
    return { ok: true, profile: mapActiveProfile(cached) }
  }

  if (!hasSupabaseServiceRoleKey) {
    logger.error('用户档案查询缺少 Supabase service role 配置', {
      code: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
      userId,
      hasAccessTokenFallback: Boolean(accessToken),
    })

    if (accessToken) {
      const fallbackProfile = await queryProfileWithUserToken(userId, accessToken)
      if (fallbackProfile) {
        logger.warn('使用用户 token 兜底完成档案查询', {
          userId,
          reason: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
        })

        if (fallbackProfile.is_active === false) {
          return {
            ok: false,
            status: 403,
            error: '账号已停用，请联系管理员',
            code: 'ACCOUNT_DISABLED',
          }
        }

        return { ok: true, profile: fallbackProfile }
      }
    }

    return {
      ok: false,
      status: 500,
      error: '用户档案服务配置异常，请联系管理员',
      code: 'PROFILE_LOOKUP_FAILED',
    }
  }

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select(ACTIVE_USER_PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.error('查询用户档案失败', {
      ...summarizeError(error),
      userId,
      hasAccessTokenFallback: Boolean(accessToken),
    })

    if (accessToken) {
      const fallbackProfile = await queryProfileWithUserToken(userId, accessToken)
      if (fallbackProfile) {
        logger.warn('使用用户 token 兜底完成档案查询', {
          userId,
          reason: 'ADMIN_PROFILE_QUERY_FAILED',
        })

        if (fallbackProfile.is_active === false) {
          return {
            ok: false,
            status: 403,
            error: '账号已停用，请联系管理员',
            code: 'ACCOUNT_DISABLED',
          }
        }

        return { ok: true, profile: fallbackProfile }
      }
    }

    return {
      ok: false,
      status: 500,
      error: '获取用户档案失败，请稍后重试',
      code: 'PROFILE_LOOKUP_FAILED',
    }
  }

  if (!profile) {
    logger.warn('用户档案不存在', { userId })
    return {
      ok: false,
      status: 403,
      error: '用户档案未配置，请联系管理员',
      code: 'PROFILE_NOT_FOUND',
    }
  }

  if (profile.is_active === false) {
    logger.warn('账号已停用，拒绝认证', { userId })
    setCachedProfile(userId, mapActiveProfile(profile))
    return {
      ok: false,
      status: 403,
      error: '账号已停用，请联系管理员',
      code: 'ACCOUNT_DISABLED',
    }
  }

  const mapped = mapActiveProfile(profile)
  setCachedProfile(userId, mapped)
  return {
    ok: true,
    profile: mapped,
  }
}
