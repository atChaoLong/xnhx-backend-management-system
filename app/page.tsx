"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // 检查本地是否有 token
    const token = localStorage.getItem('supabase.auth.token')

    if (token) {
      // 有 token，跳转到 dashboard
      router.replace("/dashboard")
    } else {
      // 没有 token，跳转到登录页
      router.replace("/login")
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
