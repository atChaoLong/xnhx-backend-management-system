"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/fetch"

export default function AuthDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkAuth = async () => {
    setLoading(true)
    try {
      // 1. 检查 localStorage
      const token = localStorage.getItem('supabase.auth.token')
      const userStr = localStorage.getItem('user')

      const info: any = {
        localStorage: {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenPrefix: token?.substring(0, 50) + '...',
          hasUser: !!userStr,
          user: userStr ? JSON.parse(userStr) : null,
        },
      }

      // 2. 测试 session API
      try {
        const response = await api.get('/api/auth/session')
        info.sessionAPI = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        }

        if (response.ok) {
          const data = await response.json()
          info.sessionAPI.data = data
        } else {
          const error = await response.json().catch(() => ({}))
          info.sessionAPI.error = error
        }
      } catch (err: any) {
        info.sessionAPI = {
          error: err.message,
        }
      }

      // 3. 测试直接使用 Supabase 客户端
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        info.supabaseClient = {
          hasSession: !!session,
          sessionError: sessionError?.message,
          user: session?.user ? {
            id: session.user.id,
            email: session.user.email,
          } : null,
          accessTokenPrefix: session?.access_token?.substring(0, 50) + '...',
        }
      } catch (err: any) {
        info.supabaseClient = {
          error: err.message,
        }
      }

      setDebugInfo(info)
    } catch (err: any) {
      console.error('调试错误:', err)
      setDebugInfo({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const clearAuth = () => {
    localStorage.removeItem('supabase.auth.token')
    localStorage.removeItem('user')
    window.location.reload()
  }

  const testLogin = async () => {
    const email = prompt('输入邮箱:')
    const password = prompt('输入密码:')

    if (!email || !password) return

    setLoading(true)
    try {
      const response = await api.post('/api/auth/signin', { email, password })

      const result = await response.json()
      console.log('登录结果:', result)

      if (result.data?.access_token) {
        localStorage.setItem('supabase.auth.token', result.data.access_token)
      }
      if (result.data?.user) {
        localStorage.setItem('user', JSON.stringify({
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.user_metadata?.name || result.data.user.email?.split('@')[0],
        }))
      }

      alert('登录成功，刷新页面查看结果')
      window.location.reload()
    } catch (err: any) {
      alert('登录失败: ' + err.message)
    } finally {
      setLoading(false)
    }
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
                {loading ? '检查中...' : '检查认证状态'}
              </Button>
              <Button onClick={testLogin} variant="outline" disabled={loading}>
                测试登录
              </Button>
              <Button onClick={clearAuth} variant="destructive" disabled={loading}>
                清除认证
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

        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>1. 点击"检查认证状态"查看当前认证信息</p>
            <p>2. 如果未登录，点击"测试登录"输入凭证</p>
            <p>3. 查看 localStorage、Session API 和 Supabase 客户端的状态</p>
            <p>4. 根据显示的 token 信息，复制 access_token 到浏览器控制台手动测试</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
