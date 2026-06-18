"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/fetch"
import { createLogger } from "@/lib/logger"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('HomePage')

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      // 验证 session 是否有效；统一 API wrapper 会在 access token 过期时尝试刷新，
      // 服务端也会读取 httpOnly 登录 cookie 以支持刷新/深链进入。
      try {
        const response = await api.get('/api/auth/session')

        if (response.ok) {
          // session 有效，跳转到 dashboard
          router.replace("/dashboard")
        } else {
          // session 无效，跳转到登录页
          router.replace("/login")
        }
      } catch (error) {
        logger.warn('验证 session 失败', summarizeError(error))
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
