import { NextRequest, NextResponse } from "next/server"
import { getCurrentProfile, type CurrentProfile } from "@/lib/server-data-scope"

export function canManageClassInOps(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "academic_affairs"
}

export async function requireClassInOpsProfile(request: NextRequest): Promise<
  | { ok: true; profile: CurrentProfile }
  | { ok: false; response: NextResponse }
> {
  const profile = await getCurrentProfile(request)

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "用户档案未配置，请联系管理员" },
        { status: 403 }
      ),
    }
  }

  if (!canManageClassInOps(profile)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "仅管理员或教务可执行 ClassIn 运维操作" },
        { status: 403 }
      ),
    }
  }

  return { ok: true, profile }
}
