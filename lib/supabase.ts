import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

const serverAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
}

// 如果有 service role key，也创建管理员实例
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export const hasSupabaseServiceRoleKey = Boolean(supabaseServiceKey)

// 服务端认证实例：登录、刷新、验 token 必须使用 anon key。
export const supabaseAuthServer = createClient(supabaseUrl, supabaseAnonKey, serverAuthOptions)

// 服务端数据访问实例：生产优先使用 service role，由 API 层负责认证/RBAC/数据范围。
export const supabaseServer = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  serverAuthOptions
)

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, serverAuthOptions)
  : supabaseServer

export function createUserScopedServerClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

// 客户端 Supabase 实例（用于浏览器）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
