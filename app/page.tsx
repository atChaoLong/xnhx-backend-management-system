"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('supabase.auth.token')

      if (!token) {
        // 没有 token，跳转到登录页
        router.replace("/login")
        return
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
        } else {
          // token无效，跳转到登录页
          router.replace("/login")
        }
      } catch (error) {
        console.error('验证token失败:', error)
        // 出错时跳转到登录页
        router.replace("/login")
      } finally {
        setChecking(false)
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
