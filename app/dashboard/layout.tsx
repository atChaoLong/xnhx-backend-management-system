"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useTokenRefresh } from "@/lib/hooks/useTokenRefresh"
import { Sidebar } from "@/components/dashboard/sidebar"
import { canAccessDashboardRoute, getDashboardRouteRule } from "@/lib/dashboard-route-access"
import type { Role } from "@/lib/permissions"
import { AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, handleLogout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // 启动 token 自动刷新
  useTokenRefresh()

  // 监听 token 刷新失败事件，自动跳转登录页
  useEffect(() => {
    const handleAuthExpired = () => {
      sessionStorage.removeItem('currentUser')
      router.replace('/login')
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [router])

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login")
      }
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const role = user.role as Role | undefined
  const routeRule = getDashboardRouteRule(pathname)
  const canAccessRoute = canAccessDashboardRoute(role, pathname)

  if (!canAccessRoute) {
    return (
      <div className="flex h-screen bg-muted/30">
        <Sidebar user={user} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center p-6">
            <div className="w-full rounded-lg border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h1 className="text-xl font-semibold">权限不足</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      当前角色不能访问{routeRule?.label ? `「${routeRule.label}」` : "该页面"}。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard"
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                    >
                      返回首页
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      返回上一页
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
