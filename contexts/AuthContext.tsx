"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/fetch"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"
import { tokenRefreshManager } from "@/lib/tokenRefreshManager"
import type { Role } from "@/lib/permissions"

const logger = createLogger("AuthContext")
const LOGOUT_INTENT_KEY = "xnhx_logout_intent"
const CACHE_KEY = "currentUser"
const CACHE_TTL = 5 * 60 * 1000

export interface AuthUser {
  id: string
  email: string | null
  name: string | null
  avatar?: string | null
  role: Role
  createdAt?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  handleLogout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  handleLogout: async () => {},
})

function loadCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return parsed.data as AuthUser
  } catch {
    sessionStorage.removeItem(CACHE_KEY)
    return null
  }
}

function saveCachedUser(user: AuthUser): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: user, timestamp: Date.now() }))
  } catch {
    // sessionStorage full or unavailable
  }
}

export function clearCachedUser(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(CACHE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  // Always start null/loading to match SSR output. Cache is checked in useEffect after mount.
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const handleLogout = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOGOUT_INTENT_KEY, String(Date.now()))
      try {
        await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        })
      } catch (error: unknown) {
        logger.warn("服务端登出请求失败，继续清理本地会话", summarizeError(error))
      }

      tokenRefreshManager.clearSession()
      clearCachedUser()
      setUser(null)
      window.location.replace("/login")
      return
    }

    tokenRefreshManager.clearSession()
    clearCachedUser()
    setUser(null)
    logger.info("用户已登出")
    router.replace("/login")
  }, [router])

  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      // Check sessionStorage cache first (avoids unnecessary API call on every navigation)
      const cached = loadCachedUser()
      if (cached) {
        if (!cancelled) {
          setUser(cached)
          setIsLoading(false)
        }
        return
      }
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("supabase.auth.token") : null

        logger.debug("检查会话状态", { hasToken: !!token })

        const response = await api.get("/api/auth/profile")

        if (response.ok) {
          const { data } = await response.json()
          if (data) {
            const authUser: AuthUser = {
              id: data.id,
              email: data.email ?? null,
              name: data.name ?? null,
              avatar: data.avatar_url ?? null,
              role: (data.role || "sales") as Role,
              createdAt: data.created_at ?? null,
            }
            logger.info("用户已登录", { email: authUser.email })
            saveCachedUser(authUser)
            if (!cancelled) setUser(authUser)
          }
        } else if (response.status === 401) {
          localStorage.removeItem("supabase.auth.session")
          localStorage.removeItem("supabase.auth.token")
          clearCachedUser()
          if (!cancelled) setUser(null)
        } else {
          logger.debug("会话无效或已过期")
          if (!cancelled) setUser(null)
        }
      } catch (err) {
        logger.error("会话检查错误", { message: err instanceof Error ? err.message : String(err) })
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    checkSession()
    return () => {
      cancelled = true
    }
  }, []) // Only run once on mount — no dependency on user state

  return (
    <AuthContext.Provider value={{ user, isLoading, handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
