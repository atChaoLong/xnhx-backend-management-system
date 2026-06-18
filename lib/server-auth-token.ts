import { NextRequest, NextResponse } from 'next/server'
import type { Session } from '@supabase/supabase-js'

export const AUTH_ACCESS_TOKEN_COOKIE = 'xnhx_access_token'
export const AUTH_REFRESH_TOKEN_COOKIE = 'xnhx_refresh_token'

const DEFAULT_ACCESS_MAX_AGE = 60 * 60
const DEFAULT_REFRESH_MAX_AGE = 60 * 60 * 24 * 30

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

function normalizeBearerToken(value: string | null): string | null {
  if (!value) return null
  const token = value.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

function getAccessMaxAge(session: Session) {
  if (!session.expires_at) return DEFAULT_ACCESS_MAX_AGE
  const ttl = session.expires_at - Math.floor(Date.now() / 1000)
  return Math.max(60, ttl)
}

export function getRequestAccessToken(request: NextRequest): string | null {
  return (
    normalizeBearerToken(request.headers.get('authorization')) ||
    request.cookies.get(AUTH_ACCESS_TOKEN_COOKIE)?.value?.trim() ||
    null
  )
}

export function getRequestRefreshToken(request: NextRequest): string | null {
  return request.cookies.get(AUTH_REFRESH_TOKEN_COOKIE)?.value?.trim() || null
}

export function setAuthCookies(response: NextResponse, session: Session) {
  response.cookies.set(
    AUTH_ACCESS_TOKEN_COOKIE,
    session.access_token,
    buildCookieOptions(getAccessMaxAge(session))
  )

  if (session.refresh_token) {
    response.cookies.set(
      AUTH_REFRESH_TOKEN_COOKIE,
      session.refresh_token,
      buildCookieOptions(DEFAULT_REFRESH_MAX_AGE)
    )
  }
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_ACCESS_TOKEN_COOKIE, '', buildCookieOptions(0))
  response.cookies.set(AUTH_REFRESH_TOKEN_COOKIE, '', buildCookieOptions(0))
}
