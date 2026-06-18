"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/fetch"
import { usePermission } from "@/lib/hooks/usePermission"
import { createLogger } from "@/lib/logger"
import { getErrorMessage, summarizeError } from "@/lib/safe-error"

const logger = createLogger('AuthDebugClient')

function getStoredUserSummary(userStr: string | null) {
  if (!userStr) {
    return {
      hasUser: false,
      parseable: false,
    }
  }

  try {
    const user = JSON.parse(userStr)

    return {
      hasUser: true,
      parseable: true,
      hasId: Boolean(user?.id),
      hasEmail: Boolean(user?.email),
      role: typeof user?.role === "string" ? user.role : undefined,
    }
  } catch (error) {
    return {
      hasUser: true,
      parseable: false,
      parseError: summarizeError(error),
    }
  }
}

export function AuthDebugClient() {
  const { role, isLoading: isPermissionLoading } = usePermission()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkAuth = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("supabase.auth.token")
      const sessionStr = localStorage.getItem("supabase.auth.session")
      const userStr = localStorage.getItem("user")

      const info: any = {
        localStorage: {
          hasToken: !!token,
          tokenLength: token?.length,
          hasSession: !!sessionStr,
          sessionLength: sessionStr?.length,
          hasUser: !!userStr,
          user: getStoredUserSummary(userStr),
        },
      }

      try {
        const response = await api.get("/api/auth/session")
        info.sessionAPI = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        }

        if (response.ok) {
          const data = await response.json()
          info.sessionAPI.data = {
            authenticated: data.authenticated,
            hasUser: !!data.user,
            userEmail: data.user?.email,
          }
        } else {
          const error = await response.json().catch(() => ({}))
          info.sessionAPI.error = error
        }
      } catch (err: any) {
        info.sessionAPI = {
          error: summarizeError(err),
        }
      }

      try {
        const { createClient } = await import("@supabase/supabase-js")
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        info.supabaseClient = {
          hasSession: !!session,
          sessionError: sessionError?.message,
          user: session?.user ? {
            hasId: Boolean(session.user.id),
            hasEmail: Boolean(session.user.email),
          } : null,
          hasAccessToken: Boolean(session?.access_token),
          accessTokenLength: session?.access_token?.length,
        }
      } catch (err: any) {
        info.supabaseClient = {
          error: summarizeError(err),
        }
      }

      setDebugInfo(info)
    } catch (err: any) {
      logger.warn("调试错误", summarizeError(err))
      setDebugInfo({ error: getErrorMessage(err) || "调试失败" })
    } finally {
      setLoading(false)
    }
  }

  const clearAuth = () => {
    localStorage.removeItem("supabase.auth.session")
    localStorage.removeItem("supabase.auth.token")
    localStorage.removeItem("user")
    window.location.reload()
  }

  if (isPermissionLoading) {
    return (
      <div className="min-h-screen p-8 bg-muted/30">
        <div className="max-w-4xl mx-auto text-sm text-muted-foreground">正在加载权限...</div>
      </div>
    )
  }

  if (role !== "admin") {
    return (
      <div className="min-h-screen p-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>无权访问</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              认证调试页面仅限管理员在调试环境中使用。
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-muted/30">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>认证状态调试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={checkAuth} disabled={loading}>
                {loading ? "检查中..." : "检查认证状态"}
              </Button>
              <Button onClick={clearAuth} variant="destructive" disabled={loading}>
                清除本地认证缓存
              </Button>
            </div>

            {debugInfo && (
              <div className="space-y-4 mt-4">
                <div className="bg-background p-4 rounded-lg border">
                  <h3 className="font-semibold mb-2">LocalStorage 状态:</h3>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(debugInfo.localStorage, null, 2)}
                  </pre>
                </div>

                <div className="bg-background p-4 rounded-lg border">
                  <h3 className="font-semibold mb-2">Session API 响应:</h3>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(debugInfo.sessionAPI, null, 2)}
                  </pre>
                </div>

                <div className="bg-background p-4 rounded-lg border">
                  <h3 className="font-semibold mb-2">Supabase 客户端状态:</h3>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(debugInfo.supabaseClient, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
