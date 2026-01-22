"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { School, Loader2 } from "lucide-react"
import { api } from "@/lib/fetch"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  // 检查是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('supabase.auth.token')
      if (!token) {
        return // 没有token，停留在登录页
      }

      // 验证token是否有效
      try {
        const response = await fetch('/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (response.ok) {
          // token有效，跳转到dashboard
          router.replace("/dashboard")
        }
        // token无效，停留在登录页
      } catch (error) {
        console.error('验证token失败:', error)
        // 出错时停留在登录页
      }
    }

    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await api.post('/api/auth/signin', {
        email,
        password,
      })

      if (!response.ok) {
        const { error: err } = await response.json()
        throw new Error(err || '登录失败')
      }

      const { data } = await response.json()

      // 清理旧的缓存数据
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('currentUser')
        localStorage.removeItem('user')
      }

      // 保存完整 session 到 localStorage
      if (data.access_token && data.refresh_token) {
        const sessionData = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          user: data.user
        }
        localStorage.setItem('supabase.auth.session', JSON.stringify(sessionData))

        // 兼容：同时保存 access_token 到旧位置
        localStorage.setItem('supabase.auth.token', data.access_token)
      } else if (data.access_token) {
        // 兼容旧格式
        localStorage.setItem('supabase.auth.token', data.access_token)
      }

      // 保存用户信息
      if (data.user) {
        localStorage.setItem('user', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
        }))
      }

      router.push("/dashboard")
    } catch (err: any) {
      console.error("登录错误:", err)
      setError(err.message || "登录失败，请检查邮箱和密码")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <School className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">小牛好学</CardTitle>
            <CardDescription className="mt-2">教育管理系统 - 登录您的账户</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">账号或邮箱</Label>
              <Input
                id="email"
                type="text"
                placeholder="输入账号或邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {/* <p className="text-xs text-muted-foreground"> */}
                {/* 提示：可以直接输入账号（如：admin），自动转换为 admin@xiaoniuhaoxue.com */}
              {/* </p> */}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登录
            </Button>
          </form>
          {/* <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">还没有账户？</span>{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              立即注册
            </Link>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground text-center">
              首次使用？请先{" "}
              <Link href="/signup" className="text-primary hover:underline">
                创建账户
              </Link>
            </p>
          </div> */}
        </CardContent>
      </Card>
    </div>
  )
}
