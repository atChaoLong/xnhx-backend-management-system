import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { getRequestAccessToken } from '@/lib/server-auth-token'
import { getCachedProfile, setCachedProfile } from '@/lib/profile-cache'

export interface CurrentProfile {
  id: string
  name: string | null
  role: string
  is_active?: boolean | null
}

function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return payload?.sub || null
  } catch {
    return null
  }
}

export async function getCurrentProfile(request: NextRequest): Promise<CurrentProfile | null> {
  const token = getRequestAccessToken(request)
  if (!token) return null

  const userId = decodeJwtUserId(token)
  if (!userId) return null

  const cached = getCachedProfile(userId)
  if (cached) {
    if (cached.is_active === false) return null
    return cached as CurrentProfile
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from('user_profiles')
    .select('id, name, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile || profile.is_active === false) return null
  setCachedProfile(userId, profile)
  return profile as CurrentProfile | null
}

export function isAdmin(profile: CurrentProfile | null): boolean {
  return profile?.role === 'admin'
}

export function userNameOrEmpty(profile: CurrentProfile | null): string {
  return profile?.name || ''
}
