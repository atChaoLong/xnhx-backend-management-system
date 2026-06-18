import { NextRequest } from 'next/server'
import { supabaseAuthServer, supabaseServer } from '@/lib/supabase'
import { getRequestAccessToken } from '@/lib/server-auth-token'

export interface CurrentProfile {
  id: string
  name: string | null
  role: string
  is_active?: boolean | null
}

export async function getCurrentProfile(request: NextRequest): Promise<CurrentProfile | null> {
  const token = getRequestAccessToken(request)
  if (!token) return null

  const { data: { user }, error } = await supabaseAuthServer.auth.getUser(token)
  if (error || !user) return null

  const { data: profile, error: profileError } = await supabaseServer
    .from('user_profiles')
    .select('id, name, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.is_active === false) return null
  return profile as CurrentProfile | null
}

export function isAdmin(profile: CurrentProfile | null): boolean {
  return profile?.role === 'admin'
}

export function userNameOrEmpty(profile: CurrentProfile | null): string {
  return profile?.name || ''
}
